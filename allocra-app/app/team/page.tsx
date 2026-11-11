"use client";
import { useEffect, useState } from "react";
import type { AuditEvent, Member } from "@/lib/types";

const ACTION: Record<string, string> = {
  "document.upload": "Uploaded", "document.delete": "Deleted document", "document.edit": "Edited document", "document.summarize": "Summarized",
  "analysis.memo": "Wrote IC memo", "analysis.changes": "Ran what changed", "figure.approve": "Approved figure", "figure.correct": "Corrected figure",
  "figure.reset": "Undid review", "fund.create": "Added fund", "fund.edit": "Edited fund", "fund.delete": "Deleted fund", "team.invite": "Added teammate",
  "data.delete_all": "Deleted all data",
};

function detail(e: AuditEvent) {
  const d = e.detail || {};
  if (e.action === "figure.correct") return `${d.metric} ${d.as_of || ""}: ${d.from} → ${d.to}`;
  if (e.action === "figure.approve") return `${d.metric} ${d.as_of || ""} = ${d.to}`;
  if (e.action === "document.summarize") return `${d.figures} figures${d.uncertain ? `, ${d.uncertain} uncertain` : ""}`;
  if (e.action === "document.upload" && d.fund) return `filed under ${d.fund}${d.new_fund ? " (new fund)" : ""}`;
  return "";
}

export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("member");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/team").then((r) => r.json()).then((j) => { setMembers(j.members || []); setOrg(j.org || ""); setRole(j.role || "member"); });
    fetch("/api/audit").then((r) => r.json()).then((j) => setEvents(j.events || []));
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setMsg("");
    const r = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setMembers(j.members); setMsg(`Added. ${email} joins your firm's workspace when they create an account with that email.`); setEmail("");
  }

  async function wipe() {
    if (!confirm("Permanently delete every fund, document and analysis for your firm? This can't be undone.")) return;
    if (prompt("Type DELETE to confirm") !== "DELETE") return;
    const r = await fetch("/api/account", { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "All of your firm's documents and analyses have been deleted." : j.error || "Couldn't delete. Try again.");
  }

  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <div><div className="crumb">{org}</div><h1>Team &amp; data</h1></div>
      <div className="card">
        <p className="label">Team</p>
        {members.map((m) => (
          <div key={m.email} className="team-row"><span>{m.email}</span><span className="muted">{m.pending ? "Invited" : m.role === "owner" ? "Owner" : "Member"}</span></div>
        ))}
        {role === "owner" ? (
          <form className="row" style={{ marginTop: 14, flexWrap: "nowrap" }} onSubmit={invite}>
            <input type="email" required placeholder="colleague@yourfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn">Add</button>
          </form>
        ) : <p className="tiny muted" style={{ marginBottom: 0 }}>Only your firm&apos;s owner can add teammates.</p>}
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        {msg && <div className="note" style={{ marginTop: 10 }}>{msg}</div>}
      </div>

      <div className="card" style={{ padding: "4px 4px 0" }}>
        <p className="label" style={{ margin: "14px 12px 4px" }}>Audit trail</p>
        <div className="tablewrap" style={{ maxHeight: 420, overflowY: "auto" }}>
          <table>
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="fs" style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td className="fs">{e.actor}</td>
                  <td><b style={{ fontWeight: 600 }}>{ACTION[e.action] || e.action}</b> <span className="small">{e.target.length > 40 && /^[0-9a-f-]{36}$/.test(e.target) ? "" : e.target}</span></td>
                  <td className="fs">{detail(e)}</td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan={4} className="muted small">No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <p className="label">Security and data handling</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, color: "var(--ink2)", display: "grid", gap: 4 }}>
          <li>Files are read in your browser. Only extracted text reaches Allocra, and the original file is never uploaded.</li>
          <li>Each firm is a separate workspace. Database rules stop anyone from reading another firm&apos;s data.</li>
          <li>Encrypted in transit (HTTPS) and at rest (Supabase).</li>
          <li>Analysis runs through Anthropic&apos;s commercial API, which does not train on your data.</li>
          <li>Every upload, analysis, approval and correction is logged above. Corrections keep the original value.</li>
          <li>Owners control teammates and deletion. Deleting a document, fund or all data removes it permanently.</li>
          <li>On the roadmap: SSO, retention schedules, SOC 2 Type II.</li>
        </ul>
        {role === "owner" && <button className="btn danger" style={{ marginTop: 16 }} onClick={wipe}>Delete all of my firm&apos;s data</button>}
      </div>
    </main>
  );
}
