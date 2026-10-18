"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from "react";
import { geo, pumaById, type Puma } from "@/lib/data";
import { getProjection, pathFor, projector, type Project } from "@/lib/geo";

export type Focus = { center: [number, number]; zoom: number } | null;

type Props = {
  width?: number;
  height?: number;
  fill?: (p: Puma | undefined) => string;
  stroke?: string;
  selected?: string | null;
  hovered?: string | null;
  onPumaClick?: (puma: string) => void;
  onPumaHover?: (puma: string | null) => void;
  focus?: Focus;
  children?: (project: Project, zoom: number) => ReactNode;
  className?: string;
  ariaLabel?: string;
  water?: boolean;
  /** borough + water labels, in the faded style of a subway map */
  placeLabels?: boolean;
  /** scroll / pinch to zoom, drag to pan, plus +/− and reset buttons */
  interactive?: boolean;
};

const MAX_ZOOM = 16;
type Box = [number, number, number, number];

const PLACE_LABELS: { t: string; at: [number, number]; water?: boolean }[] = [
  { t: "BRONX", at: [-73.865, 40.83] },
  { t: "QUEENS", at: [-73.8, 40.705] },
  { t: "BROOKLYN", at: [-73.9, 40.63] },
  { t: "STATEN ISLAND", at: [-74.15, 40.583] },
  { t: "HUDSON RIVER", at: [-74.03, 40.77], water: true },
  { t: "UPPER BAY", at: [-74.055, 40.665], water: true },
  { t: "JAMAICA BAY", at: [-73.835, 40.61], water: true },
  { t: "LONG ISLAND SOUND", at: [-73.745, 40.818], water: true },
  { t: "ATLANTIC OCEAN", at: [-73.93, 40.548], water: true },
];

/**
 * SVG map of New York City's 55 PUMAs. Everything else (routes, stations, photo
 * pins, dots) is drawn on top through the `children` render prop, which receives
 * the projection. `focus` animates the camera (the SVG viewBox).
 */
export default function NycMap({
  width = 1000,
  height = 1000,
  fill = () => "var(--land)",
  stroke = "var(--land-line)",
  selected,
  hovered,
  onPumaClick,
  onPumaHover,
  focus = null,
  children,
  className,
  ariaLabel = "Map of New York City's five boroughs",
  water = true,
  placeLabels = true,
  interactive = false,
}: Props) {
  const projection = getProjection(width, height);
  const path = useMemo(() => pathFor(projection), [projection]);
  const project = useMemo(() => projector(projection), [projection]);
  const shapes = useMemo(
    () => geo.features.map((f) => ({ id: f.properties.puma, borough: f.properties.borough, d: path(f) ?? "" })),
    [path],
  );

  // Camera animation
  const full: Box = [0, 0, width, height];
  const target = useMemo<Box>(() => {
    if (!focus) return full;
    const [cx, cy] = project(focus.center);
    const w = width / focus.zoom,
      h = height / focus.zoom;
    return [cx - w / 2, cy - h / 2, w, h];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.center[0], focus?.center[1], focus?.zoom, width, height]);

  const [vb, setVb] = useState(target);
  const vbRef = useRef(vb);
  vbRef.current = vb;
  const rafRef = useRef(0);

  const flyTo = (to: Box) => {
    cancelAnimationFrame(rafRef.current);
    const from = vbRef.current;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVb(to);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      setVb(from.map((v, i) => v + (to[i] - v) * e) as Box);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    flyTo(target);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Zoom by `factor` keeping svg point (px, py) fixed on screen; the centre stays over the city.
  const zoomAt = (px: number, py: number, factor: number) => {
    cancelAnimationFrame(rafRef.current);
    const [x, y, w] = vbRef.current;
    const nw = Math.min(width, Math.max(width / MAX_ZOOM, w / factor));
    const k = nw / w;
    const nh = (nw * height) / width;
    const cx = Math.min(width, Math.max(0, px - (px - x) * k + nw / 2));
    const cy = Math.min(height, Math.max(0, py - (py - y) * k + nh / 2));
    const next: Box = [cx - nw / 2, cy - nh / 2, nw, nh];
    vbRef.current = next;
    setVb(next);
  };
  const panBy = (dx: number, dy: number) => {
    const [x, y, w, h] = vbRef.current;
    const cx = Math.min(width, Math.max(0, x + w / 2 + dx));
    const cy = Math.min(height, Math.max(0, y + h / 2 + dy));
    const next: Box = [cx - w / 2, cy - h / 2, w, h];
    vbRef.current = next;
    setVb(next);
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const toSvg = (clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0, scale: 1 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y, scale: ctm.a };
  };

  // Gestures: wheel / trackpad pinch, one-pointer drag, two-finger pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  useEffect(() => {
    const svg = svgRef.current;
    if (!interactive || !svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const p = toSvg(e.clientX, e.clientY);
      zoomAt(p.x, p.y, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, width, height]);

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = false;
  };
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      const dx = e.clientX - prev.x,
        dy = e.clientY - prev.y;
      if (!moved.current && Math.hypot(dx, dy) < 4) return; // still a click
      if (!moved.current) {
        moved.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const { scale } = toSvg(e.clientX, e.clientY);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      panBy(-dx / scale, -dy / scale);
    } else if (pts.length === 2) {
      moved.current = true;
      const other = pts.find((p) => p !== prev)!;
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const mid = toSvg((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
      if (d0 > 0) zoomAt(mid.x, mid.y, d1 / d0);
    }
  };
  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const zoomCentre = (factor: number) => {
    const [x, y, w, h] = vbRef.current;
    zoomAt(x + w / 2, y + h / 2, factor);
  };

  const zoom = width / vb[2];

  const svg = (
    <svg
      ref={svgRef}
      viewBox={vb.join(" ")}
      className={className}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", height: "100%", touchAction: interactive ? "none" : undefined }}
      {...(interactive && {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        onDoubleClick: (e: RMouseEvent) => {
          const p = toSvg(e.clientX, e.clientY);
          zoomAt(p.x, p.y, 2);
        },
        // a drag that ends on a pin shouldn't count as clicking it
        onClickCapture: (e: RMouseEvent) => {
          if (moved.current) e.stopPropagation();
        },
      })}
    >
      {water && <rect x={-width} y={-height} width={width * 3} height={height * 3} fill="var(--water)" />}
      <g>
        {shapes.map((s) => {
          const isSel = s.id === selected;
          const isHov = s.id === hovered;
          return (
            <path
              key={s.id}
              d={s.d}
              fill={fill(pumaById[s.id])}
              stroke={isSel ? "var(--ink)" : stroke}
              strokeWidth={(isSel ? 2.2 : isHov ? 1.6 : 0.7) / zoom}
              style={{ cursor: onPumaClick ? "pointer" : undefined, transition: "fill 400ms ease" }}
              onClick={onPumaClick ? () => onPumaClick(s.id) : undefined}
              onMouseEnter={onPumaHover ? () => onPumaHover(s.id) : undefined}
              onMouseLeave={onPumaHover ? () => onPumaHover(null) : undefined}
            />
          );
        })}
        {/* selected outline drawn last so it sits on top of neighbours */}
        {selected &&
          shapes
            .filter((s) => s.id === selected)
            .map((s) => (
              <path key="sel" d={s.d} fill="none" stroke="var(--ink)" strokeWidth={2.4 / zoom} pointerEvents="none" />
            ))}
      </g>
      {placeLabels && (
        <g pointerEvents="none" aria-hidden>
          {PLACE_LABELS.map((l) => {
            const [x, y] = project(l.at);
            return (
              <text
                key={l.t}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize={(l.water ? 10.5 : 12) / zoom}
                letterSpacing={(l.water ? 2.5 : 4) / zoom}
                fill={l.water ? "#6aa3b8" : "#b8a46a"}
                fontWeight={l.water ? 500 : 600}
                style={{ fontStyle: l.water ? "italic" : undefined }}
              >
                {l.t}
              </text>
            );
          })}
        </g>
      )}
      {children?.(project, zoom)}
    </svg>
  );

  if (!interactive) return svg;
  return (
    <div className="map-interactive">
      {svg}
      <div className="map-controls">
        <button onClick={() => zoomCentre(1.6)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomCentre(1 / 1.6)} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => flyTo(target)} aria-label="Reset view" title="Reset view">
          ⤢
        </button>
      </div>
      <div className="map-hint">Scroll or pinch to zoom · drag to move</div>
    </div>
  );
}
