"use client";
import { METRIC_UNIT, type DocMeta, type MetricName, type Run } from "./types";

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong.");
  return j as T;
}

export const short = (n: string) => n.replace(/\.(pdf|docx?|txt|md)$/i, "");
export const fmtDate = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtPeriod = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  const q = Math.floor(dt.getMonth() / 3) + 1;
  return [3, 6, 9, 12].includes(dt.getMonth() + 1) && dt.getDate() >= 28 ? `Q${q} ${dt.getFullYear()}` : fmtDate(d);
};
export function fmtMetric(name: MetricName, v: number | undefined | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  const u = METRIC_UNIT[name];
  if (u === "pct") return `${v.toFixed(1)}%`;
  if (u === "x") return `${v.toFixed(2)}x`;
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : v >= 100 ? `$${Math.round(v)}M` : `$${v.toFixed(1)}M`;
}

export type Step = { id: string; label: string; state: "todo" | "doing" | "done" | "fail"; error?: string };

const MEMO_TYPES = ["DDQ", "PPM / LPA", "Pitch deck"];

// Runs everything Allocra does on a fund: summarize each document, write the memo, find what changed.
export async function fullAnalysis(
  fundId: string, docs: DocMeta[], onUpdate: (steps: Step[], docs: DocMeta[], run?: Run) => void, opts: { force?: boolean } = {},
) {
  let ds = [...docs];
  const todo = ds.filter((d) => opts.force || !d.ai);
  const steps: Step[] = [
    ...todo.map((d) => ({ id: d.id, label: `Summarize ${short(d.name)}`, state: "todo" as const })),
    { id: "memo", label: "Write IC memo", state: "todo" },
    { id: "changes", label: "Find what changed", state: "todo" },
  ];
  const set = (id: string, state: Step["state"], error?: string, run?: Run) => {
    const s = steps.find((x) => x.id === id); if (s) { s.state = state; s.error = error; }
    onUpdate(steps.map((x) => ({ ...x })), ds, run);
  };
  for (const d of todo) {
    set(d.id, "doing");
    try {
      const { doc } = await api<{ doc: DocMeta }>(`/api/docs/${d.id}/analyze`, { method: "POST" });
      ds = ds.map((x) => (x.id === d.id ? doc : x));
      set(d.id, "done");
    } catch (e) { set(d.id, "fail", (e as Error).message); }
  }
  const wantMemo = ds.some((d) => MEMO_TYPES.includes(d.doc_type));
  const wantChanges = ds.length >= 2;
  for (const kind of ["memo", "changes"] as const) {
    const want = kind === "memo" ? wantMemo : wantChanges;
    if (!want) {
      const i = steps.findIndex((x) => x.id === kind); steps.splice(i, 1); onUpdate(steps.map((x) => ({ ...x })), ds); continue;
    }
    set(kind, "doing");
    try {
      const { run } = await api<{ run: Run }>(`/api/funds/${fundId}/run`, { method: "POST", body: JSON.stringify({ kind }) });
      set(kind, "done", undefined, run);
    } catch (e) { set(kind, "fail", (e as Error).message); }
  }
  return ds;
}
