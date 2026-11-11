"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { Logo } from "@/components/Rail";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export default function Login() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  if (!URL_ || !KEY) return (
    <main className="auth">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}><Logo /></div>
      <div className="card stack"><h2>Accounts aren&apos;t set up yet</h2><p className="muted small" style={{ margin: 0 }}>Add your Supabase keys to turn on log in (see the README). Until then Allocra runs without accounts on this computer.</p><a className="btn" href="/">Open Allocra</a></div>
    </main>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setNote("");
    const sb = createBrowserClient(URL_, KEY);
    if (mode === "forgot") {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset` });
      setBusy(false);
      return error ? setErr(error.message) : setNote("If that email has an account, a reset link is on its way.");
    }
    const res = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    if (mode === "up" && !res.data.session) return setNote("Check your email to confirm your account, then log in.");
    location.href = "/";
  }

  const title = { in: "Log in", up: "Create your account", forgot: "Reset your password" }[mode];
  return (
    <main className="auth">
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}><Logo /></div>
      <form className="card stack" onSubmit={submit}>
        <div>
          <h2>{title}</h2>
          <p className="muted small" style={{ margin: "6px 0 0" }}>Allocra reads your DDQs and quarterly letters so you don&apos;t have to.</p>
        </div>
        <label className="field"><span>Work email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== "forgot" && <label className="field"><span>Password</span><input type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        {err && <div className="err">{err}</div>}
        {note && <div className="note">{note}</div>}
        <button className="btn" disabled={busy}>{busy ? "One moment…" : mode === "in" ? "Log in" : mode === "up" ? "Create account" : "Send reset link"}</button>
        <div className="small muted" style={{ textAlign: "center", display: "grid", gap: 6 }}>
          {mode === "in" && <><span>New to Allocra? <button type="button" className="link-btn" onClick={() => setMode("up")}>Create an account</button></span>
            <button type="button" className="link-btn" onClick={() => setMode("forgot")}>Forgot password?</button></>}
          {mode !== "in" && <span>Have an account? <button type="button" className="link-btn" onClick={() => setMode("in")}>Log in</button></span>}
        </div>
      </form>
      <p className="tiny muted" style={{ textAlign: "center", marginTop: 14 }}>Your documents are private to your firm, never used to train AI, and deleted on request.</p>
    </main>
  );
}
