"use client";
import { useRouter } from "next/navigation";
import { fmtMetric, fmtPeriod } from "@/lib/client";
import type { FundSummary } from "@/lib/types";

export default function PortfolioTable({ funds }: { funds: FundSummary[] }) {
  const router = useRouter();
  const firms = new Map<string, FundSummary[]>();
  for (const f of funds) firms.set(f.manager || "Other", [...(firms.get(f.manager || "Other") || []), f]);
  const groups = [...firms.entries()].sort((a, b) => (a[0] === "Other" ? 1 : b[0] === "Other" ? -1 : a[0].localeCompare(b[0])));
  return (
    <div className="card" style={{ padding: "4px 4px 0" }}>
      <div className="tablewrap">
        <table>
          <thead><tr>
            <th>Fund</th><th className="r">Vintage</th><th className="r">Net IRR</th><th className="r">TVPI</th><th className="r">DPI</th><th className="r">NAV</th><th>As of</th><th>Flags</th><th>Allocra&apos;s latest read</th>
          </tr></thead>
          <tbody>
            {groups.map(([firm, fs]) => [
              <tr key={firm} className="firm-row"><td colSpan={9}>{firm} <span className="muted" style={{ fontWeight: 400 }}>· {fs.length} fund{fs.length === 1 ? "" : "s"}</span></td></tr>,
              ...fs.map((f) => (
                <tr key={f.id} className="click" onClick={() => router.push(`/funds/${f.id}`)}>
                  <td><div className="fn">{f.name}{f.sample && <span className="tag" style={{ marginLeft: 8 }}>Sample</span>}</div><div className="fs">{f.strategy || ""}{f.strategy ? " · " : ""}{f.doc_count} docs</div></td>
                  <td className="r">{f.vintage || "—"}</td>
                  <td className="r">{fmtMetric("net_irr", f.latest.net_irr)}</td>
                  <td className="r">{fmtMetric("tvpi", f.latest.tvpi)}</td>
                  <td className="r">{fmtMetric("dpi", f.latest.dpi)}</td>
                  <td className="r">{fmtMetric("nav", f.latest.nav)}</td>
                  <td className="fs">{fmtPeriod(f.latest_as_of)}</td>
                  <td>{f.last_run ? <span className="pills"><span className="pill red">{f.last_run.red}</span><span className="pill amber">{f.last_run.amber}</span></span> : <span className="fs">Not run</span>}</td>
                  <td style={{ maxWidth: 360 }} className="small">{f.last_run?.headline || <span className="fs">Run Allocra to see the read.</span>}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
