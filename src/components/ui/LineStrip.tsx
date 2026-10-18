"use client";

import { useEffect } from "react";
import Bullet from "./Bullet";

type StripStop = { id: string; hood: string; station: string; via?: "ferry" };

type Props = {
  id: string;
  color: string;
  ink: string;
  name: string;
  stops: StripStop[];
  active: number;
  onSelect: (i: number) => void;
  dark?: boolean;
};

/** The strip map above the subway doors: every stop in order, the current one lit. */
export default function LineStrip({ id, color, ink, name, stops, active, onSelect, dark }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") onSelect(Math.min(stops.length - 1, active + 1));
      if (e.key === "ArrowLeft") onSelect(Math.max(0, active - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stops.length, onSelect]);

  return (
    <div className={`strip ${dark ? "strip-dark" : ""}`}>
      <div className="strip-head">
        <Bullet id={id} color={color} ink={ink} size={34} />
        <div>
          <div className="strip-name">{name}</div>
          <div className="strip-now">
            {active === stops.length - 1 ? "Last stop" : "Now arriving"} ·{" "}
            <strong>{stops[active]?.hood}</strong> <span className="muted">({stops[active]?.station})</span>
          </div>
        </div>
        <div className="strip-controls">
          <button
            className="btn-round"
            onClick={() => onSelect(Math.max(0, active - 1))}
            disabled={active === 0}
            aria-label="Previous stop"
          >
            ←
          </button>
          <button
            className="btn-round btn-next"
            style={{ background: color, color: ink }}
            onClick={() => onSelect(Math.min(stops.length - 1, active + 1))}
            disabled={active === stops.length - 1}
            aria-label="Next stop"
          >
            Next stop →
          </button>
        </div>
      </div>
      <div className="strip-track-wrap">
        <ol className="strip-track" style={{ ["--n" as string]: stops.length }}>
          <span className="strip-rail" style={{ background: color }} />
          <span className="strip-rail-done" style={{ background: color, width: `calc(${active} * 100% / ${stops.length})` }} />
          {stops.map((s, i) => (
            <li key={s.id} className={i === active ? "on" : i < active ? "past" : ""}>
              <button onClick={() => onSelect(i)} aria-current={i === active ? "step" : undefined}>
                <span
                  className="strip-dot"
                  style={{ borderColor: color, background: i === active ? color : undefined }}
                />
                {s.via === "ferry" && <span className="strip-ferry">⛴ ferry</span>}
                <span className="strip-label">{s.hood}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
