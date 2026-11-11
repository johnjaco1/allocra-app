"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { Logo } from "@/components/Rail";

export default function Reset() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    location.href = "/";
  }
  return (
    <main className="auth">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}><Logo /></div>
      <form className="card stack" onSubmit={submit}>
        <h2>Choose a new password</h2>
        <label className="field"><span>New password</span><input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </main>
  );
}
