"use client";

import { useState } from "react";
import { lineBySlug } from "@/content/lines";
import { findPuma, hasData, stats } from "@/lib/data";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/metrics";
import { housingFindings } from "@/lib/findings";
import TopicLinePage from "./TopicLinePage";
import Section from "./Section";
import AlongLine from "@/components/charts/AlongLine";
import Scatter from "@/components/charts/Scatter";
import TrendChart from "@/components/charts/TrendChart";
import Notices from "@/components/ui/Notices";
import DataMissing from "@/components/ui/DataMissing";

const RAMP = ["#FFF5CC", "#FBDC74", "#F2B53A", "#CC7F17", "#8A4B0C"];

export default function HousingView() {
  const line = lineBySlug("housing");
  const [trend, setTrend] = useState<"median_rent_real" | "rent_burden_pct">("median_rent_real");
  if (!hasData) return <DataMissing />;
  const points = line.stops.map((s) => ({ hood: s.hood, puma: findPuma(s.boro, s.cd) }));
  const a = stats.affordable;

  return (
    <TopicLinePage
      line={line}
      ramp={RAMP}
      mapMetrics={["median_rent", "rent_burden_pct", "severe_burden_pct", "renter_pct", "affordable_per_1k_renter_hh"]}
      cardMetrics={["median_rent", "rent_burden_pct", "renter_pct", "affordable_per_1k_renter_hh"]}
      overlayToggle={a.available ? "Affordable housing (NYC Open Data)" : undefined}
      overlay={
        a.available
          ? (project, zoom) => (
              <g pointerEvents="none">
                {stats.affordable_points.map(([lng, lat, units, isNew], i) => {
                  const [x, y] = project([lng, lat]);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={Math.max(0.8, Math.sqrt(units) * 0.22) / Math.sqrt(zoom)}
                      fill={isNew ? "#1d4ed8" : "#0f766e"}
                      fillOpacity={0.45}
                    />
                  );
                })}
              </g>
            )
          : undefined
      }
      overlayLegend={
        a.available ? (
          <>
            <div className="map-legend-title">Dots: affordable housing buildings</div>
            <div className="dot-key">
              <span>
                <i style={{ background: "#1d4ed8" }} /> New construction
              </span>
              <span>
                <i style={{ background: "#0f766e" }} /> Preserved
              </span>
            </div>
            <div className="dot-key dot-key-size">
              <i />
              <i />
              <i />
              <span>Bigger dot = more affordable units</span>
            </div>
          </>
        ) : undefined
      }
      intro={
        <>
          <p>
            New York is a city of renters: <b>{fmtPct(stats.city.renter_pct)}</b> of households rent their home. The citywide median gross
            rent is <b>{fmtUsd(stats.city.median_rent)}</b> a month, and <b>{fmtPct(stats.city.rent_burden_pct)}</b> of renter households
            are <em>rent-burdened</em>, meaning they spend 30% or more of their income on rent.
          </p>
          <p className="muted small">
            Ride the Q from the Upper East Side to Coney Island. At each stop the card compares that neighborhood with all {stats.n_pumas}.
            {a.available && (
              <>
                {" "}
                Dots on the map are {fmtInt(a.buildings)} buildings with city-financed affordable units (blue = new construction, teal =
                preservation).
              </>
            )}
          </p>
        </>
      }
    >
      {({ active, setActive, selected, select }) => (
        <>
          <Section kicker="Along the line" title="Rent and rent burden at every stop on the Q" dek="Click a stop to go there. The dashed line is the NYC value.">
            <h3 className="chart-title">Median gross rent</h3>
            <AlongLine k="median_rent" points={points} color={line.color} active={active} onSelect={setActive} showLabels={false} height={190} />
            <h3 className="chart-title">Rent-burdened households</h3>
            <AlongLine k="rent_burden_pct" points={points} color={line.color} active={active} onSelect={setActive} />
          </Section>

          <Section
            kicker="All 55 neighborhoods"
            title="Does rent burden follow income or rent?"
            dek="Each dot is a neighborhood (Census PUMA). The dashed line is the least-squares fit."
          >
            <div className="two-col">
              <Scatter xKey="median_income" yKey="rent_burden_pct" accent="#E0A800" highlight={points.map((p) => p.puma?.puma ?? "")} selected={selected} onSelect={select} />
              <Scatter xKey="median_rent" yKey="rent_burden_pct" accent="#E0A800" highlight={points.map((p) => p.puma?.puma ?? "")} selected={selected} onSelect={select} />
            </div>
          </Section>

          <Section
            kicker="Over time"
            title={trend === "median_rent_real" ? "Median rent, adjusted for inflation" : "Share of renters who are rent-burdened"}
            dek={
              trend === "median_rent_real"
                ? `ACS 1-year estimates in ${stats.series.dollar_base_year} dollars (CPI-U).`
                : "ACS 1-year estimates. Burden = gross rent is 30%+ of household income."
            }
          >
            <div className="seg seg-light">
              <button className={trend === "median_rent_real" ? "on" : ""} onClick={() => setTrend("median_rent_real")}>
                Real median rent
              </button>
              <button className={trend === "rent_burden_pct" ? "on" : ""} onClick={() => setTrend("rent_burden_pct")}>
                Rent burden
              </button>
            </div>
            <TrendChart
              years={stats.series.years}
              series={Object.fromEntries(Object.entries(stats.series.geos).map(([k, v]) => [k, v[trend]]))}
              format={(v) => (trend === "median_rent_real" ? fmtUsd(v) : fmtPct(v))}
              yLabel={trend}
            />
          </Section>

          <Section kicker="Findings" title="What the Q line tells us">
            <Notices items={housingFindings()} color={line.color} ink={line.ink} />
          </Section>
        </>
      )}
    </TopicLinePage>
  );
}
