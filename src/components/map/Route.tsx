"use client";

import type { Line, Stop } from "@/content/lines";
import { smoothLine, type Project, type XY } from "@/lib/geo";

type Props = {
  line: Pick<Line, "id" | "color" | "offset"> & { stops: Pick<Stop, "id" | "at" | "via" | "hood" | "label">[] };
  project: Project;
  zoom: number;
  activeStop?: string | null;
  onStopClick?: (id: string) => void;
  onStopHover?: (id: string | null) => void;
  dim?: boolean;
  labels?: boolean;
  width?: number; // route stroke width in screen px
  animate?: boolean;
  /** return false to hide a stop's label (e.g. a station another line already labels) */
  labelFilter?: (stopId: string) => boolean;
};

export function stopXY(project: Project, at: [number, number], offset: [number, number], zoom: number): XY {
  const [x, y] = project(at);
  return [x + offset[0] / zoom, y + offset[1] / zoom];
}

export default function Route({
  line,
  project,
  zoom,
  activeStop,
  onStopClick,
  onStopHover,
  dim = false,
  labels = true,
  width = 7,
  animate = false,
  labelFilter,
}: Props) {
  const pts = line.stops.map((s) => stopXY(project, s.at, line.offset, zoom));

  // split into rail segments + ferry segments
  const rail: XY[][] = [];
  const ferry: XY[][] = [];
  let cur: XY[] = [];
  line.stops.forEach((s, i) => {
    if (s.via === "ferry" && i > 0) {
      if (cur.length > 1) rail.push(cur);
      ferry.push([pts[i - 1], pts[i]]);
      cur = [pts[i]];
    } else {
      cur.push(pts[i]);
    }
  });
  if (cur.length > 1) rail.push(cur);

  const sw = width / zoom;
  const r = 6.5 / zoom;
  const fs = 12.5 / zoom;

  return (
    <g opacity={dim ? 0.18 : 1} style={{ transition: "opacity 300ms" }}>
      {rail.map((seg, i) => (
        <path
          key={`r${i}`}
          d={smoothLine(seg) ?? ""}
          fill="none"
          stroke={line.color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={animate ? 1 : undefined}
          className={animate ? "route-draw" : undefined}
        />
      ))}
      {ferry.map((seg, i) => (
        <path
          key={`f${i}`}
          d={smoothLine(seg) ?? ""}
          fill="none"
          stroke={line.color}
          strokeWidth={sw * 0.55}
          strokeDasharray={`${10 / zoom} ${7 / zoom}`}
          strokeLinecap="round"
        />
      ))}
      {line.stops.map((s, i) => {
        const [x, y] = pts[i];
        const active = s.id === activeStop;
        const pos = s.label ?? "right";
        const dx = pos === "right" ? 12 / zoom : pos === "left" ? -12 / zoom : 0;
        const dy = pos === "top" ? -13 / zoom : pos === "bottom" ? 21 / zoom : 4 / zoom;
        const anchor = pos === "right" ? "start" : pos === "left" ? "end" : "middle";
        return (
          <g
            key={s.id}
            style={{ cursor: onStopClick ? "pointer" : undefined }}
            onClick={onStopClick ? () => onStopClick(s.id) : undefined}
            onMouseEnter={onStopHover ? () => onStopHover(s.id) : undefined}
            onMouseLeave={onStopHover ? () => onStopHover(null) : undefined}
            role={onStopClick ? "button" : undefined}
            aria-label={onStopClick ? `${s.hood} stop` : undefined}
          >
            <circle cx={x} cy={y} r={18 / zoom} fill="transparent" />
            {active && <circle cx={x} cy={y} r={r * 2.3} fill={line.color} opacity={0.25} className="pulse" />}
            <circle
              cx={x}
              cy={y}
              r={active ? r * 1.35 : r}
              fill={active ? line.color : "#fff"}
              stroke={active ? "var(--ink)" : line.color}
              strokeWidth={(active ? 2.6 : 3) / zoom}
            />
            {labels && (!labelFilter || labelFilter(s.id)) && (
              <text
                x={x + dx}
                y={y + dy}
                textAnchor={anchor}
                className="station-label"
                fontSize={fs}
                fontWeight={active ? 700 : 600}
                paintOrder="stroke"
                stroke="var(--land)"
                strokeWidth={3.5 / zoom}
                strokeLinejoin="round"
              >
                {s.hood.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
