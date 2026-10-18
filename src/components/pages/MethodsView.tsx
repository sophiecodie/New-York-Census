import { stats, hasData } from "@/lib/data";
import { METRICS } from "@/lib/metrics";
import { fmtInt } from "@/lib/metrics";

export default function MethodsView() {
  const y = hasData ? stats.acs5.year : null;
  return (
    <div className="topic methods">
      <section className="topic-hero">
        <div className="eyebrow">Data &amp; Methods</div>
        <h1>How this map was made</h1>
        <div className="topic-intro">
          <p>
            Every number on this site comes from public data, pulled by <code>scripts/fetch_data.py</code>. Nothing is typed in by hand.
          </p>
        </div>
      </section>

      <div className="methods-body">
        <h2>Sources</h2>
        <ul>
          <li>
            <b>U.S. Census Bureau, American Community Survey (Census Data API).</b> Neighborhood numbers are{" "}
            {y ? `${y - 4}–${y}` : "latest"} 5-year estimates for NYC&apos;s {hasData ? stats.n_pumas : 55} Public Use Microdata Areas (PUMAs). Borough and
            citywide numbers come from the same survey for the 5 counties and New York City (place 51000). Trend lines use 1-year estimates
            {hasData && stats.series.years.length ? ` (${stats.series.years[0]}–${stats.series.years[stats.series.years.length - 1]}, with no 2020 release)` : ""}.
          </li>
          <li>
            <b>PUMA boundaries:</b> {hasData ? stats.sources.geometry : "NYC Department of City Planning via NYC Open Data, or Census TIGERweb as a fallback"}.
            They are simplified for the web with Douglas–Peucker.
          </li>
          <li>
            <b>NYC Open Data, Affordable Housing Production by Building</b> (HPD, dataset <code>hg8x-zxpr</code>)
            {hasData && stats.affordable.available
              ? `: ${fmtInt(stats.affordable.buildings)} buildings and ${fmtInt(stats.affordable.total_units)} units with start dates from ${stats.affordable.start?.slice(0, 10)} to ${stats.affordable.end?.slice(0, 10)}`
              : ""}
            . Each building is matched to a PUMA by its coordinates (point-in-polygon).
          </li>
          <li>
            <b>BLS CPI-U</b> (U.S. city average, annual) puts dollar trend lines into constant {hasData ? stats.series.dollar_base_year : "latest-year"} dollars.
          </li>
        </ul>

        <h2>Why PUMAs?</h2>
        <p>
          A PUMA is the smallest area with at least 100,000 people that the Census publishes. In NYC, each PUMA matches a community district,
          or two combined, so it works as a stand-in for a &quot;neighborhood&quot;. A PUMA is big enough for reliable 5-year estimates
          and small enough to show real differences.
        </p>

        <h2>Measures</h2>
        <table className="methods-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th>Definition</th>
              <th>Source table</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(METRICS).map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{m.definition}</td>
                <td>{m.table}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Uncertainty</h2>
        <p>
          ACS numbers are survey estimates, so each one has a 90% margin of error (shown as ± on the station cards). For percentages built
          from two estimates, the margin of error uses the Census Bureau&apos;s formula for proportions. For sums like 30–34.9% + 35–39.9% +
          …, it uses the square root of the summed squared MOEs. When two neighborhoods&apos; ranges overlap, the gap between them may not be
          real. Rents and incomes above the Census top-code are shown with a &quot;+&quot;.
        </p>

        <h2>Statistics in the findings</h2>
        <p>
          Correlations are Pearson&apos;s r across all neighborhoods, and the scatterplot fit lines are ordinary least squares. They describe
          patterns across places, not individual households (beware the ecological fallacy), and they don&apos;t show cause and effect.
        </p>

        <h2>About the subway lines</h2>
        <p>
          Every stop is a real station, and the route bullets borrow MTA colors. But the lines are a storytelling device. The Q, 4 and 7 here
          don&apos;t follow their real routes exactly; the 7, for example, &quot;transfers&quot; to the Bronx, Brooklyn and the Staten Island
          Ferry. A stop shows the numbers for the PUMA it sits in.
        </p>

        <h2>Rebuild the data</h2>
        <pre>
          <code>{`export CENSUS_API_KEY=your_key
npm run data`}</code>
        </pre>
        {hasData && <p className="muted">Last generated {stats.generated_at}.</p>}
      </div>
    </div>
  );
}
