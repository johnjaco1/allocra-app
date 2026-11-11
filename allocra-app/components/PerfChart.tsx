"use client";
import { useEffect, useRef, useState } from "react";
import { fmtMetric, fmtPeriod } from "@/lib/client";
import { METRIC_LABEL, type Citation, type Metric, type MetricName } from "@/lib/types";

// One metric over time. Single series, so no legend; the title names it. Table view sits below in the Performance tab.
export default function PerfChart({ points, metric, open }: { points: Metric[]; metric: MetricName; open: (c: Citation) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, [metric]);
  const pts = points.filter((p) => p.name === metric && p.as_of).sort((a, b) => a.as_of.localeCompare(b.as_of));
  if (pts.length < 2) return <div ref={box}><div className="muted small" style={{ padding: "30px 0", textAlign: "center" }}>{pts.length ? "Only one reported period so far. Upload another letter to see the trend." : `No ${METRIC_LABEL[metric]} reported yet.`}</div></div>;

  const W = w, H = 240, x0 = 58, x1 = W - 26, y0 = 18, y1 = 200;
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.25 || Math.abs(hi) * 0.1 || 1;
  lo = Math.max(lo < 0 ? lo - pad : 0, lo - pad); hi = hi + pad;
  const X = (i: number) => x0 + (pts.length === 1 ? (x1 - x0) / 2 : (i / (pts.length - 1)) * (x1 - x0));
  const Y = (v: number) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join("");
  const h = hover != null ? pts[hover] : null;

  return (
    <div ref={box}><div className="chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${METRIC_LABEL[metric]} by reporting period`}>
        <g className="axis">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={x0} x2={x1} y1={Y(t)} y2={Y(t)} stroke="var(--rule)" strokeDasharray={i ? "2 4" : undefined} />
              <text x={x0 - 10} y={Y(t) + 4} textAnchor="end">{fmtMetric(metric, t)}</text>
            </g>
          ))}
          {pts.map((p, i) => <text key={p.as_of + i} x={X(i)} y={y1 + 24} textAnchor="middle">{fmtPeriod(p.as_of)}</text>)}
        </g>
        {h && <line x1={X(hover!)} x2={X(hover!)} y1={y0} y2={y1} stroke="var(--rule2)" />}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={X(i)} cy={Y(p.value)} r={hover === i ? 6 : 4.5} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
            {i === pts.length - 1 && <text x={X(i)} y={Y(p.value) - 12} textAnchor="middle" style={{ font: "600 12px var(--f-mono)", fill: "var(--ink)" }}>{fmtMetric(metric, p.value)}</text>}
            <rect x={X(i) - 30} y={y0} width={60} height={y1 - y0 + 30} fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)} onClick={() => open(p.citation)} />
          </g>
        ))}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(X(hover!) / W) * 100}%`, top: `${(Y(h.value) / H) * 100}%` }}>
          <b>{fmtMetric(metric, h.value)}</b> <span className="muted">· {fmtPeriod(h.as_of)}</span>
          <div className="tiny muted">Click for source</div>
        </div>
      )}
    </div></div>
  );
}
