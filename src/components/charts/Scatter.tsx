"use client";

import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { stats, shortName, type Puma } from "@/lib/data";
import { METRICS, fmtMetric, value, type MetricKey } from "@/lib/metrics";
import { ols, pearson } from "@/lib/stats";
import { BORO_COLORS } from "./TrendChart";

type Props = {
  xKey: MetricKey;
  yKey: MetricKey;
  highlight?: string[]; // PUMA ids on the current line
  selected?: string | null;
  onSelect?: (puma: string) => void;
  accent: string;
};

/** All 55 neighborhoods, two variables, an OLS fit and Pearson's r. */
export default function Scatter({ xKey, yKey, highlight = [], selected, onSelect, accent }: Props) {
  const [hover, setHover] = useState<Puma | null>(null);
  const pts = stats.pumas.filter((p) => value(p, xKey) != null && value(p, yKey) != null);
  const xs = pts.map((p) => value(p, xKey) as number);
  const ys = pts.map((p) => value(p, yKey) as number);
  const r = pearson(xs, ys);
  const fit = ols(xs, ys);

  const W = 560,
    H = 380,
    m = { t: 16, r: 16, b: 46, l: 58 };
  const x = scaleLinear()
    .domain([Math.min(...xs), Math.max(...xs)])
    .nice()
    .range([m.l, W - m.r]);
  const y = scaleLinear()
    .domain([Math.min(...ys), Math.max(...ys)])
    .nice()
    .range([H - m.b, m.t]);
  const [x0, x1] = x.domain();

  return (
    <figure className="scatter">
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${METRICS[yKey].label} vs ${METRICS[xKey].label}`}>
          {y.ticks(5).map((t) => (
            <g key={`y${t}`}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#0000000f" />
              <text x={m.l - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)">
                {fmtMetric(yKey, t)}
              </text>
            </g>
          ))}
          {x.ticks(5).map((t) => (
            <text key={`x${t}`} x={x(t)} y={H - m.b + 18} fontSize={11} textAnchor="middle" fill="var(--muted)">
              {fmtMetric(xKey, t)}
            </text>
          ))}
          <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--ink)">
            {METRICS[xKey].label} →
          </text>
          <text
            transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={12}
            fill="var(--ink)"
          >
            {METRICS[yKey].label} →
          </text>
          {fit && (
            <line
              x1={x(x0)}
              x2={x(x1)}
              y1={y(fit.a + fit.b * x0)}
              y2={y(fit.a + fit.b * x1)}
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.6}
            />
          )}
          {pts.map((p) => {
            const on = highlight.includes(p.puma);
            const sel = p.puma === selected;
            return (
              <g key={p.puma}>
                <circle
                  cx={x(value(p, xKey) as number)}
                  cy={y(value(p, yKey) as number)}
                  r={sel ? 9 : on ? 7 : 5}
                  fill={on || sel ? accent : BORO_COLORS[p.borough]}
                  fillOpacity={on || sel ? 1 : 0.55}
                  stroke={sel ? "var(--ink)" : "#fff"}
                  strokeWidth={sel ? 2.5 : 1.5}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelect?.(p.puma)}
                />
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            className="tooltip"
            style={{
              left: `${(x(value(hover, xKey) as number) / W) * 100}%`,
              top: `${(y(value(hover, yKey) as number) / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 14px))",
            }}
          >
            <strong>{shortName(hover)}</strong>
            <div className="tt-row">
              <span>{METRICS[xKey].short}</span>
              <b>{fmtMetric(xKey, value(hover, xKey), hover)}</b>
            </div>
            <div className="tt-row">
              <span>{METRICS[yKey].short}</span>
              <b>{fmtMetric(yKey, value(hover, yKey), hover)}</b>
            </div>
          </div>
        )}
      </div>
      <figcaption>
        <span className="legend">
          {Object.entries(BORO_COLORS)
            .filter(([k]) => k !== "New York City")
            .map(([k, c]) => (
              <span key={k}>
                <i style={{ background: c, opacity: 0.6 }} /> {k}
              </span>
            ))}
          <span>
            <i style={{ background: accent }} /> On this line
          </span>
        </span>
        {r != null && (
          <span className="r-badge">
            Pearson r = {r.toFixed(2)} · n = {pts.length}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
