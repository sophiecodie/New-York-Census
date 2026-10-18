"use client";

import type { ReactNode } from "react";
import { stats, cdLabel, type Puma } from "@/lib/data";
import { METRICS, fmtMetric, fmtMoe, moeOf, value, type MetricKey } from "@/lib/metrics";
import Bullet from "./Bullet";

type Props = {
  puma: Puma | undefined;
  hood: string;
  station: string;
  note?: string;
  line: { id: string; color: string; ink: string };
  metrics: MetricKey[];
  children?: ReactNode;
  dark?: boolean;
  photo?: string;
};

/** Where this neighborhood falls among all 55: one dot per PUMA, this one highlighted. */
export function DotStrip({ k, puma, color, dark }: { k: MetricKey; puma: Puma; color: string; dark?: boolean }) {
  const vals = stats.pumas.map((p) => ({ id: p.puma, v: value(p, k), name: p.short })).filter((d) => d.v != null) as {
    id: string;
    v: number;
    name: string;
  }[];
  if (!vals.length) return null;
  const lo = Math.min(...vals.map((d) => d.v));
  const hi = Math.max(...vals.map((d) => d.v));
  const W = 300,
    H = 26,
    pad = 6;
  const x = (v: number) => pad + ((v - lo) / (hi - lo || 1)) * (W - 2 * pad);
  const cityV = value(stats.city, k);
  const me = value(puma, k);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dotstrip" aria-hidden>
      <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke={dark ? "#ffffff30" : "#00000018"} strokeWidth={1} />
      {vals.map((d) => (
        <circle key={d.id} cx={x(d.v)} cy={H / 2} r={2.6} fill={dark ? "#ffffff55" : "#00000033"}>
          <title>
            {d.name}: {fmtMetric(k, d.v)}
          </title>
        </circle>
      ))}
      {cityV != null && cityV >= lo && cityV <= hi && (
        <g>
          <line
            x1={x(cityV)}
            x2={x(cityV)}
            y1={3}
            y2={H - 3}
            stroke={dark ? "#fff" : "var(--ink)"}
            strokeWidth={1.2}
            strokeDasharray="2 2"
          />
        </g>
      )}
      {me != null && (
        <circle
          cx={x(me)}
          cy={H / 2}
          r={6}
          fill={color}
          stroke={dark ? "#0b1020" : "#fff"}
          strokeWidth={2}
        />
      )}
      <text x={pad} y={H} fontSize={7.5} fill={dark ? "#ffffff80" : "#00000070"}>
        {fmtMetric(k, lo)}
      </text>
      <text x={W - pad} y={H} fontSize={7.5} textAnchor="end" fill={dark ? "#ffffff80" : "#00000070"}>
        {fmtMetric(k, hi)}
      </text>
    </svg>
  );
}

export default function StationCard({ puma, hood, station, note, line, metrics, children, dark, photo }: Props) {
  if (!puma) {
    return (
      <aside className={`card ${dark ? "card-dark" : ""}`}>
        <p className="muted">No Census match for this stop. Check its borough and district in content/lines.ts.</p>
      </aside>
    );
  }
  const n = stats.n_pumas;
  return (
    <aside className={`card ${dark ? "card-dark" : ""}`} aria-live="polite">
      <div className="card-top">
        <Bullet id={line.id} color={line.color} ink={line.ink} size={26} />
        <div>
          <h2 className="card-title">{hood}</h2>
          <div className="card-sub">
            {station} · {cdLabel(puma)}
          </div>
        </div>
      </div>
      {photo && <img className="card-photo" src={photo} alt={hood} />}
      {note && <p className="card-note">{note}</p>}
      <div className="card-rows">
        {metrics.map((k) => {
          const v = value(puma, k);
          const rank = puma.ranks?.[k];
          return (
            <div className="card-row" key={k}>
              <div className="card-row-head">
                <span className="card-label" title={METRICS[k].definition}>
                  {METRICS[k].label}
                </span>
                <span className="card-value">
                  {fmtMetric(k, v, puma)}
                  <small>{fmtMoe(k, moeOf(puma, k))}</small>
                </span>
              </div>
              <DotStrip k={k} puma={puma} color={line.color} dark={dark} />
              <div className="card-row-foot">
                <span>
                  <i className="tick-key" /> NYC: {fmtMetric(k, value(stats.city, k), stats.city)}
                </span>
                {rank && (
                  <span>
                    #{rank} highest of {n}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {children}
      <p className="card-foot">Census PUMA: {puma.short}</p>
    </aside>
  );
}
