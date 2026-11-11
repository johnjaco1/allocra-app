export type DocType = "DDQ" | "Quarterly letter" | "Capital account statement" | "Capital call / distribution notice" | "PPM / LPA" | "Pitch deck" | "Other";
export const DOC_TYPES: DocType[] = ["DDQ", "Quarterly letter", "Capital account statement", "Capital call / distribution notice", "PPM / LPA", "Pitch deck", "Other"];

export const ASSET_CLASSES = ["Private equity", "Venture capital", "Growth equity", "Private credit", "Real estate", "Infrastructure", "Hedge fund", "Other"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export type RunKind = "memo" | "changes";

export interface Fund {
  id: string;
  manager: string | null; // the GP firm, e.g. "Halden Ridge Capital"
  name: string;
  asset_class: AssetClass | null;
  commitment: number | null; // your commitment, $M (entered by hand; statements override)
  strategy: string | null;
  vintage: number | null;
  sample: boolean;
  created_at: string;
}

export interface Citation {
  doc: string;
  page: number;
  quote: string;
  verified?: boolean;
}

// Fund-level figures, then your (the LP's) own position from capital account statements.
export const METRICS = ["net_irr", "gross_irr", "tvpi", "dpi", "rvpi", "nav", "called_pct", "invested_pct", "fund_size", "distributions",
  "commitment", "paid_in", "unfunded", "lp_distributions", "lp_nav"] as const;
export type MetricName = (typeof METRICS)[number];
export const METRIC_LABEL: Record<MetricName, string> = {
  net_irr: "Net IRR", gross_irr: "Gross IRR", tvpi: "Net TVPI", dpi: "DPI", rvpi: "RVPI", nav: "NAV",
  called_pct: "% called", invested_pct: "% invested", fund_size: "Fund size", distributions: "Fund distributions (period)",
  commitment: "Your commitment", paid_in: "Your paid-in", unfunded: "Your unfunded", lp_distributions: "Your distributions to date", lp_nav: "Your capital balance",
};
export const METRIC_UNIT: Record<MetricName, "pct" | "x" | "musd"> = {
  net_irr: "pct", gross_irr: "pct", tvpi: "x", dpi: "x", rvpi: "x", nav: "musd",
  called_pct: "pct", invested_pct: "pct", fund_size: "musd", distributions: "musd",
  commitment: "musd", paid_in: "musd", unfunded: "musd", lp_distributions: "musd", lp_nav: "musd",
};
export const LP_METRICS: MetricName[] = ["commitment", "paid_in", "unfunded", "lp_distributions", "lp_nav"];

// auto = quote found on the page; uncertain = Allocra couldn't find the quote (excluded until a person approves it);
// approved / corrected = a person reviewed it. Corrections keep the original value.
export type MetricStatus = "auto" | "uncertain" | "approved" | "corrected";

export interface Metric {
  name: MetricName;
  value: number; // percent as 12.0, multiples as 1.21, money in $ millions
  as_of: string; // YYYY-MM-DD, or "" if unknown
  citation: Citation;
  status?: MetricStatus;
  original?: number;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface CashFlow {
  kind: "call" | "distribution";
  amount: number; // $M, the LP's share
  date: string; // due / payment date YYYY-MM-DD
  citation: Citation;
}

export interface DocAI {
  doc_type: DocType;
  as_of: string; // period end the document reports on, YYYY-MM-DD or ""
  summary: string;
  key_points: { point: string; citations: Citation[] }[];
  metrics: Metric[];
  cash_flows?: CashFlow[];
}

export interface DocMeta {
  id: string;
  fund_id: string;
  name: string;
  doc_type: DocType;
  as_of: string | null;
  page_count: number;
  chars: number;
  ai: DocAI | null;
  created_at: string;
}

export interface Doc extends DocMeta {
  pages: string[];
}

export interface Finding {
  severity: "red" | "amber" | "green";
  topic: string;
  finding: string;
  citations: Citation[];
}

export interface MemoSection {
  heading: string;
  body: string;
  citations: Citation[];
}

export interface RunResult {
  fund: string;
  headline: string;
  summary: string;
  sections: MemoSection[];
  findings: Finding[];
  questions: string[];
  missing: string[];
}

export interface Run {
  id: string;
  fund_id: string;
  kind: RunKind;
  result: RunResult;
  doc_names: string[];
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface FundSummary extends Fund {
  doc_count: number;
  last_run: { kind: RunKind; created_at: string; red: number; amber: number; headline: string } | null;
  latest: Partial<Record<MetricName, number>>;
  latest_as_of: string | null;
  to_review: number; // figures waiting for a person to approve
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: Record<string, unknown> | null;
}

export interface Member {
  email: string;
  role: string;
  pending?: boolean;
}

// Latest value of each metric across a fund's documents (by as_of, then upload order).
export function latestMetrics(docs: Pick<DocMeta, "ai" | "as_of" | "created_at">[]) {
  const all: Metric[] = [];
  for (const d of docs) for (const m of d.ai?.metrics || []) {
    if (m.status === "uncertain") continue; // never use unverified numbers until a person approves them
    all.push({ ...m, as_of: m.as_of || d.as_of || d.created_at.slice(0, 10) });
  }
  all.sort((a, b) => a.as_of.localeCompare(b.as_of));
  const latest: Partial<Record<MetricName, number>> = {};
  let asOf: string | null = null;
  for (const m of all) { latest[m.name] = m.value; if (["net_irr", "tvpi", "nav"].includes(m.name)) asOf = m.as_of; }
  return { latest, asOf, all };
}
