"use client";
import Link from "next/link";
import { useState } from "react";
import { fmtDate, fmtMetric, fmtPeriod, short } from "@/lib/client";
import type { Intelligence } from "@/lib/alerts";
import type { Citation } from "@/lib/types";
import SourceDrawer from "./SourceDrawer";

const $ = (v: number) => fmtMetric("nav", v);

export default function Dashboard({ intel, docIndex }: { intel: Intelligence; docIndex: Record<string, string> }) {
  const [source, setSource] = useState<(Citation & { fund_id: string }) | null>(null);
  const [all, setAll] = useState(false);
  const t = intel.totals;
  const shown = all ? intel.alerts : intel.alerts.slice(0, 6);
  const maxC = Math.max(1, ...intel.byClass.map((x) => x.value));
  const maxV = Math.max(1, ...intel.byVintage.map((x) => x.value));

  return (
    <div className="stack">
      <div className="card intel">
        <div className="between" style={{ alignItems: "baseline" }}>
          <div>
            <p className="label" style={{ margin: 0 }}>Quarterly portfolio intelligence</p>
            <h2 style={{ marginTop: 4 }}>{intel.period ? `${fmtPeriod(intel.period)} · manager reporting analysis` : "Manager reporting analysis"}</h2>
          </div>
          {intel.toReview > 0 && <span className="tag warn-tag">{intel.toReview} figure{intel.toReview === 1 ? "" : "s"} awaiting review</span>}
        </div>
        <div className="stats" style={{ margin: "16px 0 6px" }}>
          <div className="stat-in"><b>{intel.reporting}/{intel.total}</b><span>Managers reporting</span></div>
          <div className="stat-in"><b>{intel.material}</b><span>Material changes</span></div>
          <div className="stat-in red"><b>{intel.concerns}</b><span>Potential concerns</span></div>
          <div className="stat-in"><b>{intel.memos}</b><span>Memos drafted</span></div>
        </div>
        <p className="label" style={{ marginTop: 18 }}>Important developments</p>
        {intel.alerts.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nothing flagged. Run Allocra on your funds to check the latest reports.</p>}
        {shown.map((a, i) => (
          <div key={i} className="alert">
            <span className={"sev " + (a.severity === "high" ? "red" : "amber")}>{a.severity === "high" ? "High" : "Medium"}</span>
            <div style={{ minWidth: 0 }}>
              <div><Link href={`/funds/${a.fund_id}`} className="fn" style={{ color: "var(--ink)" }}>{a.fund}</Link><span className="muted">: </span><b>{a.title}</b></div>
              <div className="small" style={{ color: "var(--ink2)", marginTop: 2 }}>{a.detail}</div>
              <div className="cites">
                <span className={"basis " + a.basis}>{a.basis === "figure" ? "From reported figures" : "AI interpretation"}</span>
                {a.citations.map((c, j) => (
                  <button key={j} className={"cite" + (c.verified === false ? " bad" : "")} onClick={() => setSource({ ...c, fund_id: a.fund_id })}>{short(c.doc)} p.{c.page}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {intel.alerts.length > 6 && <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${intel.alerts.length}`}</button>}
      </div>

      <div className="totals">
        <div className="card stat"><b>{$(t.committed)}</b><span>Committed</span></div>
        <div className="card stat"><b>{$(t.paid_in)}</b><span>Called (paid in)</span></div>
        <div className="card stat"><b>{$(t.distributed)}</b><span>Distributed</span></div>
        <div className="card stat"><b>{$(t.unfunded)}</b><span>Unfunded</span></div>
        <div className="card stat"><b>{$(t.nav)}</b><span>Your NAV{t.funds_with_statements < intel.total ? ` · ${t.funds_with_statements}/${intel.total} funds with statements` : ""}</span></div>
      </div>

      <div className="grid3">
        <div className="card">
          <p className="label">Exposure by asset class</p>
          {intel.byClass.map((x) => (
            <div key={x.key} className="bar-row"><span className="bar-k">{x.key}</span><span className="bar-t"><span className="bar-v" style={{ width: `${Math.max(3, (x.value / maxC) * 100)}%` }} /></span><span className="bar-n">{$(x.value)}</span></div>
          ))}
        </div>
        <div className="card">
          <p className="label">Exposure by vintage</p>
          {intel.byVintage.length ? intel.byVintage.map((x) => (
            <div key={x.key} className="bar-row"><span className="bar-k">{x.key}</span><span className="bar-t"><span className="bar-v" style={{ width: `${Math.max(3, (x.value / maxV) * 100)}%` }} /></span><span className="bar-n">{$(x.value)}</span></div>
          )) : <p className="muted small" style={{ margin: 0 }}>Add vintages to your funds.</p>}
          <p className="tiny muted" style={{ margin: "10px 0 0" }}>Your capital balance where a statement exists, otherwise your commitment.</p>
        </div>
        <div className="card">
          <p className="label">Upcoming cash flows</p>
          {intel.upcoming.length ? intel.upcoming.slice(0, 6).map((c, i) => (
            <div key={i} className="flow">
              <span className={"flow-k " + c.kind}>{c.kind === "call" ? "Call" : "Dist."}</span>
              <span style={{ flex: 1, minWidth: 0 }}><Link href={`/funds/${c.fund_id}`} style={{ color: "var(--ink)" }}>{c.fund}</Link><div className="tiny muted">{fmtDate(c.date)}</div></span>
              <button className="vbtn num" onClick={() => setSource({ ...c.citation, fund_id: c.fund_id })}>{c.kind === "call" ? "−" : "+"}{$(c.amount)}</button>
            </div>
          )) : <p className="muted small" style={{ margin: 0 }}>Drop capital call and distribution notices to see what&apos;s coming.</p>}
        </div>
      </div>
      {source && <SourceDrawer cite={source} docId={docIndex[source.fund_id + "|" + source.doc]} onClose={() => setSource(null)} />}
    </div>
  );
}
