"use client";

import { useState } from "react";
import { lineBySlug } from "@/content/lines";
import { findPuma, hasData, stats } from "@/lib/data";
import { fmtPct, fmtUsd } from "@/lib/metrics";
import { economyFindings } from "@/lib/findings";
import TopicLinePage from "./TopicLinePage";
import Section from "./Section";
import AlongLine from "@/components/charts/AlongLine";
import Scatter from "@/components/charts/Scatter";
import TrendChart from "@/components/charts/TrendChart";
import Notices from "@/components/ui/Notices";
import DataMissing from "@/components/ui/DataMissing";

const RAMP = ["#E8F5E4", "#B6E0AE", "#6DBE76", "#2B8A4B", "#0E5A2D"];

export default function EconomyView() {
  const line = lineBySlug("economy");
  const [trend, setTrend] = useState<"median_income_real" | "poverty_pct">("median_income_real");
  if (!hasData) return <DataMissing />;
  const points = line.stops.map((s) => ({ hood: s.hood, puma: findPuma(s.boro, s.cd) }));

  return (
    <TopicLinePage
      line={line}
      ramp={RAMP}
      mapMetrics={["median_income", "poverty_pct", "unemployment_pct", "subway_commute_pct"]}
      cardMetrics={["median_income", "poverty_pct", "unemployment_pct", "subway_commute_pct"]}
      intro={
        <>
          <p>
            NYC&apos;s median household income is <b>{fmtUsd(stats.city.median_income)}</b>, and <b>{fmtPct(stats.city.poverty_pct)}</b> of
            New Yorkers live below the federal poverty line. Those citywide numbers hide big differences between neighborhoods, and the 4
            train runs right through them.
          </p>
          <p className="muted small">The 4 runs from the Bronx, down Manhattan&apos;s East Side and into Brooklyn. Watch the income line as you ride.</p>
        </>
      }
    >
      {({ active, setActive, selected, select }) => (
        <>
          <Section kicker="Ride the 4" title="Income and poverty, stop by stop" dek="Two separate charts, one per measure, in the same stop order. The dashed line is NYC.">
            <h3 className="chart-title">Median household income</h3>
            <AlongLine k="median_income" points={points} color={line.color} active={active} onSelect={setActive} showLabels={false} height={200} />
            <h3 className="chart-title">Share of people below the poverty line</h3>
            <AlongLine k="poverty_pct" points={points} color={line.color} active={active} onSelect={setActive} />
          </Section>

          <Section kicker="All 55 neighborhoods" title="Do richer neighborhoods ride the subway more?" dek="Each dot is a neighborhood. Stops on the 4 are in green.">
            <div className="two-col">
              <Scatter xKey="median_income" yKey="subway_commute_pct" accent={line.color} highlight={points.map((p) => p.puma?.puma ?? "")} selected={selected} onSelect={select} />
              <Scatter xKey="median_income" yKey="unemployment_pct" accent={line.color} highlight={points.map((p) => p.puma?.puma ?? "")} selected={selected} onSelect={select} />
            </div>
          </Section>

          <Section
            kicker="Over time"
            title={trend === "median_income_real" ? "Median household income, adjusted for inflation" : "Poverty rate"}
            dek={trend === "median_income_real" ? `ACS 1-year estimates in ${stats.series.dollar_base_year} dollars (CPI-U).` : "ACS 1-year estimates."}
          >
            <div className="seg seg-light">
              <button className={trend === "median_income_real" ? "on" : ""} onClick={() => setTrend("median_income_real")}>
                Real income
              </button>
              <button className={trend === "poverty_pct" ? "on" : ""} onClick={() => setTrend("poverty_pct")}>
                Poverty
              </button>
            </div>
            <TrendChart
              years={stats.series.years}
              series={Object.fromEntries(Object.entries(stats.series.geos).map(([k, v]) => [k, v[trend]]))}
              format={(v) => (trend === "median_income_real" ? `$${Math.round(v / 1000)}K` : fmtPct(v))}
              yLabel={trend}
            />
          </Section>

          <Section kicker="Findings" title="What the 4 line tells us">
            <Notices items={economyFindings(line)} color={line.color} ink={line.ink} />
          </Section>
        </>
      )}
    </TopicLinePage>
  );
}
