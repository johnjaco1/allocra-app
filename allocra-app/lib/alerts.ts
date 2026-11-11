import { latestMetrics, type CashFlow, type Citation, type DocMeta, type FundSummary, type Metric, type MetricName, type Run } from "./types";

export interface Alert {
  fund_id: string;
  fund: string;
  manager: string | null;
  severity: "high" | "medium";
  title: string;
  detail: string;
  // figure = computed from extracted, source-checked numbers; ai = Allocra's interpretation of the documents
  basis: "figure" | "ai";
  citations: Citation[];
}

export interface Intelligence {
  period: string | null; // latest quarter-end in the book
  reporting: number;
  total: number;
  material: number;
  concerns: number;
  memos: number;
  alerts: Alert[];
  upcoming: (CashFlow & { fund_id: string; fund: string })[];
  totals: { committed: number; paid_in: number; distributed: number; unfunded: number; nav: number; funds_with_statements: number };
  byClass: { key: string; value: number }[];
  byVintage: { key: string; value: number }[];
  toReview: number;
}

const DAY = 86_400_000;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const money = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : v >= 10 ? `$${Math.round(v)}M` : `$${v.toFixed(1)}M`);
const qLabel = (d: string) => { const dt = new Date(d + "T12:00:00"); return `Q${Math.floor(dt.getMonth() / 3) + 1} ${dt.getFullYear()}`; };
const isQuarterEnd = (d: string) => /-(03-31|06-30|09-30|12-31)$/.test(d);

function series(all: Metric[], name: MetricName) {
  const m = new Map<string, Metric>();
  for (const x of all) if (x.name === name && x.as_of) m.set(x.as_of, x);
  return [...m.values()].sort((a, b) => a.as_of.localeCompare(b.as_of));
}

export function buildIntelligence(funds: FundSummary[], docs: Record<string, DocMeta[]>, runs: Record<string, Run[]>, today = new Date()): Intelligence {
  const alerts: Alert[] = [];
  const now = today.getTime();
  const reportingDocs = (ds: DocMeta[]) => ds.filter((d) => ["Quarterly letter", "Capital account statement"].includes(d.doc_type) && d.as_of && isQuarterEnd(d.as_of));
  const period = funds.flatMap((f) => reportingDocs(docs[f.id] || []).map((d) => d.as_of!)).sort().pop() || null;

  for (const f of funds) {
    const ds = docs[f.id] || [];
    const { all } = latestMetrics(ds);
    const base = { fund_id: f.id, fund: f.name, manager: f.manager };

    // 1. NAV decline of more than 10% in a period, after adding back that period's distributions
    const nav = series(all, "nav"), dist = series(all, "distributions");
    for (let i = 1; i < nav.length; i++) {
      const a = nav[i - 1], b = nav[i], d = dist.find((x) => x.as_of === b.as_of);
      const chg = (b.value + (d?.value || 0)) / a.value - 1;
      if (i === nav.length - 1 && chg < -0.1) alerts.push({ ...base, severity: "high", basis: "figure", title: `NAV down ${pct(-chg)}`,
        detail: `NAV went from ${money(a.value)} (${qLabel(a.as_of)}) to ${money(b.value)} (${qLabel(b.as_of)})${d ? `, after adding back ${money(d.value)} of distributions` : ""}. Review valuations and underlying company performance.`,
        citations: [b.citation, a.citation, ...(d ? [d.citation] : [])] });
    }
    // 2. Net IRR falling half a point or more
    const irr = series(all, "net_irr");
    if (irr.length > 1) {
      const a = irr[irr.length - 2], b = irr[irr.length - 1];
      if (b.value - a.value <= -0.5) alerts.push({ ...base, severity: b.value - a.value <= -2 ? "high" : "medium", basis: "figure", title: `Net IRR fell ${(a.value - b.value).toFixed(1)} pts`,
        detail: `Net IRR went from ${a.value.toFixed(1)}% in ${qLabel(a.as_of)} to ${b.value.toFixed(1)}% in ${qLabel(b.as_of)}.`, citations: [b.citation, a.citation] });
    }
    // 3. Distributions stalled: DPI unchanged for two straight periods once a fund is 3+ years old
    const dpi = series(all, "dpi");
    if (dpi.length > 1 && f.vintage && today.getFullYear() - f.vintage >= 3) {
      const a = dpi[dpi.length - 2], b = dpi[dpi.length - 1];
      if (Math.abs(b.value - a.value) < 0.005) alerts.push({ ...base, severity: "medium", basis: "figure", title: "Distributions stalled",
        detail: `DPI was ${b.value.toFixed(2)}x in both ${qLabel(a.as_of)} and ${qLabel(b.as_of)}, ${today.getFullYear() - f.vintage} years after the ${f.vintage} vintage.`, citations: [b.citation, a.citation] });
    }
    // 4. Figures that conflict: two documents state different values for the same figure and period
    const seen = new Map<string, Metric>();
    for (const m of all) {
      const k = m.name + "|" + m.as_of, prev = seen.get(k);
      if (prev && prev.citation.doc !== m.citation.doc && Math.abs(prev.value - m.value) > Math.max(0.01, Math.abs(prev.value) * 0.005))
        alerts.push({ ...base, severity: "high", basis: "figure", title: "Conflicting figures",
          detail: `Two documents report different ${m.name.replace("_", " ")} for ${qLabel(m.as_of)}: ${prev.value} vs ${m.value}. Confirm with the manager before using either.`, citations: [prev.citation, m.citation] });
      seen.set(k, m);
    }
    // 5. Report not received 45+ days after the latest quarter-end
    if (period && reportingDocs(ds).length && !ds.some((d) => d.as_of === period) && now - new Date(period + "T00:00:00").getTime() >= 45 * DAY)
      alerts.push({ ...base, severity: "medium", basis: "figure", title: `No ${qLabel(period)} report yet`,
        detail: `Other managers have reported ${qLabel(period)}; nothing for this fund has been received ${Math.floor((now - new Date(period).getTime()) / DAY)} days after quarter-end.`, citations: [] });
    // 6. Capital call due within 30 days
    for (const d of ds) for (const c of d.ai?.cash_flows || []) {
      const due = new Date(c.date + "T12:00:00").getTime();
      if (c.kind === "call" && due >= now - DAY && due - now <= 30 * DAY)
        alerts.push({ ...base, severity: "medium", basis: "figure", title: `Capital call: ${money(c.amount)} due ${new Date(c.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          detail: "New capital call notice received. Confirm funding.", citations: [c.citation] });
    }
    // 7. Allocra's own flags from the latest what-changed (or memo) run
    const fr = runs[f.id] || [];
    const latest = fr.find((r) => r.kind === "changes") || fr.find((r) => r.kind === "memo");
    if (latest) {
      const reds = latest.result.findings.filter((x) => x.severity === "red");
      const ambers = latest.result.findings.filter((x) => x.severity === "amber").slice(0, Math.max(0, 2 - reds.length));
      for (const x of [...reds, ...ambers]) alerts.push({ ...base, severity: x.severity === "red" ? "high" : "medium", basis: "ai", title: x.topic, detail: x.finding, citations: x.citations });
    }
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));

  const upcoming = funds.flatMap((f) => (docs[f.id] || []).flatMap((d) => (d.ai?.cash_flows || []).map((c) => ({ ...c, fund_id: f.id, fund: f.name }))))
    .filter((c) => new Date(c.date + "T12:00:00").getTime() >= now - DAY).sort((a, b) => a.date.localeCompare(b.date));

  const t = { committed: 0, paid_in: 0, distributed: 0, unfunded: 0, nav: 0, funds_with_statements: 0 };
  const cls = new Map<string, number>(), vin = new Map<string, number>();
  for (const f of funds) {
    const L = f.latest;
    const commit = L.commitment ?? f.commitment ?? 0;
    t.committed += commit; t.paid_in += L.paid_in || 0; t.distributed += L.lp_distributions || 0;
    t.unfunded += L.unfunded ?? Math.max(0, commit - (L.paid_in || 0)); t.nav += L.lp_nav || 0;
    if (L.lp_nav != null) t.funds_with_statements++;
    const exposure = L.lp_nav ?? commit;
    cls.set(f.asset_class || "Other", (cls.get(f.asset_class || "Other") || 0) + exposure);
    if (f.vintage) vin.set(String(f.vintage), (vin.get(String(f.vintage)) || 0) + exposure);
  }

  return {
    period, reporting: period ? funds.filter((f) => (docs[f.id] || []).some((d) => d.as_of === period)).length : 0, total: funds.length,
    material: alerts.length, concerns: alerts.filter((a) => a.severity === "high").length,
    memos: funds.reduce((a, f) => a + (runs[f.id] || []).filter((r) => r.kind === "memo").length, 0),
    alerts, upcoming, totals: t,
    byClass: [...cls.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value),
    byVintage: [...vin.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => a.key.localeCompare(b.key)),
    toReview: funds.reduce((a, f) => a + f.to_review, 0),
  };
}
