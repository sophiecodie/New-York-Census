"use client";

import { scaleLinear } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import { stats, type Puma } from "@/lib/data";
import { METRICS, fmtMetric, value, type MetricKey } from "@/lib/metrics";

type Props = {
  k: MetricKey;
  points: { hood: string; puma?: Puma }[];
  color: string;
  active: number;
  onSelect: (i: number) => void;
  height?: number;
  showLabels?: boolean;
};

/** A metric plotted stop-by-stop along a subway line, with the NYC value as a dashed reference. */
export default function AlongLine({ k, points, color, active, onSelect, height = 230, showLabels = true }: Props) {
  const W = 1200,
    H = height,
    m = { t: 36, r: 96, b: showLabels ? 62 : 16, l: 64 };
  const vals = points.map((p) => value(p.puma, k));
  const good = vals.filter((v): v is number => v != null);
  if (!good.length) return null;
  const cityV = value(stats.city, k);
  const lo = Math.min(...good, cityV ?? Infinity),
    hi = Math.max(...good, cityV ?? -Infinity);
  const x = scaleLinear()
    .domain([0, points.length - 1])
    .range([m.l + 28, W - m.r - 10]);
  const y = scaleLinear()
    .domain([Math.min(0, lo), hi * 1.08])
    .nice(4)
    .range([H - m.b, m.t]);
  const ln = d3line<[number, number | null]>()
    .defined((d) => d[1] != null)
    .x((d) => x(d[0]))
    .y((d) => y(d[1] as number))
    .curve(curveMonotoneX);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${METRICS[k].label} at each stop`}>
      {y.ticks(4).map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#0000000f" />
          <text x={m.l - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)">
            {fmtMetric(k, t)}
          </text>
        </g>
      ))}
      {cityV != null && (
        <g>
          <line x1={m.l} x2={W - m.r} y1={y(cityV)} y2={y(cityV)} stroke="var(--ink)" strokeDasharray="4 4" opacity={0.55} />
          <text x={W - m.r + 8} y={y(cityV) + 4} fontSize={11} textAnchor="start" fill="var(--ink)">
            NYC {fmtMetric(k, cityV, stats.city)}
          </text>
        </g>
      )}
      <path
        d={ln(vals.map((v, i) => [i, v])) ?? ""}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => {
        const v = vals[i];
        const on = i === active;
        return (
          <g key={i} style={{ cursor: "pointer" }} onClick={() => onSelect(i)}>
            <rect x={x(i) - 18} y={m.t} width={36} height={H - m.t - (showLabels ? 8 : m.b)} fill="transparent" />
            {v != null && (
              <>
                <circle cx={x(i)} cy={y(v)} r={on ? 8 : 5.5} fill={on ? color : "#fff"} stroke={on ? "var(--ink)" : color} strokeWidth={3} />
                {(on || points.length <= 7) && (
                  <text x={x(i)} y={y(v) - 13} textAnchor="middle" fontSize={on ? 13 : 11} fontWeight={on ? 700 : 500} fill="var(--ink)">
                    {fmtMetric(k, v, p.puma)}
                  </text>
                )}
              </>
            )}
            {showLabels && (
              <text
                transform={`translate(${x(i)} ${H - m.b + 16}) rotate(-32)`}
                textAnchor="end"
                fontSize={10.5}
                fontWeight={on ? 700 : 500}
                fill={on ? "var(--ink)" : "var(--muted)"}
                className="station-label"
              >
                {p.hood.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
