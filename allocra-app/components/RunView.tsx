"use client";
import { fmtDate, short } from "@/lib/client";
import type { Citation, Run } from "@/lib/types";

export const SEV_LABEL = { red: "Red flag", amber: "Look closer", green: "In line" } as const;

export function Cites({ cs, open }: { cs: Citation[]; open: (c: Citation) => void }) {
  if (!cs?.length) return null;
  return (
    <div className="cites">
      {cs.map((c, i) => (
        <button key={i} className={"cite" + (c.verified === false ? " bad" : "")} onClick={() => open(c)} title={c.verified === false ? "Quote not found on this page. Check the source." : c.quote}>
          {short(c.doc)} p.{c.page}{c.verified === false ? " ⚠" : ""}
        </button>
      ))}
    </div>
  );
}

function copyText(fundName: string, r: Run) {
  const x = r.result;
  const cites = (cs: Citation[]) => (cs.length ? ` [${cs.map((c) => `${short(c.doc)} p.${c.page}`).join("; ")}]` : "");
  const t = [
    `${fundName}: ${r.kind === "memo" ? "IC Memo" : "What Changed"} (${fmtDate(r.created_at)})`, "", x.headline, "", x.summary, "",
    ...x.sections.flatMap((s) => [s.heading.toUpperCase(), s.body + cites(s.citations), ""]),
    r.kind === "memo" ? "KEY FINDINGS" : "CHANGES",
    ...x.findings.map((f) => `- [${SEV_LABEL[f.severity]}] ${f.topic}: ${f.finding}${cites(f.citations)}`), "",
    "QUESTIONS", ...x.questions.map((q, i) => `${i + 1}. ${q}`),
    ...(x.missing.length ? ["", "NOT COVERED IN THE DOCUMENTS", ...x.missing.map((m) => `- ${m}`)] : []),
  ].join("\n");
  navigator.clipboard.writeText(t);
}

export default function RunView({ run, fundName, open, onDelete }: { run: Run; fundName: string; open: (c: Citation) => void; onDelete: () => void }) {
  const r = run.result;
  return (
    <article>
      <div className="between">
        <div className="result-head" style={{ flex: 1, minWidth: 260 }}>
          <div className="kind">{run.kind === "memo" ? "Investment committee memo" : "What changed"}</div>
          <div className="headline">{r.headline}</div>
        </div>
        <div className="row no-print" style={{ gap: 6 }}>
          <a className="btn ghost sm" href={`/api/runs/${run.id}/docx`}>Word</a>
          <button className="btn ghost sm" onClick={() => window.print()}>PDF</button>
          <button className="btn ghost sm" onClick={() => copyText(fundName, run)}>Copy</button>
        </div>
      </div>
      <p style={{ color: "var(--ink2)", margin: "12px 0 6px" }}>{r.summary}</p>
      <div className="tiny muted" style={{ marginBottom: 8 }}>Sources: {run.doc_names.map(short).join(" · ")} · {fmtDate(run.created_at)}</div>

      {r.sections.map((s) => (
        <div key={s.heading} className="section">
          <h3>{s.heading}</h3>
          <p>{s.body}</p>
          <Cites cs={s.citations} open={open} />
        </div>
      ))}

      <div className="section" style={{ paddingBottom: 0 }}><p className="label" style={{ margin: 0 }}>{run.kind === "memo" ? "Key findings" : "Changes"}</p></div>
      {r.findings.map((f, i) => (
        <div key={i} className="finding">
          <span className={`sev ${f.severity}`}>{SEV_LABEL[f.severity] || f.severity}</span>
          <div><b>{f.topic}.</b> {f.finding}<Cites cs={f.citations} open={open} /></div>
        </div>
      ))}

      {r.questions.length > 0 && (
        <div className="section">
          <p className="label">{run.kind === "memo" ? "Questions for the manager" : "Questions for the next call"}</p>
          <ol className="qs">{r.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </div>
      )}
      {r.missing.length > 0 && (
        <div className="section">
          <p className="label">Not covered in the documents</p>
          <ul className="qs">{r.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      <div className="section between tiny muted">
        <span>Allocra informs the committee; it does not make investment recommendations. Click any citation to see the source page.</span>
        <button className="link-btn red no-print" onClick={onDelete}>Delete</button>
      </div>
    </article>
  );
}
