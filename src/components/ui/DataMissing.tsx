export default function DataMissing() {
  return (
    <div className="data-missing">
      <h2>The trains aren&apos;t running yet</h2>
      <p>This page reads real Census and NYC Open Data numbers, which haven&apos;t been downloaded yet. To fetch them:</p>
      <pre>
        <code>{`export CENSUS_API_KEY=your_key   # free: api.census.gov/data/key_signup.html
npm run data`}</code>
      </pre>
      <p>That writes <code>src/data/stats.json</code> and <code>src/data/geo.json</code>. Then refresh this page.</p>
    </div>
  );
}
