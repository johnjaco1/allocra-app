"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, short } from "@/lib/client";
import type { Citation } from "@/lib/types";
import SourceDrawer from "./SourceDrawer";

type Ref = Citation & { fund: string; fund_id: string | null; doc_id: string | null };
type Msg = { role: "user" | "assistant"; text: string; refs?: Ref[]; error?: boolean };

const KEY = "allocra-chat";
const load = (): Msg[] => { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; } };
const save = (m: Msg[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(m.slice(-40))); } catch { /* storage unavailable */ } };

function Formatted({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{l}</li>)}</ul>); list = []; } };
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (/^[-•*]\s+/.test(t)) list.push(t.replace(/^[-•*]\s+/, ""));
    else { flush(); if (t) blocks.push(<p key={blocks.length}>{t}</p>); }
  }
  flush();
  return <>{blocks}</>;
}

export default function Chat({ fundNames }: { fundNames: Record<string, string> }) {
  const path = usePathname();
  const fundHere = path.startsWith("/funds/") ? path.split("/")[2] : null;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);
  const [source, setSource] = useState<Ref | null>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => { setMsgs(load()); }, []);
  useEffect(() => { save(msgs); body.current?.scrollTo({ top: body.current.scrollHeight }); }, [msgs, open]);
  useEffect(() => { setScopeAll(false); }, [fundHere]);

  const fundName = fundHere ? fundNames[fundHere] : null;
  const scopeFund = fundHere && !scopeAll ? fundHere : null;
  const suggestions = scopeFund
    ? ["What are the biggest risks with this fund?", "What changed since last quarter?", "How has performance trended?", "What should we ask the manager on the next call?"]
    : ["Which funds need attention right now?", "Where have we seen team or key-person changes?", "Which funds are drifting from their stated strategy?", "Compare net IRR and DPI across the book."];

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]); setQ(""); setBusy(true);
    try {
      const r = await api<{ answer: string; refs: Ref[] }>("/api/chat", { method: "POST", body: JSON.stringify({ question, history, fundId: scopeFund }) });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, refs: r.refs }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally { setBusy(false); }
  }

  if (!open) return <button className="fab" onClick={() => setOpen(true)}><span className="ai-av" style={{ width: 22, height: 22 }}>A</span>Ask Allocra</button>;

  return (
    <>
      <section className="chat" aria-label="Ask Allocra">
        <div className="chat-h">
          <div className="row" style={{ gap: 8, minWidth: 0 }}>
            <span className="ai-av">A</span>
            <div style={{ minWidth: 0 }}>
              <b>Ask Allocra</b>
              <div className="tiny muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scopeFund ? `About ${fundName || "this fund"}` : "About your whole portfolio"}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
            {fundHere && (
              <div className="seg">
                <button className={!scopeAll ? "on" : ""} onClick={() => setScopeAll(false)}>This fund</button>
                <button className={scopeAll ? "on" : ""} onClick={() => setScopeAll(true)}>All</button>
              </div>
            )}
            {msgs.length > 0 && <button className="link-btn tiny" onClick={() => setMsgs([])}>Clear</button>}
            <button className="x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
          </div>
        </div>
        <div className="chat-b" ref={body}>
          {msgs.length === 0 && (
            <div>
              <p className="small muted" style={{ margin: 0 }}>Ask about any firm, fund, document or analysis. Allocra answers from your documents and its own memos, change reports and summaries, and cites the page.</p>
              <div className="suggest">{suggestions.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>
            </div>
          )}
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="msg-u">{m.text}</div>
          ) : (
            <div key={i} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 9 }}>
              <span className="ai-av">A</span>
              <div className="msg-a" style={m.error ? { color: "var(--crit)" } : undefined}>
                <Formatted text={m.text} />
                {!!m.refs?.length && (
                  <div className="cites">
                    {m.refs.map((r, j) => (
                      <button key={j} className={"cite" + (r.verified === false ? " bad" : "")} disabled={!r.doc_id} onClick={() => setSource(r)} title={r.quote}>
                        {short(r.doc)} p.{r.page}{r.verified === false ? " ⚠" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="row small muted" style={{ gap: 8 }}><span className="spinner" />Reading {scopeFund ? "this fund's documents" : "your portfolio"}…</div>}
        </div>
        <form className="chat-f" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <textarea value={q} rows={1} placeholder={scopeFund ? `Ask about ${fundName || "this fund"}…` : "Ask about your portfolio…"} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }} />
          <button className="btn" disabled={busy || !q.trim()}>Ask</button>
        </form>
      </section>
      {source && <SourceDrawer cite={source} docId={source.doc_id || undefined} onClose={() => setSource(null)} />}
    </>
  );
}
