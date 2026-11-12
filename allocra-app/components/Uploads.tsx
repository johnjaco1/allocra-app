"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, short } from "@/lib/client";
import { extractPages, guessType } from "@/lib/extract";
import type { DocMeta } from "@/lib/types";
import { plain } from "@/lib/rich";

type Item = {
  key: string; name: string;
  state: "reading" | "filing" | "summarizing" | "done" | "fail";
  fund?: { id: string; name: string; manager: string | null }; created?: boolean;
  summary?: string; error?: string; note?: string;
};
type Ctx = { addFiles: (files: FileList | File[], fundId?: string) => void; pick: (fundId?: string) => void };
const UploadCtx = createContext<Ctx>({ addFiles: () => {}, pick: () => {} });
export const useUploads = () => useContext(UploadCtx);

const ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,.md";

// Drop documents anywhere. On a fund page they go into that fund; anywhere else Allocra files each one
// under the right firm and fund. Every document is then summarized and its performance figures pulled out.
export default function Uploads({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | undefined>(undefined);
  const queue = useRef(Promise.resolve());
  const fundHere = path.startsWith("/funds/") ? path.split("/")[2] : undefined;

  const upd = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const one = useCallback(async (file: File, key: string, fundId?: string) => {
    try {
      const pages = await extractPages(file, (msg) => upd(key, { note: msg }));
      upd(key, { note: undefined });
      upd(key, { state: "filing" });
      let doc: DocMeta;
      if (fundId) {
        const r = await api<{ doc: DocMeta }>(`/api/funds/${fundId}/docs`, { method: "POST", body: JSON.stringify({ name: file.name, doc_type: guessType(file.name), pages }) });
        doc = r.doc;
        upd(key, { state: "summarizing" });
      } else {
        const r = await api<{ doc: DocMeta; fund: Item["fund"]; created: boolean }>("/api/inbox", { method: "POST", body: JSON.stringify({ name: file.name, pages }) });
        doc = r.doc;
        upd(key, { state: "summarizing", fund: r.fund, created: r.created });
      }
      router.refresh();
      try {
        const { doc: d } = await api<{ doc: DocMeta }>(`/api/docs/${doc.id}/analyze`, { method: "POST" });
        upd(key, { state: "done", summary: d.ai?.summary });
      } catch (e) { upd(key, { state: "done", error: (e as Error).message }); }
      router.refresh();
    } catch (e) { upd(key, { state: "fail", error: (e as Error).message }); }
  }, [router]);

  const addFiles = useCallback((files: FileList | File[], fundId?: string) => {
    const list = Array.from(files).filter((f) => /\.(pdf|docx|xlsx|csv|txt|md)$/i.test(f.name));
    if (!list.length) return;
    const fresh = list.map((f) => ({ key: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, name: f.name, state: "reading" as const }));
    setItems((xs) => [...fresh, ...xs].slice(0, 30));
    list.forEach((f, i) => {
      // two at a time keeps things quick without hammering the API
      if (i % 2 === 0) queue.current = queue.current.then(() => Promise.all(list.slice(i, i + 2).map((g, j) => one(g, fresh[i + j].key, fundId))).then(() => {}));
    });
  }, [one]);

  const pick = useCallback((fundId?: string) => { target.current = fundId; input.current?.click(); }, []);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setOver(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); };
    const dragover = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth.current = 0; setOver(false);
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files, fundHere);
    };
    window.addEventListener("dragenter", enter); window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", dragover); window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave); window.removeEventListener("dragover", dragover); window.removeEventListener("drop", drop); };
  }, [addFiles, fundHere]);

  const busy = items.some((i) => !["done", "fail"].includes(i.state));
  const label = { reading: "Reading", filing: "Filing", summarizing: "Summarizing", done: "", fail: "" };

  return (
    <UploadCtx.Provider value={{ addFiles, pick }}>
      {children}
      <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { if (e.target.files) addFiles(e.target.files, target.current); e.target.value = ""; }} />
      {over && (
        <div className="drop-overlay">
          <div className="drop-card">
            <div className="drop-ic">↓</div>
            <h2>{fundHere ? "Drop to add to this fund" : "Drop to file and summarize"}</h2>
            <p className="muted">{fundHere ? "Allocra summarizes each document and pulls out its performance figures." : "Allocra works out the firm and fund for each document, files it, and summarizes it."}</p>
            <p className="tiny muted">PDF, Word, Excel, CSV or TXT · read in your browser, only the text is sent</p>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="tray" role="status">
          <div className="tray-h">
            <b>{busy ? `Processing ${items.filter((i) => !["done", "fail"].includes(i.state)).length} document(s)…` : "Documents processed"}</b>
            {!busy && <button className="x" aria-label="Close" onClick={() => setItems([])}>×</button>}
          </div>
          <div className="tray-b">
            {items.map((it) => (
              <div key={it.key} className="tray-item">
                <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                  {it.state === "done" ? <span className="check">✓</span> : it.state === "fail" ? <span className="check bad">!</span> : <span className="spinner" style={{ width: 15, height: 15 }} />}
                  <b className="tray-name">{short(it.name)}</b>
                  <span className="tiny muted" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{it.state === "reading" && it.note ? it.note : label[it.state]}</span>
                </div>
                {it.fund && <div className="tiny muted" style={{ marginLeft: 23 }}>→ {it.fund.manager ? `${it.fund.manager} › ` : ""}<Link href={`/funds/${it.fund.id}`}>{it.fund.name}</Link>{it.created ? " (new fund)" : ""}</div>}
                {it.summary && <div className="tray-sum">{plain(it.summary)}</div>}
                {it.error && <div className="tiny" style={{ color: "var(--crit)", marginLeft: 23 }}>{it.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </UploadCtx.Provider>
  );
}
