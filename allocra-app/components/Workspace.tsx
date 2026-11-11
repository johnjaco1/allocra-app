"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, fmtMetric, fmtPeriod, fullAnalysis, short, type Step } from "@/lib/client";
import { ASSET_CLASSES, DOC_TYPES, latestMetrics, LP_METRICS, METRIC_LABEL, type Citation, type Metric, type DocMeta, type Fund, type MetricName, type Run, type RunKind } from "@/lib/types";
import PerfChart from "./PerfChart";
import RunView, { Cites, SEV_LABEL } from "./RunView";
import SourceDrawer, { type FigureRef } from "./SourceDrawer";
import { useUploads } from "./Uploads";

type Tab = "overview" | "memo" | "performance" | "changes" | "documents";
const KPI_BASE: MetricName[] = ["net_irr", "tvpi", "dpi", "nav"];
const TABLE_METRICS: MetricName[] = ["net_irr", "gross_irr", "tvpi", "dpi", "rvpi", "nav", "called_pct", "invested_pct", "distributions", "fund_size"];

export default function Workspace({ fund, initialDocs, initialRuns }: { fund: Fund; initialDocs: DocMeta[]; initialRuns: Run[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [docs, setDocs] = useState(initialDocs);
  const [runs, setRuns] = useState(initialRuns);
  // the server is the source of truth: pick up documents added by drag and drop or the inbox
  useEffect(() => { setDocs(initialDocs); }, [initialDocs]);
  useEffect(() => { setRuns(initialRuns); }, [initialRuns]);
  const { pick } = useUploads();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [single, setSingle] = useState<RunKind | null>(null);
  const [summarizing, setSummarizing] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [source, setSource] = useState<Citation | null>(null);
  const [figure, setFigure] = useState<FigureRef | null>(null);
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<Record<RunKind, string | null>>({ memo: null, changes: null });
  const [metric, setMetric] = useState<MetricName>("net_irr");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const busy = !!steps?.some((s) => s.state === "doing" || s.state === "todo") || !!single;
  const memos = runs.filter((r) => r.kind === "memo");
  const changes = runs.filter((r) => r.kind === "changes");
  const memo = memos.find((r) => r.id === sel.memo) || memos[0] || null;
  const change = changes.find((r) => r.id === sel.changes) || changes[0] || null;
  const perf = useMemo(() => latestMetrics(docs), [docs]);
  const series = useMemo(() => {
    // one value per metric per period (latest-uploaded wins)
    const byKey = new Map<string, (typeof perf.all)[number]>();
    for (const m of perf.all) byKey.set(m.name + "|" + m.as_of, m);
    return [...byKey.values()];
  }, [perf]);
  // every extracted figure, including uncertain ones, with where it lives so a person can review it
  const figures = useMemo(() => {
    const out: (Metric & { docId: string; index: number })[] = [];
    docs.forEach((d) => (d.ai?.metrics || []).forEach((m, index) => out.push({ ...m, as_of: m.as_of || d.as_of || "", docId: d.id, index })));
    return out;
  }, [docs]);
  const cell = (k: MetricName, p: string) => {
    const xs = figures.filter((x) => x.name === k && x.as_of === p);
    return xs.find((x) => x.status === "approved" || x.status === "corrected") || xs.find((x) => x.status !== "uncertain") || xs[0];
  };
  const periods = [...new Set(figures.map((m) => m.as_of).filter(Boolean))].sort();
  const flows = docs.flatMap((d) => (d.ai?.cash_flows || []).map((c) => ({ ...c, docId: d.id }))).sort((a, b) => b.date.localeCompare(a.date));
  const openFigure = (m: Metric & { docId: string; index: number }) => { setFigure({ docId: m.docId, index: m.index, metric: m }); setSource(m.citation); };
  const onFigure = (m: Metric) => setDocs((ds) => ds.map((d) => d.id !== figure?.docId || !d.ai ? d : { ...d, ai: { ...d.ai, metrics: d.ai.metrics.map((x, i) => (i === figure.index ? m : x)) } }));
  const toReview = figures.filter((m) => m.status === "uncertain").length;
  async function saveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api(`/api/funds/${fund.id}`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(f.entries())) }).catch((x) => setErr(x.message));
    setEditing(false); router.refresh();
  }
  const prev = (name: MetricName) => { const s = series.filter((m) => m.name === name).sort((a, b) => a.as_of.localeCompare(b.as_of)); return s.length > 1 ? s[s.length - 2].value : null; };
  const unsummarized = docs.filter((d) => !d.ai).length;
  const KPI: MetricName[] = [...KPI_BASE, perf.latest.called_pct == null && perf.latest.invested_pct != null ? "invested_pct" : "called_pct"];

  const letters = docs.filter((d) => d.doc_type === "Quarterly letter" || d.doc_type === "Capital account statement");
  const defaultNewest = (letters[letters.length - 1] || docs[docs.length - 1])?.id || "";
  const [newestId, setNewestId] = useState(defaultNewest);
  useEffect(() => { if (!docs.some((d) => d.id === newestId)) setNewestId(defaultNewest); }, [docs, newestId, defaultNewest]);

  async function runAll() {
    setErr("");
    await fullAnalysis(fund.id, docs, (st, ds, run) => {
      setSteps(st); setDocs(ds);
      if (run) setRuns((r) => [run, ...r]);
    });
    router.refresh();
  }

  async function runOne(kind: RunKind) {
    setErr(""); setSingle(kind);
    try {
      const { run } = await api<{ run: Run }>(`/api/funds/${fund.id}/run`, { method: "POST", body: JSON.stringify({ kind, newestId }) });
      setRuns((r) => [run, ...r]); setSel((s) => ({ ...s, [kind]: run.id }));
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setSingle(null); }
  }

  async function summarize(d: DocMeta) {
    setSummarizing((s) => [...s, d.id]);
    try { const { doc } = await api<{ doc: DocMeta }>(`/api/docs/${d.id}/analyze`, { method: "POST" }); setDocs((x) => x.map((y) => (y.id === d.id ? doc : y))); }
    catch (e) { setErr((e as Error).message); }
    finally { setSummarizing((s) => s.filter((x) => x !== d.id)); }
  }

  async function patchDoc(d: DocMeta, p: Partial<Pick<DocMeta, "doc_type" | "as_of">>) {
    setDocs((x) => x.map((y) => (y.id === d.id ? { ...y, ...p } : y)));
    await api(`/api/docs/${d.id}`, { method: "PATCH", body: JSON.stringify(p) }).catch((e) => setErr(e.message));
  }
  async function removeDoc(d: DocMeta) {
    if (!confirm(`Delete "${d.name}"? This permanently removes it from Allocra.`)) return;
    try { await api(`/api/docs/${d.id}`, { method: "DELETE" }); setDocs((x) => x.filter((y) => y.id !== d.id)); router.refresh(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function removeRun(r: Run) {
    if (!confirm("Delete this analysis?")) return;
    await api(`/api/runs/${r.id}`, { method: "DELETE" });
    setRuns((x) => x.filter((y) => y.id !== r.id)); router.refresh();
  }
  async function removeFund() {
    if (!confirm(`Delete ${fund.name} and all of its documents and analyses? This can't be undone.`)) return;
    await api(`/api/funds/${fund.id}`, { method: "DELETE" });
    router.push("/"); router.refresh();
  }

  const docByName = (name: string) => docs.find((d) => d.name === name);
  const topFindings = [...(change?.result.findings || []), ...(memo?.result.findings || [])].filter((f) => f.severity !== "green")
    .filter((f, i, a) => a.findIndex((g) => g.topic.toLowerCase() === f.topic.toLowerCase()) === i).slice(0, 5);

  const History = ({ list, kind }: { list: Run[]; kind: RunKind }) => list.length > 1 ? (
    <div className="history no-print" style={{ marginBottom: 14 }}>
      {list.map((r) => <button key={r.id} className={"hist" + (r.id === (kind === "memo" ? memo : change)?.id ? " on" : "")} onClick={() => setSel((s) => ({ ...s, [kind]: r.id }))}>{fmtDate(r.created_at)}</button>)}
    </div>
  ) : null;

  const Spinner = ({ text }: { text: string }) => <div className="row" style={{ padding: "26px 0", gap: 12 }}><span className="spinner" /><span className="muted">{text}</span></div>;

  return (
    <>
      <div className="topline no-print">
        <div>
          <div className="crumb">{fund.manager || "No firm set"}{fund.sample ? " · Sample fund, fictional" : ""}</div>
          <h1>{fund.name}</h1>
          <div className="sub">{[fund.asset_class, fund.strategy, fund.vintage && `Vintage ${fund.vintage}`, fund.commitment != null && `${fmtMetric("commitment", fund.commitment)} committed`, `${docs.length} documents`].filter(Boolean).join(" · ")}
            {" "}<button className="link-btn" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit details"}</button></div>
          {editing && (
            <form className="row" style={{ marginTop: 10, gap: 8 }} onSubmit={saveDetails}>
              <input type="text" name="manager" defaultValue={fund.manager || ""} placeholder="Firm" style={{ width: 170 }} />
              <select name="asset_class" defaultValue={fund.asset_class || ""} style={{ width: 160 }}><option value="">Asset class</option>{ASSET_CLASSES.map((a) => <option key={a}>{a}</option>)}</select>
              <input type="number" name="vintage" defaultValue={fund.vintage || ""} placeholder="Vintage" style={{ width: 100 }} />
              <input type="number" step="any" name="commitment" defaultValue={fund.commitment ?? ""} placeholder="Commitment $M" style={{ width: 140 }} />
              <button className="btn sm">Save</button>
            </form>
          )}
        </div>
        <div className="row">
          <button className="btn danger sm" onClick={removeFund}>Delete fund</button>
          <button className="btn" disabled={busy || !docs.length} onClick={runAll}>{busy && steps ? "Running…" : "Run full analysis"}</button>
        </div>
      </div>

      {err && <div className="err no-print" style={{ marginBottom: 14 }}>{err}</div>}

      <div className="tabs no-print" role="tablist">
        {([["overview", "Overview"], ["memo", "IC memo"], ["performance", "Performance"], ["changes", "What changed"], ["documents", "Documents"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>
            {l}{k === "documents" && <span className="cnt">{docs.length}</span>}{k === "performance" && toReview > 0 && <span className="cnt" style={{ color: "var(--warn)" }}>⚠ {toReview}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="stack">
          {steps && (
            <div className="card">
              <p className="label">Full analysis</p>
              <div className="progress">
                {steps.map((s) => (
                  <div key={s.id} className={"step " + s.state}>
                    {s.state === "doing" ? <span className="spinner" /> : <span className="ic">{s.state === "done" ? "✓" : s.state === "fail" ? "!" : ""}</span>}
                    <span>{s.label}</span>{s.error && <span className="tiny" style={{ color: "var(--crit)" }}>{s.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="kpis">
            {KPI.map((k) => {
              const v = perf.latest[k], p = prev(k);
              const dl = v != null && p != null ? v - p : null;
              return (
                <div key={k} className="kpi">
                  <b>{fmtMetric(k, v)}{dl != null && Math.abs(dl) > 1e-9 && <span className={"delta " + (dl > 0 ? "up" : "down")}>{dl > 0 ? "▲" : "▼"}</span>}</b>
                  <span>{METRIC_LABEL[k]}{perf.asOf && !["called_pct", "invested_pct"].includes(k) ? ` · ${fmtPeriod(perf.asOf)}` : ""}</span>
                </div>
              );
            })}
          </div>
          {!memo && !change && !steps ? (
            <div className="card empty">
              <h2>{docs.length ? "Run Allocra on this fund" : "Add this fund's documents"}</h2>
              <p className="muted">{docs.length ? "One click summarizes every document, tracks performance, writes the IC memo and flags what changed, with every point cited to the page." : "Upload the DDQ, quarterly letters and capital account statements in the Documents tab, or drop them in the Portfolio inbox."}</p>
              {docs.length ? <button className="btn" onClick={runAll}>Run full analysis</button> : <button className="btn ghost" onClick={() => setTab("documents")}>Go to documents</button>}
            </div>
          ) : (
            <div className="grid2">
              <div className="card">
                <p className="label">Allocra&apos;s read</p>
                {memo || change ? (
                  <>
                    <div className="headline" style={{ marginTop: 0 }}>{(change || memo)!.result.headline}</div>
                    <p style={{ color: "var(--ink2)", margin: "0 0 6px" }}>{(memo || change)!.result.summary}</p>
                    <div className="section" style={{ paddingBottom: 0 }}><p className="label" style={{ margin: 0 }}>Needs attention</p></div>
                    {topFindings.length ? topFindings.map((f, i) => (
                      <div key={i} className="finding"><span className={`sev ${f.severity}`}>{SEV_LABEL[f.severity]}</span><div><b>{f.topic}.</b> {f.finding}<Cites cs={f.citations} open={setSource} /></div></div>
                    )) : <p className="muted small">Nothing flagged.</p>}
                  </>
                ) : <Spinner text="Working…" />}
              </div>
              <div className="stack">
                <div className="card">
                  <div className="between" style={{ alignItems: "baseline" }}><p className="label">Net IRR by period</p><button className="link-btn" onClick={() => setTab("performance")}>All performance →</button></div>
                  <PerfChart points={series} metric="net_irr" open={setSource} />
                </div>
                <div className="card">
                  <p className="label">Latest documents</p>
                  {[...docs].reverse().slice(0, 3).map((d) => (
                    <div key={d.id} className="doc" style={{ padding: "10px 0" }}>
                      <div className="doc-name small">{short(d.name)} <span className="tag" style={{ marginLeft: 6 }}>{d.doc_type}</span></div>
                      <p className="doc-sum small" style={{ marginTop: 4 }}>{d.ai?.summary || <span className="muted">Not summarized yet.</span>}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "memo" && (
        <div className="card">
          <div className="between no-print" style={{ marginBottom: 14 }}>
            <span className="muted small">Reads the DDQ and every other document on this fund.</span>
            <button className="btn sm" disabled={busy || !docs.length} onClick={() => runOne("memo")}>{memo ? "Rewrite memo" : "Write IC memo"}</button>
          </div>
          <History list={memos} kind="memo" />
          {single === "memo" ? <Spinner text={`Writing the IC memo from ${docs.length} documents…`} /> : memo
            ? <RunView run={memo} fundName={fund.name} open={setSource} onDelete={() => removeRun(memo)} />
            : <div className="empty"><h2>No memo yet</h2><p className="muted">Upload the DDQ, then write the memo.</p></div>}
        </div>
      )}

      {tab === "changes" && (
        <div className="card">
          <div className="between no-print" style={{ marginBottom: 14, alignItems: "flex-end" }}>
            {docs.length >= 2 ? (
              <label className="field" style={{ minWidth: 260 }}>
                <span>Compare this document against everything earlier</span>
                <select value={newestId} onChange={(e) => setNewestId(e.target.value)}>{docs.map((d) => <option key={d.id} value={d.id}>{short(d.name)}</option>)}</select>
              </label>
            ) : <span className="muted small">Needs the newest letter plus at least one earlier document.</span>}
            <button className="btn sm" disabled={busy || docs.length < 2} onClick={() => runOne("changes")}>Show what changed</button>
          </div>
          <History list={changes} kind="changes" />
          {single === "changes" ? <Spinner text="Comparing documents…" /> : change
            ? <RunView run={change} fundName={fund.name} open={setSource} onDelete={() => removeRun(change)} />
            : <div className="empty"><h2>Nothing compared yet</h2><p className="muted">Pick the newest document and Allocra reports what changed: team, strategy, performance and terms.</p></div>}
        </div>
      )}

      {tab === "performance" && (
        <div className="stack">
          <div className="kpis">
            {KPI.map((k) => <div key={k} className="kpi"><b>{fmtMetric(k, perf.latest[k])}</b><span>{METRIC_LABEL[k]}</span></div>)}
          </div>
          {toReview > 0 && <div className="note">{toReview} figure{toReview === 1 ? "" : "s"} couldn&apos;t be matched to the page and {toReview === 1 ? "is" : "are"} left out of totals and charts until approved. They&apos;re marked <b>uncertain</b> below; click one to check it.</div>}
          <div className="card">
            <div className="between" style={{ marginBottom: 10 }}>
              <p className="label" style={{ margin: 0 }}>{METRIC_LABEL[metric]} by reporting period</p>
              <div className="seg">{(["net_irr", "tvpi", "dpi", "nav"] as MetricName[]).map((m) => <button key={m} className={metric === m ? "on" : ""} onClick={() => setMetric(m)}>{METRIC_LABEL[m]}</button>)}</div>
            </div>
            <PerfChart points={series} metric={metric} open={setSource} />
          </div>
          {[["Fund performance", TABLE_METRICS], ["Your position", LP_METRICS]].map(([title, list]) => {
            const rows = (list as MetricName[]).filter((k) => figures.some((m) => m.name === k));
            const ps = periods.filter((p) => rows.some((k) => cell(k, p)));
            if (!rows.length) return null;
            return (
              <div key={title as string} className="card" style={{ padding: "4px 4px 0" }}>
                <p className="label" style={{ margin: "14px 12px 4px" }}>{title as string}</p>
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>Figure</th>{ps.map((p) => <th key={p} className="r">{fmtPeriod(p)}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((k) => (
                        <tr key={k}>
                          <td className="fn">{METRIC_LABEL[k]}</td>
                          {ps.map((p) => {
                            const m = cell(k, p);
                            return <td key={p} className="r">{m ? (
                              <button className="vbtn" title={`${short(m.citation.doc)} p.${m.citation.page}`} onClick={() => openFigure(m)}>
                                {fmtMetric(k, m.value)}{m.status && m.status !== "auto" && <span className={"status " + m.status}>{m.status === "uncertain" ? "⚠ uncertain" : m.status === "corrected" ? "✓ corrected" : "✓"}</span>}
                              </button>) : <span className="muted">—</span>}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {!figures.length && <div className="card empty"><p className="muted">{unsummarized ? "Run the full analysis to pull figures out of the letters and statements." : "No figures found in these documents yet."}</p></div>}
          {flows.length > 0 && (
            <div className="card" style={{ padding: "4px 4px 0" }}>
              <p className="label" style={{ margin: "14px 12px 4px" }}>Your cash flows</p>
              <div className="tablewrap"><table>
                <thead><tr><th>Date</th><th>Type</th><th className="r">Amount</th><th>Source</th></tr></thead>
                <tbody>{flows.map((c, i) => (
                  <tr key={i}><td>{fmtDate(c.date)}</td><td>{c.kind === "call" ? "Capital call" : "Distribution"}</td><td className="r">{c.kind === "call" ? "−" : "+"}{fmtMetric("nav", c.amount)}</td>
                    <td><button className="cite" onClick={() => setSource(c.citation)}>{short(c.citation.doc)} p.{c.citation.page}</button></td></tr>
                ))}</tbody>
              </table></div>
            </div>
          )}
          <p className="tiny muted">Every figure comes from a document and is checked against its page. Click a value to see the source and approve or correct it. Corrections keep the original, and every change is logged. Allocra never calculates or estimates these numbers.</p>
        </div>
      )}

      {tab === "documents" && (
        <div className="card">
          <div className="drop no-print" onClick={() => pick(fund.id)} role="button" tabIndex={0}>
            <b>Drop documents anywhere on this page</b> or click to choose
            <div className="small muted" style={{ marginTop: 3 }}>Each one is summarized and its performance figures pulled out. Text is read in your browser; the file itself is never uploaded.</div>
          </div>
          <div style={{ marginTop: 10 }}>
            {[...docs].reverse().map((d) => (
              <div key={d.id} className="doc">
                <div className="doc-top">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="doc-name">{short(d.name)}</div>
                    <div className="row tiny muted" style={{ gap: 8, marginTop: 4 }}>
                      <select value={d.doc_type} onChange={(e) => patchDoc(d, { doc_type: e.target.value as DocMeta["doc_type"] })} aria-label="Document type">{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                      <input type="date" value={d.as_of || ""} onChange={(e) => patchDoc(d, { as_of: e.target.value || null })} aria-label="Period end" />
                      <span>{fmtPeriod(d.as_of)} · {d.page_count} {d.page_count === 1 ? "page" : "pages"} · added {fmtDate(d.created_at)}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 12 }}>
                    {!d.ai && <button className="btn ghost sm" disabled={summarizing.includes(d.id)} onClick={() => summarize(d)}>{summarizing.includes(d.id) ? "Summarizing…" : "Summarize"}</button>}
                    <button className="link-btn red" onClick={() => removeDoc(d)}>Delete</button>
                  </div>
                </div>
                {summarizing.includes(d.id) && <div className="row small muted" style={{ gap: 8, marginTop: 8 }}><span className="spinner" />Summarizing…</div>}
                {d.ai && (
                  <>
                    <p className="doc-sum">{d.ai.summary}</p>
                    {open[d.id] ? (
                      <ul>{d.ai.key_points.map((k, i) => <li key={i}>{k.point}<Cites cs={k.citations} open={setSource} /></li>)}</ul>
                    ) : null}
                    <button className="link-btn" style={{ marginTop: 6 }} onClick={() => setOpen((o) => ({ ...o, [d.id]: !o[d.id] }))}>
                      {open[d.id] ? "Hide key points" : `Key points (${d.ai.key_points.length})${d.ai.metrics.length ? ` · ${d.ai.metrics.length} figure${d.ai.metrics.length === 1 ? "" : "s"}` : ""}`}
                    </button>
                  </>
                )}
              </div>
            ))}
            {!docs.length && <p className="muted small" style={{ textAlign: "center", padding: 20 }}>No documents yet.</p>}
          </div>
        </div>
      )}

      {source && <SourceDrawer key={(figure?.docId || "") + (figure?.index ?? "") + source.doc + source.page} cite={source} docId={figure?.docId || docByName(source.doc)?.id}
        figure={figure || undefined} onFigure={onFigure} onClose={() => { setSource(null); setFigure(null); }} />}
    </>
  );
}
