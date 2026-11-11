"use client";
import { useEffect, useRef, useState } from "react";
import { METRIC_LABEL, type Citation, type Doc, type Metric } from "@/lib/types";
import { api, fmtMetric, fmtPeriod } from "@/lib/client";

// Finds the quote in the page text (ignoring case, spacing and curly quotes) and wraps it in <mark>.
function highlight(text: string, quote: string) {
  const simplify = (ch: string) => ch.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  let flat = ""; const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = /\s/.test(text[i]) ? " " : simplify(text[i]);
    if (c === " " && flat.endsWith(" ")) continue;
    flat += c; map.push(i);
  }
  const q = quote.trim().split("").map((c) => (/\s/.test(c) ? " " : simplify(c))).join("").replace(/ +/g, " ");
  const at = q ? flat.indexOf(q) : -1;
  if (at < 0) return { parts: [text], found: false };
  const s = map[at], e = map[at + q.length - 1] + 1;
  return { parts: [text.slice(0, s), text.slice(s, e), text.slice(e)], found: true };
}

export type FigureRef = { docId: string; index: number; metric: Metric };

// Shows the source page. When opened from a figure, also lets a person approve or correct it.
export default function SourceDrawer({ cite, docId, onClose, figure, onFigure }: {
  cite: Citation; docId?: string; onClose: () => void; figure?: FigureRef; onFigure?: (m: Metric) => void;
}) {
  const [fig, setFig] = useState<Metric | null>(figure?.metric || null);
  const [val, setVal] = useState("");
  const [ferr, setFerr] = useState("");
  async function review(action: "approve" | "correct" | "reset") {
    if (!figure) return;
    setFerr("");
    try {
      const { metric } = await api<{ metric: Metric }>(`/api/docs/${figure.docId}/metric`, { method: "PATCH", body: JSON.stringify({ index: figure.index, action, value: val }) });
      setFig(metric); setVal(""); onFigure?.(metric);
    } catch (e) { setFerr((e as Error).message); }
  }
  const [doc, setDoc] = useState<Doc | null>(null);
  const [err, setErr] = useState("");
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!docId) { setErr("This document has been deleted."); return; }
    fetch(`/api/docs/${docId}`).then((r) => r.json()).then((j) => (j.doc ? setDoc(j.doc) : setErr(j.error || "Not found.")));
  }, [docId]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  useEffect(() => { markRef.current?.scrollIntoView({ block: "center" }); }, [doc]);

  const page = doc?.pages[cite.page - 1] ?? "";
  const h = doc ? highlight(page, cite.quote) : null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Source page">
        <div className="drawer-h">
          <div>
            <div className="label" style={{ margin: 0 }}>Source</div>
            <b>{cite.doc}</b>
            <div className="small muted">Page {cite.page}{doc ? ` of ${doc.pages.length}` : ""}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {fig && (
          <div className="review">
            <div className="between" style={{ alignItems: "center" }}>
              <div>
                <div className="tiny muted">{METRIC_LABEL[fig.name]} · {fmtPeriod(fig.as_of)}</div>
                <b style={{ fontSize: 20, fontFamily: "var(--f-display)", fontWeight: 400 }}>{fmtMetric(fig.name, fig.value)}</b>
                {fig.original != null && <span className="tiny muted"> (extracted {fmtMetric(fig.name, fig.original)})</span>}
              </div>
              <span className={"tag " + (fig.status === "uncertain" ? "warn-tag" : "")}>
                {fig.status === "uncertain" ? "Uncertain: quote not found" : fig.status === "approved" ? "Approved" : fig.status === "corrected" ? "Corrected" : "Quote matched · not yet reviewed"}
              </span>
            </div>
            {fig.reviewed_by && <div className="tiny muted" style={{ marginTop: 4 }}>{fig.status === "corrected" ? "Corrected" : "Approved"} by {fig.reviewed_by} · {new Date(fig.reviewed_at!).toLocaleString()}</div>}
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "nowrap" }}>
              {fig.status !== "approved" && fig.status !== "corrected" && <button className="btn sm" onClick={() => review("approve")}>Approve</button>}
              <input type="number" step="any" placeholder="Correct value" value={val} onChange={(e) => setVal(e.target.value)} style={{ maxWidth: 140, padding: "5px 8px" }} />
              <button className="btn ghost sm" disabled={!val} onClick={() => review("correct")}>Save correction</button>
              {(fig.status === "approved" || fig.status === "corrected") && <button className="link-btn tiny" onClick={() => review("reset")}>Undo review</button>}
            </div>
            {ferr && <div className="err" style={{ marginTop: 8 }}>{ferr}</div>}
          </div>
        )}
        <div className="drawer-b">
          {err && <div className="err">{err}</div>}
          {!doc && !err && <div className="spinner" />}
          {h && !h.found && cite.verified === false && <div className="note" style={{ marginBottom: 14 }}>Allocra quoted: “{cite.quote}”. That exact text wasn&apos;t found on this page, so check it before relying on it.</div>}
          {h && (
            <div className="page-text">
              {h.parts.length === 3 ? <>{h.parts[0]}<mark ref={markRef}>{h.parts[1]}</mark>{h.parts[2]}</> : h.parts[0]}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
