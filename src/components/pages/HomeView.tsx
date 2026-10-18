"use client";

import Link from "next/link";
import { useState } from "react";
import { LINES, A_LINE, type Line, type Stop } from "@/content/lines";
import { PLACES } from "@/content/places";
import { findPuma, hasData, hasGeo, stats, cdLabel } from "@/lib/data";
import { fmtInt, fmtMetric, fmtPct, fmtUsd, value, type MetricKey } from "@/lib/metrics";
import NycMap from "@/components/map/NycMap";
import Route, { stopXY } from "@/components/map/Route";
import Bullet from "@/components/ui/Bullet";
import DataMissing from "@/components/ui/DataMissing";

const CARD_METRICS: MetricKey[] = ["foreign_born_pct", "median_rent", "median_income"];

// Stations shared with another line are labeled once on the system map
const HIDE_LABELS = new Set(["q-ues", "q-midtown", "4-boroughhall"]);

type Picked = { line: Line; stop: Stop } | null;

const aLine = {
  ...A_LINE,
  offset: [0, 0] as [number, number],
  stops: PLACES.map((p) => ({ id: `a-${p.id}`, at: p.at, hood: p.name, label: "right" as const })),
};

export default function HomeView() {
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked>(null);

  const puma = picked ? findPuma(picked.stop.boro, picked.stop.cd) : undefined;
  // show one of your photos in the card if you have a place within ~1 km of this stop
  const nearPhoto = picked
    ? PLACES.find(
        (p) => p.photos.length && Math.hypot(p.at[0] - picked.stop.at[0], p.at[1] - picked.stop.at[1]) < 0.012,
      )?.photos[0]
    : undefined;

  return (
    <div className="home">
      <section className="home-hero">
        <h1 className="display">
          The
          <br />
          New York
          <br />
          Census
          <br />
          Line.
        </h1>
        <p className="lede">
          Explore New York through data and personal photos. Each subway line is a topic, and each stop is a neighborhood with real Census
          numbers behind it. Click a stop to see them.
        </p>
        <hr className="rule" />
        <ul className="legend-lines">
          {LINES.map((l) => (
            <li key={l.id}>
              <button
                onMouseEnter={() => setFocusLine(l.id)}
                onMouseLeave={() => setFocusLine(null)}
                onFocus={() => setFocusLine(l.id)}
                onBlur={() => setFocusLine(null)}
                onClick={() => setPicked({ line: l, stop: l.stops[0] })}
              >
                <Bullet id={l.id} color={l.color} ink={l.ink} size={30} />
                <span>
                  <b>{l.topic}</b>
                  <small>{l.name}</small>
                </span>
              </button>
              <Link href={`/${l.slug}`} className="legend-go" aria-label={`Ride the ${l.id}: ${l.topic}`}>
                Ride →
              </Link>
            </li>
          ))}
          <li>
            <button onMouseEnter={() => setFocusLine("A")} onMouseLeave={() => setFocusLine(null)}>
              <Bullet id="A" color={A_LINE.color} ink={A_LINE.ink} size={30} />
              <span>
                <b>My New York</b>
                <small>Last stop: my photos</small>
              </span>
            </button>
            <Link href={`/${A_LINE.slug}`} className="legend-go">
              Ride →
            </Link>
          </li>
        </ul>
        <p className="hand hand-1">
          Take the train.
          <br />
          Explore the city. →
        </p>
      </section>

      <section className="home-map">
        {hasGeo ? (
          <div className="home-map-canvas">
            <NycMap
              selected={puma?.puma ?? null}
              focus={null}
              onPumaClick={() => setPicked(null)}
              fill={() => "var(--land)"}
              ariaLabel="Subway-style map of New York City with three topic lines"
            >
              {(project, zoom) => (
                <>
                  <Route line={aLine} project={project} zoom={zoom} width={5} dim={!!focusLine && focusLine !== "A"} labels={false} />
                  {LINES.map((l) => (
                    <Route
                      key={l.id}
                      line={l}
                      project={project}
                      zoom={zoom}
                      dim={!!focusLine && focusLine !== l.id}
                      activeStop={picked?.stop.id}
                      labels={!focusLine || focusLine === l.id}
                      labelFilter={focusLine ? undefined : (id) => !HIDE_LABELS.has(id)}
                      onStopClick={(id) => setPicked({ line: l, stop: l.stops.find((s) => s.id === id)! })}
                    />
                  ))}
                  {/* A-line terminal: My New York */}
                  {aLine.stops.length > 0 &&
                    (() => {
                      const last = aLine.stops[aLine.stops.length - 1];
                      const [x, y] = stopXY(project, last.at, [0, 0], zoom);
                      return (
                        <Link href={`/${A_LINE.slug}`}>
                          <g className="terminal" opacity={focusLine && focusLine !== "A" ? 0.2 : 1}>
                            <rect x={x + 10} y={y - 15} width={150} height={30} rx={15} fill={A_LINE.color} />
                            <text x={x + 85} y={y + 5} textAnchor="middle" fill="#fff" fontSize={13} fontWeight={700}>
                              MY NEW YORK →
                            </text>
                          </g>
                        </Link>
                      );
                    })()}
                </>
              )}
            </NycMap>
            <p className="hand hand-2">
              New data.
              <br />
              Same New York.
            </p>
          </div>
        ) : (
          <DataMissing />
        )}

        {picked && (
          <aside className="pop" role="dialog" aria-label={`${picked.stop.hood} details`}>
            <button className="pop-x" onClick={() => setPicked(null)} aria-label="Close">
              ×
            </button>
            <div className="pop-head">
              <Bullet id={picked.line.id} color={picked.line.color} ink={picked.line.ink} size={24} />
              <div>
                <h3>{picked.stop.hood}</h3>
                <small>
                  {picked.stop.station}
                  {puma ? ` · ${cdLabel(puma)}` : ""}
                </small>
              </div>
            </div>
            {nearPhoto && <img src={nearPhoto} alt="" className="pop-photo" />}
            <p className="pop-note">{picked.stop.note}</p>
            {puma ? (
            <dl className="pop-stats">
              {CARD_METRICS.map((k) => (
                <div key={k}>
                  <dt>{k === "foreign_born_pct" ? "Foreign-born" : k === "median_rent" ? "Median rent" : "Median household income"}</dt>
                  <dd>
                    {fmtMetric(k, value(puma, k), puma)}
                    <small>(vs. {fmtMetric(k, value(stats.city, k), stats.city)} NYC)</small>
                  </dd>
                </div>
              ))}
            </dl>
            ) : (
              <p className="muted small">Numbers appear after you run <code>npm run data</code>.</p>
            )}
            <Link className="pop-go" href={`/${picked.line.slug}`} style={{ background: picked.line.color, color: picked.line.ink }}>
              Ride the {picked.line.id}: {picked.line.topic} →
            </Link>
          </aside>
        )}
      </section>

      {hasData && (
        <section className="departures" aria-label="New York City at a glance">
          <div className="dep-title">
            <span>NEW YORK CITY · AT A GLANCE</span>
            <span>{stats.acs5.label.toUpperCase()}</span>
          </div>
          <div className="dep-grid">
            <div>
              <span className="dep-k">RESIDENTS</span>
              <span className="dep-v">{fmtInt(stats.city.population)}</span>
            </div>
            <div>
              <span className="dep-k">BORN ABROAD</span>
              <span className="dep-v">{fmtPct(stats.city.foreign_born_pct)}</span>
            </div>
            <div>
              <span className="dep-k">MEDIAN RENT</span>
              <span className="dep-v">{fmtUsd(stats.city.median_rent)}</span>
            </div>
            <div>
              <span className="dep-k">RENT-BURDENED</span>
              <span className="dep-v">{fmtPct(stats.city.rent_burden_pct)}</span>
            </div>
            <div>
              <span className="dep-k">MEDIAN INCOME</span>
              <span className="dep-v">{fmtUsd(stats.city.median_income)}</span>
            </div>
            <div>
              <span className="dep-k">RIDE THE SUBWAY TO WORK</span>
              <span className="dep-v">{fmtPct(stats.city.subway_commute_pct)}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
