"use client";

import { useState } from "react";
import { line as d3line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { BOROUGHS } from "@/lib/data";

export const BORO_COLORS: Record<string, string> = {
  Bronx: "#D9731A",
  Brooklyn: "#2F6FD0",
  Manhattan: "#C2364A",
  Queens: "#7A4FC4",
  "Staten Island": "#2E9E6A",
  "New York City": "var(--ink)",
};

type Props = {
  years: number[];
  series: Record<string, (number | null)[]>; // name -> values aligned to years
  format: (v: number) => string;
  yLabel: string;
  dark?: boolean;
  height?: number;
};

/** Borough lines over time, NYC dashed, with a hover crosshair + tooltip. */
export default function TrendChart({ years, series, format, yLabel, dark, height = 320 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000,
    H = height,
    m = { t: 16, r: 116, b: 30, l: 56 };
  const names = [...BOROUGHS, "New York City"].filter((n) => series[n]);
  const all = names.flatMap((n) => series[n].filter((v): v is number => v != null));
  if (!all.length || years.length < 2) return <p className="muted">Not enough years of data.</p>;

  let lo = Math.min(...all),
    hi = Math.max(...all);
  const padY = (hi - lo) * 0.12 || 1;
  lo -= padY;
  hi += padY;
  const x = scaleLinear()
    .domain([years[0], years[years.length - 1]])
    .range([m.l, W - m.r]);
  const y = scaleLinear().domain([lo, hi]).nice(5).range([H - m.b, m.t]);
  const ln = d3line<[number, number | null]>()
    .defined((d) => d[1] != null)
    .x((d) => x(d[0]))
    .y((d) => y(d[1] as number));

  const colorOf = (n: string) => (n === "New York City" && dark ? "#e8f6ff" : BORO_COLORS[n]);
  const ink = dark ? "#e8f6ff" : "var(--ink)";
  const grid = dark ? "#ffffff18" : "#0000000f";
  const muted = dark ? "#ffffff90" : "var(--muted)";

  // end labels, nudged apart so they don't collide
  const ends = names
    .map((n) => {
      const vals = series[n];
      let i = vals.length - 1;
      while (i >= 0 && vals[i] == null) i--;
      return { n, y: i >= 0 ? y(vals[i] as number) : 0, v: vals[i] };
    })
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const yr = x.invert(loc.x);
    let best = 0;
    years.forEach((yy, i) => {
      if (Math.abs(yy - yr) < Math.abs(years[best] - yr)) best = i;
    });
    setHover(best);
  };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={yLabel}>
        {y.ticks(5).map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={grid} />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={muted}>
              {format(t)}
            </text>
          </g>
        ))}
        {years.map((yr, i) =>
          i % 2 === 0 || i === years.length - 1 ? (
            <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" fontSize={11} fill={muted}>
              {yr}
            </text>
          ) : null,
        )}
        {years.includes(2019) && years.includes(2021) && (
          <text x={x(2020)} y={m.t + 10} textAnchor="middle" fontSize={9.5} fill={muted}>
            no 2020 data
          </text>
        )}
        {names.map((n) => (
          <path
            key={n}
            d={ln(years.map((yr, i) => [yr, series[n][i]])) ?? ""}
            fill="none"
            stroke={colorOf(n)}
            strokeWidth={n === "New York City" ? 2.5 : 2}
            strokeDasharray={n === "New York City" ? "5 4" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {ends.map((e) => (
          <g key={e.n}>
            <circle cx={W - m.r + 8} cy={e.y} r={4} fill={colorOf(e.n)} />
            <text x={W - m.r + 16} y={e.y + 4} fontSize={11} fill={ink} fontWeight={e.n === "New York City" ? 700 : 500}>
              {e.n === "New York City" ? "NYC" : e.n}
            </text>
          </g>
        ))}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(years[hover])} x2={x(years[hover])} y1={m.t} y2={H - m.b} stroke={ink} strokeOpacity={0.35} />
            {names.map((n) =>
              series[n][hover] != null ? (
                <circle
                  key={n}
                  cx={x(years[hover])}
                  cy={y(series[n][hover] as number)}
                  r={4}
                  fill={colorOf(n)}
                  stroke={dark ? "#060b18" : "#fff"}
                  strokeWidth={2}
                />
              ) : null,
            )}
          </g>
        )}
        <rect
          x={m.l}
          y={m.t}
          width={W - m.l - m.r}
          height={H - m.t - m.b}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover != null && (
        <div
          className={`tooltip ${dark ? "tooltip-dark" : ""}`}
          style={{ left: `${(x(years[hover]) / W) * 100}%`, transform: x(years[hover]) > W / 2 ? "translateX(-108%)" : "translateX(8%)" }}
        >
          <strong>{years[hover]}</strong>
          {names
            .map((n) => ({ n, v: series[n][hover] }))
            .filter((d) => d.v != null)
            .sort((a, b) => (b.v as number) - (a.v as number))
            .map((d) => (
              <div key={d.n} className="tt-row">
                <i style={{ background: colorOf(d.n) }} />
                <span>{d.n}</span>
                <b>{format(d.v as number)}</b>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
