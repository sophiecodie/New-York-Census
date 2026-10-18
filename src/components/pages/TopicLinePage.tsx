"use client";

import { useMemo, useState, type ReactNode } from "react";
import { scaleQuantile } from "d3-scale";
import type { Line } from "@/content/lines";
import { findPuma, pumaById, stats, shortName, type Puma } from "@/lib/data";
import { METRICS, fmtMetric, value, type MetricKey } from "@/lib/metrics";
import type { Project } from "@/lib/geo";
import NycMap from "@/components/map/NycMap";
import Route from "@/components/map/Route";
import LineStrip from "@/components/ui/LineStrip";
import StationCard from "@/components/ui/StationCard";

type Props = {
  line: Line;
  ramp: string[]; // 5 colors, light -> dark
  mapMetrics: MetricKey[];
  cardMetrics: MetricKey[];
  intro: ReactNode;
  overlay?: (project: Project, zoom: number, metric: MetricKey) => ReactNode;
  overlayToggle?: string;
  overlayLegend?: ReactNode; // key for the overlay, shown in the map legend while the overlay is on
  children?: (state: { active: number; setActive: (i: number) => void; selected: string | null; select: (p: string) => void }) => ReactNode;
};

export default function TopicLinePage({ line, ramp, mapMetrics, cardMetrics, intro, overlay, overlayToggle, overlayLegend, children }: Props) {
  const [active, setActiveRaw] = useState(0);
  const [picked, setPicked] = useState<string | null>(null); // a PUMA clicked on the map (off-line)
  const [metric, setMetric] = useState<MetricKey>(mapMetrics[0]);
  const [hover, setHover] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);

  const stopPumas = useMemo(() => line.stops.map((s) => findPuma(s.boro, s.cd)), [line]);
  const stop = line.stops[active];
  const stopPuma = stopPumas[active];
  const shown: Puma | undefined = picked ? pumaById[picked] : stopPuma;

  const setActive = (i: number) => {
    setActiveRaw(i);
    setPicked(null);
    setZoomed(true);
  };
  const select = (id: string) => {
    const idx = stopPumas.findIndex((p) => p?.puma === id);
    if (idx >= 0) setActive(idx);
    else setPicked(id);
  };

  const vals = stats.pumas.map((p) => value(p, metric)).filter((v): v is number => v != null);
  const scale = scaleQuantile<string>().domain(vals).range(ramp);
  const fill = (p?: Puma) => {
    const v = value(p, metric);
    return v == null ? "url(#nodata)" : scale(v);
  };
  const breaks = scale.quantiles();

  const focusAt = picked && pumaById[picked]?.centroid ? (pumaById[picked].centroid as [number, number]) : stop.at;
  const hovered = hover ? pumaById[hover] : null;

  return (
    <div className="topic">
      <section className="topic-hero">
        <div className="eyebrow" style={{ color: line.color === "#FCCC0A" ? "#9a7a00" : line.color }}>
          {line.topic} · the {line.id} line
        </div>
        <h1>{line.name}</h1>
        <div className="topic-intro">{intro}</div>
      </section>

      <LineStrip
        id={line.id}
        color={line.color}
        ink={line.ink}
        name={line.tagline}
        stops={line.stops}
        active={active}
        onSelect={setActive}
      />

      <section className="topic-grid">
        <div className="map-panel">
          <div className="map-toolbar">
            <div className="seg" role="tablist" aria-label="Map shows">
              {mapMetrics.map((k) => (
                <button key={k} role="tab" aria-selected={metric === k} className={metric === k ? "on" : ""} onClick={() => setMetric(k)}>
                  {METRICS[k].short}
                </button>
              ))}
            </div>
            <div className="map-toolbar-right">
              {overlay && overlayToggle && (
                <label className="check">
                  <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} /> {overlayToggle}
                </label>
              )}
              <button className="btn-ghost" onClick={() => setZoomed((z) => !z)}>
                {zoomed ? "All 5 boroughs" : "Zoom to stop"}
              </button>
            </div>
          </div>
          <div className="map-frame">
            <NycMap
              fill={fill}
              selected={shown?.puma}
              hovered={hover}
              onPumaClick={select}
              onPumaHover={setHover}
              focus={zoomed ? { center: focusAt, zoom: 2.6 } : null}
            >
              {(project, zoom) => (
                <>
                  <defs>
                    <pattern id="nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="#eee" />
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#ccc" strokeWidth="2" />
                    </pattern>
                  </defs>
                  {overlay && showOverlay && overlay(project, zoom, metric)}
                  <Route line={line} project={project} zoom={zoom} activeStop={picked ? null : stop.id} onStopClick={(id) => setActive(line.stops.findIndex((s) => s.id === id))} />
                </>
              )}
            </NycMap>
            {hovered && (
              <div className="map-hover">
                <strong>{shortName(hovered)}</strong> <span className="muted">{hovered.borough}</span>
                <div>
                  {METRICS[metric].short}: <b>{fmtMetric(metric, value(hovered, metric), hovered)}</b>
                </div>
              </div>
            )}
            <div className="map-legend">
              <div className="map-legend-title">{METRICS[metric].label}</div>
              <div className="map-legend-swatches">
                {ramp.map((c, i) => (
                  <span key={c} style={{ background: c }} title={i === 0 ? `< ${fmtMetric(metric, breaks[0])}` : i === ramp.length - 1 ? `≥ ${fmtMetric(metric, breaks[i - 1])}` : `${fmtMetric(metric, breaks[i - 1])}–${fmtMetric(metric, breaks[i])}`} />
                ))}
              </div>
              <div className="map-legend-ticks">
                {breaks.map((b, i) => (
                  <span key={i}>{fmtMetric(metric, b)}</span>
                ))}
              </div>
              <div className="map-legend-note">Quintiles of {stats.n_pumas} neighborhoods</div>
              {overlay && showOverlay && overlayLegend && <div className="map-legend-overlay">{overlayLegend}</div>}
            </div>
          </div>
        </div>

        <StationCard
          puma={shown}
          hood={picked && shown ? shortName(shown) : stop.hood}
          station={picked ? `${shown?.borough ?? ""} (not on the ${line.id})` : stop.station}
          note={picked ? undefined : stop.note}
          line={line}
          metrics={cardMetrics}
        />
      </section>

      {children?.({ active, setActive, selected: shown?.puma ?? null, select })}
    </div>
  );
}
