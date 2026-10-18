"use client";

import { useMemo, useState } from "react";
import { lineBySlug } from "@/content/lines";
import { findPuma, hasData, pumaById, stats, shortName } from "@/lib/data";
import { fmtInt, fmtPct } from "@/lib/metrics";
import { immigrationFindings } from "@/lib/findings";
import Hologram, { REGION_GROUPS, regionGroup } from "@/components/map/Hologram";
import LineStrip from "@/components/ui/LineStrip";
import StationCard from "@/components/ui/StationCard";
import TrendChart from "@/components/charts/TrendChart";
import Notices from "@/components/ui/Notices";
import DataMissing from "@/components/ui/DataMissing";
import Section from "./Section";

export default function ImmigrationView() {
  const line = lineBySlug("immigration");
  const [active, setActiveRaw] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<"share" | "region">("share");
  const [country, setCountry] = useState<string | null>(null);

  const stopPumas = useMemo(() => line.stops.map((s) => findPuma(s.boro, s.cd)), [line]);
  if (!hasData) return <DataMissing />;

  const setActive = (i: number) => {
    setActiveRaw(i);
    setPicked(null);
  };
  const select = (id: string) => {
    const i = stopPumas.findIndex((p) => p?.puma === id);
    if (i >= 0) setActive(i);
    else setPicked(id);
  };
  const stop = line.stops[active];
  const shown = picked ? pumaById[picked] : stopPumas[active];
  const labeled = line.stops
    .map((s, i) => ({ puma: stopPumas[i]?.puma ?? "", label: s.hood }))
    .filter((l) => l.puma);

  const origins = stats.origins_city.slice(0, 12);
  const maxN = origins[0]?.n ?? 1;
  const litCount = country ? stats.pumas.filter((p) => p.top_origins.slice(0, 3).some((o) => o.country === country)).length : 0;

  return (
    <div className="topic topic-dark">
      <section className="topic-hero">
        <div className="eyebrow" style={{ color: "#e58be0" }}>
          Immigration · the 7 line
        </div>
        <h1>{line.name}</h1>
        <div className="topic-intro">
          <p>
            <b>{fmtInt(stats.city.foreign_born)}</b> New Yorkers, or <b>{fmtPct(stats.city.foreign_born_pct)}</b> of the city, were born in another
            country. Each pillar of light below is one of the city&apos;s {stats.n_pumas} neighborhoods, and its height is the share of residents
            born abroad. <b>Drag to tilt and spin it</b>, or turn on phone tilt.
          </p>
        </div>
      </section>

      <LineStrip id={line.id} color={line.color} ink={line.ink} name={line.tagline} stops={line.stops} active={active} onSelect={setActive} dark />

      <section className="topic-grid">
        <div>
          <div className="holo-toolbar">
            <div className="seg seg-dark" role="tablist" aria-label="Color pillars by">
              <button className={colorMode === "share" ? "on" : ""} onClick={() => setColorMode("share")}>
                Color: share born abroad
              </button>
              <button className={colorMode === "region" ? "on" : ""} onClick={() => setColorMode("region")}>
                Color: top birthplace region
              </button>
            </div>
            <label className="select-dark">
              <span>Where is…</span>
              <select value={country ?? ""} onChange={(e) => setCountry(e.target.value || null)}>
                <option value="">every birthplace</option>
                {stats.origins_city.map((o) => (
                  <option key={o.country} value={o.country}>
                    {o.country}
                  </option>
                ))}
              </select>
              {country && <em>a top-3 birthplace in {litCount} neighborhoods</em>}
            </label>
          </div>
          <Hologram selected={shown?.puma ?? null} onSelect={select} labeled={labeled} colorMode={colorMode} country={country} lineColor={line.color} />
          {colorMode === "region" && (
            <div className="holo-legend">
              {REGION_GROUPS.map((g) => (
                <span key={g.key}>
                  <i style={{ background: g.color }} /> {g.label}
                </span>
              ))}
              <span className="muted">· region of each neighborhood&apos;s #1 birthplace</span>
            </div>
          )}
        </div>

        <StationCard
          dark
          puma={shown}
          hood={picked && shown ? shortName(shown) : stop.hood}
          station={picked ? `${shown?.borough ?? ""} (not on the 7)` : stop.station}
          note={picked ? undefined : stop.note}
          line={line}
          metrics={["foreign_born_pct"]}
        >
          {shown && (
            <div className="origins">
              <div className="origins-title">Top birthplaces of residents born abroad</div>
              {shown.top_origins.map((o) => (
                <div className="origin-row" key={o.country}>
                  <span className="origin-name">
                    <i style={{ background: regionGroup(o.region, o.continent).color }} />
                    {o.country}
                  </span>
                  <span className="origin-bar">
                    <span style={{ width: `${o.pct_of_foreign_born ?? 0}%`, background: regionGroup(o.region, o.continent).color }} />
                  </span>
                  <span className="origin-val">{fmtPct(o.pct_of_foreign_born)}</span>
                </div>
              ))}
              <p className="card-foot">
                {shown.origins_over_1pct} different birthplaces each make up 1%+ of this neighborhood&apos;s immigrants (#
                {shown.ranks?.origins_over_1pct} of {stats.n_pumas} for variety).
              </p>
            </div>
          )}
        </StationCard>
      </section>

      <Section dark kicker="Arrivals" title="Where New Yorkers were born" dek={`Top birthplaces of NYC's foreign-born residents. Click one to light it up on the map above.`}>
        <div className="board">
          <div className="board-head">
            <span>#</span>
            <span>From</span>
            <span>Residents</span>
            <span>Share</span>
          </div>
          {origins.map((o, i) => (
            <button
              key={o.country}
              className={`board-row ${country === o.country ? "on" : ""}`}
              onClick={() => {
                setCountry(country === o.country ? null : o.country);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span className="board-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="board-from">
                <i style={{ background: regionGroup(o.region, o.continent).color }} />
                {o.country.toUpperCase()}
              </span>
              <span className="board-n">
                {fmtInt(o.n)}
                <span className="board-bar" style={{ width: `${(o.n / maxN) * 100}%` }} />
              </span>
              <span className="board-share">{fmtPct(o.share_of_foreign_born, 1)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section dark kicker="Over time" title="Share of residents born abroad, by borough" dek="ACS 1-year estimates. Every point has its own margin of error, so don't read too much into small year-to-year moves.">
        <TrendChart
          dark
          years={stats.series.years}
          series={Object.fromEntries(Object.entries(stats.series.geos).map(([k, v]) => [k, v.foreign_born_pct]))}
          format={(v) => fmtPct(v)}
          yLabel="Foreign-born share"
        />
      </Section>

      <Section dark kicker="Findings" title="What the 7 line tells us">
        <Notices items={immigrationFindings()} color={line.color} ink={line.ink} />
      </Section>
    </div>
  );
}
