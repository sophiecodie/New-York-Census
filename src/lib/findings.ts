import type { Finding } from "@/components/ui/Notices";
import type { Line } from "@/content/lines";
import { stats, findPuma, shortName, type Puma } from "./data";
import { fmtInt, fmtPct, fmtUsd, value, type MetricKey } from "./metrics";
import { describeR, endpoints, pearson } from "./stats";

const ACS = () => `Census ACS ${stats.acs5.year - 4}–${stats.acs5.year} 5-year, ${stats.n_pumas} PUMAs`;
const ACS1 = () => `Census ACS 1-year, ${stats.series.years[0]}–${stats.series.years[stats.series.years.length - 1]}`;

function extremes(k: MetricKey) {
  const ps = stats.pumas.filter((p) => value(p, k) != null);
  if (!ps.length) return null;
  const sorted = [...ps].sort((a, b) => (value(b, k) as number) - (value(a, k) as number));
  return { hi: sorted[0], lo: sorted[sorted.length - 1], all: sorted };
}

function corr(a: MetricKey, b: MetricKey) {
  const ps = stats.pumas.filter((p) => value(p, a) != null && value(p, b) != null);
  return pearson(
    ps.map((p) => value(p, a) as number),
    ps.map((p) => value(p, b) as number),
  );
}

function change(series: (number | null)[]) {
  const e = endpoints(series);
  if (!e) return null;
  return { ...e, y0: stats.series.years[e.i0], y1: stats.series.years[e.i1], pct: ((e.v1 - e.v0) / e.v0) * 100 };
}

const signed = (v: number, d = 0) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;
const name = (p: Puma) => `${shortName(p)} (${p.borough})`;

// --------------------------------------------------------------------------- housing

export function housingFindings(): Finding[] {
  const out: Finding[] = [];
  const ex = extremes("median_rent");
  if (ex) {
    const ratio = (ex.hi.median_rent as number) / (ex.lo.median_rent as number);
    out.push({
      stat: `${ratio.toFixed(1)}×`,
      title: "The rent gap",
      body:
        `Median gross rent in ${name(ex.hi)} is ${fmtUsd(ex.hi.median_rent)}${ex.hi.median_rent_topcoded ? "+" : ""}, ` +
        `${ratio.toFixed(1)} times the ${fmtUsd(ex.lo.median_rent)} in ${name(ex.lo)}.` +
        (ex.hi.median_rent_topcoded ? " The Census top-codes high rents, so the real gap is wider." : ""),
      source: ACS(),
    });
  }

  const rRent = corr("median_rent", "rent_burden_pct");
  const rInc = corr("median_income", "rent_burden_pct");
  if (rRent != null && rInc != null) {
    const incomeWins = Math.abs(rInc) > Math.abs(rRent);
    out.push({
      stat: `r = ${(incomeWins ? rInc : rRent).toFixed(2)}`,
      title: incomeWins ? "Burden follows income more than rent" : "Burden follows rent",
      body:
        `Across neighborhoods, the share of rent-burdened households has ${describeR(rInc)} with median income ` +
        `(r = ${rInc.toFixed(2)}) and ${describeR(rRent)} with median rent (r = ${rRent.toFixed(2)}).` +
        (incomeWins
          ? " The cheapest places to rent are often where rent takes the biggest bite out of income."
          : " Where rent is high, more renters are stretched."),
      source: ACS() + " · Pearson correlation",
    });
  }

  const burdened = stats.pumas.filter((p) => (p.rent_burden_pct ?? 0) >= 50);
  out.push({
    stat: `${burdened.length} of ${stats.n_pumas}`,
    title: "Neighborhoods where most renters are burdened",
    body:
      `In ${burdened.length} neighborhoods, at least half of renter households spend 30% or more of income on rent. ` +
      `Citywide the share is ${fmtPct(stats.city.rent_burden_pct)} (± ${stats.city.rent_burden_pct_moe?.toFixed(1)} pts), ` +
      `and ${fmtPct(stats.city.severe_burden_pct)} spend half or more.`,
    source: ACS(),
  });

  const nyc = stats.series.geos["New York City"];
  const ch = nyc ? change(nyc.median_rent_real) : null;
  if (ch) {
    const boros = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"]
      .map((b) => ({ b, c: change(stats.series.geos[b]?.median_rent_real ?? []) }))
      .filter((d) => d.c)
      .sort((a, b) => b.c!.pct - a.c!.pct);
    out.push({
      stat: `${signed(ch.pct)}%`,
      title: `Real rent, ${ch.y0} → ${ch.y1}`,
      body:
        `In ${stats.series.dollar_base_year} dollars, NYC's median gross rent went from ${fmtUsd(ch.v0)} to ${fmtUsd(ch.v1)}. ` +
        (boros.length ? `The biggest change was in ${boros[0].b} (${signed(boros[0].c!.pct)}%), the smallest in ${boros[boros.length - 1].b} (${signed(boros[boros.length - 1].c!.pct)}%).` : ""),
      source: ACS1() + " · CPI-U adjusted",
    });
  }

  const a = stats.affordable;
  if (a?.available && a.by_borough && a.total_units) {
    const top = Object.entries(a.by_borough).sort((x, y) => y[1] - x[1])[0];
    const exA = extremes("affordable_per_1k_renter_hh");
    out.push({
      stat: fmtInt(a.total_units),
      title: "Affordable units the city has financed",
      body:
        `Since ${a.start?.slice(0, 4)}, NYC's housing plans have counted ${fmtInt(a.total_units)} affordable units, new and preserved. ` +
        `${top[0]} has the most (${fmtPct((100 * top[1]) / a.total_units)}).` +
        (exA ? ` Per renter household, ${name(exA.hi)} leads with ${exA.hi.affordable_per_1k_renter_hh} units per 1,000.` : ""),
      source: "NYC Open Data, Affordable Housing Production by Building (HPD)",
    });
  }
  return out;
}

// --------------------------------------------------------------------------- immigration

export function immigrationFindings(): Finding[] {
  const out: Finding[] = [];
  const c = stats.city;
  out.push({
    stat: fmtPct(c.foreign_born_pct),
    title: "New Yorkers born abroad",
    body: `${fmtInt(c.foreign_born)} residents (${fmtPct(c.foreign_born_pct, 1)} ± ${c.foreign_born_pct_moe?.toFixed(1)} pts) were born outside the U.S.`,
    source: ACS(),
  });

  const ex = extremes("foreign_born_pct");
  if (ex) {
    const majority = stats.pumas.filter((p) => (p.foreign_born_pct ?? 0) >= 50);
    out.push({
      stat: fmtPct(ex.hi.foreign_born_pct),
      title: `Most foreign-born: ${shortName(ex.hi)}`,
      body:
        `${name(ex.hi)} has the highest share of residents born abroad. ${majority.length} neighborhoods are majority foreign-born; ` +
        `the lowest share is in ${name(ex.lo)} at ${fmtPct(ex.lo.foreign_born_pct)}.`,
      source: ACS(),
    });
  }

  const top = stats.origins_city[0];
  const firsts = new Set(stats.pumas.map((p) => p.top_origins[0]?.country).filter(Boolean));
  if (top) {
    out.push({
      stat: String(firsts.size),
      title: "Different #1 birthplaces",
      body:
        `${top.country} is the most common birthplace citywide (${fmtPct(top.share_of_foreign_born, 1)} of immigrants), ` +
        `but ${firsts.size} different countries are the #1 birthplace in at least one neighborhood.`,
      source: ACS() + ", table B05006",
    });
  }

  const nyc = stats.series.geos["New York City"];
  const ch = nyc ? change(nyc.foreign_born_pct) : null;
  if (ch) {
    const boros = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"]
      .map((b) => ({ b, c: change(stats.series.geos[b]?.foreign_born_pct ?? []) }))
      .filter((d) => d.c)
      .sort((a, b) => b.c!.v1 - b.c!.v0 - (a.c!.v1 - a.c!.v0));
    out.push({
      stat: `${signed(ch.v1 - ch.v0, 1)} pts`,
      title: `Foreign-born share, ${ch.y0} → ${ch.y1}`,
      body:
        `NYC's foreign-born share moved from ${fmtPct(ch.v0, 1)} to ${fmtPct(ch.v1, 1)}. ` +
        (boros.length
          ? `The biggest change was in ${boros[0].b} (${signed(boros[0].c!.v1 - boros[0].c!.v0, 1)} pts). 1-year estimates have wide margins, so treat small moves with caution.`
          : ""),
      source: ACS1(),
    });
  }
  return out;
}

// --------------------------------------------------------------------------- economy

export function economyFindings(line: Line): Finding[] {
  const out: Finding[] = [];
  const pts = line.stops.map((s) => ({ s, p: findPuma(s.boro, s.cd) }));
  let best: { a: (typeof pts)[0]; b: (typeof pts)[0]; ratio: number } | null = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    const va = a.p?.median_income,
      vb = b.p?.median_income;
    if (!va || !vb) continue;
    const ratio = Math.max(va, vb) / Math.min(va, vb);
    if (!best || ratio > best.ratio) best = { a, b, ratio };
  }
  if (best) {
    out.push({
      stat: `${best.ratio.toFixed(1)}×`,
      title: "One stop, a different economy",
      body:
        `Between ${best.a.s.hood} (${fmtUsd(best.a.p!.median_income)}) and ${best.b.s.hood} (${fmtUsd(best.b.p!.median_income)}), ` +
        `just one stop apart on the 4, median household income changes ${best.ratio.toFixed(1)}×.`,
      source: ACS(),
    });
  }

  const ex = extremes("median_income");
  if (ex) {
    out.push({
      stat: `${((ex.hi.median_income as number) / (ex.lo.median_income as number)).toFixed(1)}×`,
      title: "Richest vs. poorest neighborhood",
      body:
        `Median household income ranges from ${fmtUsd(ex.lo.median_income)} in ${name(ex.lo)} to ` +
        `${fmtUsd(ex.hi.median_income)}${ex.hi.median_income_topcoded ? "+" : ""} in ${name(ex.hi)}. NYC overall: ${fmtUsd(stats.city.median_income)}.`,
      source: ACS(),
    });
  }

  const rSub = corr("median_income", "subway_commute_pct");
  if (rSub != null) {
    const sub = extremes("subway_commute_pct");
    out.push({
      stat: `r = ${rSub.toFixed(2)}`,
      title: "Who rides the subway to work?",
      body:
        `${fmtPct(stats.city.subway_commute_pct)} of NYC workers commute mainly by subway. Across neighborhoods, subway commuting has ` +
        `${describeR(rSub)} with income.` +
        (sub ? ` Highest share: ${name(sub.hi)} (${fmtPct(sub.hi.subway_commute_pct)}); lowest: ${name(sub.lo)} (${fmtPct(sub.lo.subway_commute_pct)}).` : ""),
      source: ACS() + ", table B08301 · Pearson correlation",
    });
  }

  const nyc = stats.series.geos["New York City"];
  const ch = nyc ? change(nyc.median_income_real) : null;
  if (ch) {
    const pov = change(nyc.poverty_pct);
    out.push({
      stat: `${signed(ch.pct)}%`,
      title: `Real household income, ${ch.y0} → ${ch.y1}`,
      body:
        `In ${stats.series.dollar_base_year} dollars, NYC's median household income went from ${fmtUsd(ch.v0)} to ${fmtUsd(ch.v1)}.` +
        (pov ? ` The poverty rate moved from ${fmtPct(pov.v0, 1)} to ${fmtPct(pov.v1, 1)}.` : ""),
      source: ACS1() + " · CPI-U adjusted",
    });
  }
  return out;
}
