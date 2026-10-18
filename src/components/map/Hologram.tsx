"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geo, stats, shortName, pumaById, type Puma } from "@/lib/data";
import { getProjection, pathFor, projector } from "@/lib/geo";
import { fmtPct } from "@/lib/metrics";

/** Birthplace regions (from the Census B05006 hierarchy) -> hologram colors. Validated for CVD on the dark surface. */
export const REGION_GROUPS = [
  { key: "Caribbean", label: "Caribbean", color: "#E04DB5" },
  { key: "LatAm", label: "Mexico, Central & South America", color: "#C47F1C" },
  { key: "EastAsia", label: "East Asia", color: "#1E9CC0" },
  { key: "OtherAsia", label: "South, Southeast & West Asia", color: "#72A532" },
  { key: "Europe", label: "Europe", color: "#8E70E6" },
  { key: "Other", label: "Africa, Oceania & other", color: "#E0604C" },
] as const;

export function regionGroup(region?: string | null, continent?: string | null) {
  const r = (region ?? "").toLowerCase();
  const c = (continent ?? "").toLowerCase();
  if (r.includes("caribbean")) return REGION_GROUPS[0];
  if (r.includes("central america") || r.includes("south america")) return REGION_GROUPS[1];
  if (r.includes("eastern asia")) return REGION_GROUPS[2];
  if (c.includes("asia")) return REGION_GROUPS[3];
  if (c.includes("europe")) return REGION_GROUPS[4];
  return REGION_GROUPS[5];
}

const PW = 820; // floor plane size (px, before scaling)
const PH = 820;
const MAX_H = 250; // tallest pillar
const BEAM = 12; // pillar width

type Props = {
  selected: string | null;
  onSelect: (puma: string) => void;
  labeled: { puma: string; label: string }[]; // stops on the 7 line
  colorMode: "share" | "region";
  country: string | null; // highlight PUMAs where this country is a top-3 birthplace
  lineColor: string;
};

function shareColor(t: number) {
  // deep blue -> cyan -> near-white as the share rises
  const stops = [
    [30, 70, 160],
    [40, 200, 255],
    [220, 250, 255],
  ];
  const s = t < 0.5 ? 0 : 1;
  const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = stops[s],
    b = stops[s + 1];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function Hologram({ selected, onSelect, labeled, colorMode, country, lineColor }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState(58); // rotateX, degrees
  const [spin, setSpin] = useState(-18); // rotateZ, degrees
  const [scale, setScale] = useState(0.8);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [gyro, setGyro] = useState<"off" | "on" | "unsupported">("off");
  const drag = useRef<{ x: number; y: number; t: number; s: number; moved: boolean } | null>(null);

  const projection = getProjection(PW, PH, 30);
  const path = useMemo(() => pathFor(projection), [projection]);
  const project = useMemo(() => projector(projection), [projection]);
  const floor = useMemo(() => geo.features.map((f) => ({ id: f.properties.puma, d: path(f) ?? "" })), [path]);

  const maxFb = Math.max(1, ...stats.pumas.map((p) => p.foreign_born_pct ?? 0));
  const labelSet = new Map(labeled.map((l) => [l.puma, l.label]));

  // responsive scale
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      setScale(Math.max(0.38, Math.min(0.95, w / 960)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // slow idle rotation until the user grabs it
  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      setSpin((s) => s + (now - last) * 0.004);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  // phone tilt (gyroscope)
  const gyroBase = useRef<{ b: number; g: number; t: number; s: number } | null>(null);
  useEffect(() => {
    if (gyro !== "on") return;
    const onOri = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!gyroBase.current) {
        gyroBase.current = { b: e.beta, g: e.gamma, t: tilt, s: spin };
        return;
      }
      const base = gyroBase.current;
      setTilt(Math.max(0, Math.min(78, base.t - (e.beta - base.b) * 0.9)));
      setSpin(base.s + (e.gamma - base.g) * 1.2);
    };
    window.addEventListener("deviceorientation", onOri);
    return () => window.removeEventListener("deviceorientation", onOri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gyro]);

  const stopGyro = () => setGyro((g) => (g === "on" ? "off" : g));

  const toggleGyro = async () => {
    if (gyro === "on") return setGyro("off");
    const DOE = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> })
      | undefined;
    if (!DOE) return setGyro("unsupported");
    try {
      if (typeof DOE.requestPermission === "function") {
        const r = await DOE.requestPermission();
        if (r !== "granted") return setGyro("unsupported");
      }
      gyroBase.current = null;
      setAuto(false);
      setGyro("on");
    } catch {
      setGyro("unsupported");
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, t: tilt, s: spin, moved: false };
    setAuto(false);
    stopGyro();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      if (!d.moved) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      d.moved = true;
    }
    if (d.moved) {
      setSpin(d.s + dx * 0.35);
      setTilt(Math.max(0, Math.min(78, d.t - dy * 0.3)));
    }
  };
  const onPointerUp = () => {
    // keep drag.current until click handlers run, then clear
    setTimeout(() => (drag.current = null), 0);
  };
  const clickPillar = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const pumaColor = (p: Puma) => {
    if (colorMode === "region") {
      const o = p.top_origins[0];
      return regionGroup(o?.region, o?.continent).color;
    }
    return shareColor((p.foreign_born_pct ?? 0) / maxFb);
  };
  const isLit = (p: Puma) => !country || p.top_origins.slice(0, 3).some((o) => o.country === country);

  const hovered = hover ? pumaById[hover] : null;

  return (
    <div className="holo">
      <div
        ref={stageRef}
        className="holo-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label="3D map of foreign-born share by neighborhood. Drag to tilt and rotate."
      >
        <div className="holo-grid-bg" aria-hidden />
        <div
          className="holo-scene"
          style={{
            width: PW,
            height: PH,
            marginLeft: -PW / 2,
            marginTop: -PH / 2,
            transform: `scale(${scale}) rotateX(${tilt}deg) rotateZ(${spin}deg)`,
          }}
        >
          <svg className="holo-floor" width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} aria-hidden>
            <defs>
              <filter id="holo-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern id="holo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="#3fd8ff" strokeOpacity="0.08" />
              </pattern>
            </defs>
            <rect width={PW} height={PH} fill="url(#holo-grid)" />
            <g filter="url(#holo-glow)">
              {floor.map((f) => {
                const p = pumaById[f.id];
                if (!p) return null;
                const lit = isLit(p);
                const t = (p.foreign_born_pct ?? 0) / maxFb;
                return (
                  <path
                    key={f.id}
                    d={f.d}
                    fill={pumaColor(p)}
                    fillOpacity={lit ? 0.1 + t * 0.28 : 0.03}
                    stroke={f.id === selected ? "#ffffff" : "#5fe6ff"}
                    strokeOpacity={lit ? (f.id === selected ? 1 : 0.55) : 0.15}
                    strokeWidth={f.id === selected ? 2.2 : 0.9}
                  />
                );
              })}
            </g>
          </svg>

          {stats.pumas.map((p) => {
            if (!p.centroid) return null;
            const [x, y] = project(p.centroid);
            const h = Math.max(4, ((p.foreign_born_pct ?? 0) / maxFb) * MAX_H);
            const col = pumaColor(p);
            const lit = isLit(p);
            const sel = p.puma === selected;
            const hov = p.puma === hover;
            const label = labelSet.get(p.puma);
            return (
              <div
                key={p.puma}
                className={`pillar ${lit ? "" : "pillar-dim"} ${sel ? "pillar-sel" : ""}`}
                style={{ left: x, top: y, ["--c" as string]: col, ["--h" as string]: `${h}px`, ["--w" as string]: `${BEAM}px` }}
                onClick={() => clickPillar(p.puma)}
                onMouseEnter={() => setHover(p.puma)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="beam" />
                <div className="beam beam-2" />
                <div className="cap" />
                <div className="base" />
                {(label || sel || hov) && (
                  <div
                    className={`pillar-label ${label ? "is-stop" : ""}`}
                    style={{
                      transform: `translateZ(${h + 14}px) rotateZ(${-spin}deg) rotateX(${-tilt}deg) translate(-50%, -100%)`,
                      borderColor: label ? lineColor : undefined,
                    }}
                  >
                    <span>{label ?? shortName(p)}</span>
                    <b>{fmtPct(p.foreign_born_pct)}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="holo-scan" aria-hidden />

        {hovered && (
          <div className="holo-tip">
            <strong>{shortName(hovered)}</strong> <span>{hovered.borough}</span>
            <div>
              Foreign-born: <b>{fmtPct(hovered.foreign_born_pct, 1)}</b>
            </div>
            {hovered.top_origins[0] && (
              <div>
                Top birthplace: <b>{hovered.top_origins[0].country}</b>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="holo-controls">
        <label>
          Tilt
          <input type="range" min={0} max={78} value={Math.round(tilt)} onChange={(e) => (setAuto(false), stopGyro(), setTilt(+e.target.value))} />
        </label>
        <label>
          Rotate
          <input
            type="range"
            min={-180}
            max={180}
            value={Math.round(((((spin + 180) % 360) + 360) % 360) - 180)}
            onChange={(e) => (setAuto(false), stopGyro(), setSpin(+e.target.value))}
          />
        </label>
        <button className="holo-btn" onClick={() => (stopGyro(), setTilt(58), setSpin(-18), setAuto(true))}>
          Reset
        </button>
        <button className="holo-btn" onClick={() => (stopGyro(), setTilt(0), setSpin(0), setAuto(false))}>
          Top-down
        </button>
        <button className="holo-btn holo-gyro" onClick={toggleGyro} aria-pressed={gyro === "on"} disabled={gyro === "unsupported"}>
          {gyro === "on" ? "📱 Phone tilt on · tap to stop" : gyro === "unsupported" ? "No gyroscope" : "📱 Use phone tilt"}
        </button>
      </div>
    </div>
  );
}
