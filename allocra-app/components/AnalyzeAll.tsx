"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, fullAnalysis } from "@/lib/client";
import type { DocMeta } from "@/lib/types";

// Runs the full analysis on every fund in the book, one after another.
export default function AnalyzeAll({ funds }: { funds: { id: string; name: string }[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  async function go() {
    let fails = 0;
    for (let i = 0; i < funds.length; i++) {
      const f = funds[i];
      setStatus(`${i + 1}/${funds.length} · ${f.name}`);
      try {
        const { docs } = await api<{ docs: DocMeta[] }>(`/api/funds/${f.id}`);
        if (!docs.length) continue;
        await fullAnalysis(f.id, docs, (steps) => { fails += 0; void steps; });
      } catch { fails++; }
      router.refresh();
    }
    setStatus(fails ? `${fails} fund(s) had errors. Open them to retry.` : null);
    router.refresh();
  }
  const busy = !!status && !status.includes("errors");
  return (
    <div className="row" style={{ gap: 8 }}>
      {status && <span className="small muted row" style={{ gap: 6 }}>{busy && <span className="spinner" style={{ width: 14, height: 14 }} />}{status}</span>}
      <button className="btn" disabled={busy} onClick={go}>{busy ? "Analyzing…" : "Run Allocra on all funds"}</button>
    </div>
  );
}
