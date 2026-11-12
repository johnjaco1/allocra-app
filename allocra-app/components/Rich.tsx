"use client";
import { parseBlocks, parseInline, type Inline } from "@/lib/rich";
import type { Citation } from "@/lib/types";

const shortDoc = (n: string) => n.replace(/\.(pdf|docx?|xlsx|csv|txt|md)$/i, "");

function Num({ v, cite, open }: { v: string; cite: Citation; open?: (c: Citation) => void }) {
  return (
    <span className="num-link" tabIndex={0} role="button" aria-label={`${v}, source: ${cite.doc} page ${cite.page}`}
      onClick={(e) => { e.stopPropagation(); open?.(cite); }} onKeyDown={(e) => { if (e.key === "Enter") open?.(cite); }}>
      {v}
      <span className="pop" role="tooltip">
        <span className="pop-src">{shortDoc(cite.doc)} · p.{cite.page}</span>
        <span className="pop-q">“{cite.quote}”</span>
        {open && <span className="pop-go">Click to open the page</span>}
      </span>
    </span>
  );
}

function Inlines({ xs, open }: { xs: Inline[]; open?: (c: Citation) => void }) {
  return <>{xs.map((x, i) => {
    if (x.t === "text") return <span key={i}>{x.v}</span>;
    if (x.t === "num") return <Num key={i} v={x.v} cite={x.cite} open={open} />;
    if (x.t === "bold") return <b key={i}><Inlines xs={x.v} open={open} /></b>;
    return <span key={i} className={"tone " + x.tone}>{x.tone === "good" ? "▲ " : "▼ "}<Inlines xs={x.v} open={open} /></span>;
  })}</>;
}

// Inline text (one line, no paragraphs). Numbers that appear in a citation's quote become source links.
export function RichLine({ text, cites = [], open }: { text: string; cites?: Citation[]; open?: (c: Citation) => void }) {
  return <Inlines xs={parseInline(String(text || ""), cites)} open={open} />;
}

// Multi-line text with paragraphs and bullet lists.
export default function Rich({ text, cites = [], open, className }: { text: string; cites?: Citation[]; open?: (c: Citation) => void; className?: string }) {
  const blocks = parseBlocks(text, cites);
  return (
    <div className={"rich " + (className || "")}>
      {blocks.map((b, i) => b.t === "p"
        ? <p key={i}><Inlines xs={b.v} open={open} /></p>
        : <ul key={i}>{b.items.map((it, j) => <li key={j}><Inlines xs={it} open={open} /></li>)}</ul>)}
    </div>
  );
}
