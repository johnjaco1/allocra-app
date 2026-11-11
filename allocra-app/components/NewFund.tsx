"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { ASSET_CLASSES } from "@/lib/types";

export default function NewFund({ sampleOnly, big }: { sampleOnly?: boolean; big?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ manager: "", name: "", asset_class: "", strategy: "", vintage: "", commitment: "" });

  async function create(body: object, go: boolean) {
    setBusy(true); setErr("");
    try {
      const { fund } = await api<{ fund: { id: string } }>("/api/funds", { method: "POST", body: JSON.stringify(body) });
      setOpen(false);
      if (go) router.push(`/funds/${fund.id}`);
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (sampleOnly) return (
    <div style={big ? { display: "flex", justifyContent: "center" } : undefined}>
      <button className="btn ghost" disabled={busy} onClick={() => create({ sample: true }, false)}>{busy ? "Loading…" : "Load sample funds"}</button>
    </div>
  );
  if (!open) return <button className="btn ghost" onClick={() => setOpen(true)}>Add fund</button>;

  return (
    <>
      <div className="scrim" onClick={() => setOpen(false)} />
      <form className="card" style={{ position: "fixed", zIndex: 52, top: "18vh", left: "50%", transform: "translateX(-50%)", width: "min(480px, calc(100% - 32px))", boxShadow: "0 20px 50px rgba(17,26,34,.2)" }}
        onSubmit={(e) => { e.preventDefault(); create(form, true); }}>
        <div className="stack">
          <h2>Add a fund</h2>
          <label className="field"><span>Firm (GP)</span><input type="text" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="e.g. Acme Capital" /></label>
          <label className="field"><span>Fund name</span><input type="text" autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Growth Partners IV" /></label>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 1 }}><span>Asset class</span><select value={form.asset_class} onChange={(e) => setForm({ ...form, asset_class: e.target.value })}><option value="">Choose</option>{ASSET_CLASSES.map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="field" style={{ flex: 1 }}><span>Your commitment ($M)</span><input type="number" step="any" value={form.commitment} onChange={(e) => setForm({ ...form, commitment: e.target.value })} placeholder="25" /></label>
          </div>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <label className="field" style={{ flex: 2 }}><span>Strategy</span><input type="text" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} placeholder="Direct lending" /></label>
            <label className="field" style={{ flex: 1 }}><span>Vintage</span><input type="number" value={form.vintage} onChange={(e) => setForm({ ...form, vintage: e.target.value })} placeholder="2026" /></label>
          </div>
          {err && <div className="err">{err}</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create fund"}</button>
          </div>
        </div>
      </form>
    </>
  );
}
