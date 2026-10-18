import type { Metrics, Puma } from "./data";

export type MetricKey =
  | "foreign_born_pct"
  | "median_rent"
  | "rent_burden_pct"
  | "severe_burden_pct"
  | "renter_pct"
  | "median_income"
  | "poverty_pct"
  | "unemployment_pct"
  | "subway_commute_pct"
  | "affordable_per_1k_renter_hh";

export type MetricDef = {
  key: MetricKey;
  label: string;
  short: string;
  kind: "pct" | "usd" | "rate";
  /** what the number means, in one line */
  definition: string;
  table: string;
};

export const METRICS: Record<MetricKey, MetricDef> = {
  foreign_born_pct: {
    key: "foreign_born_pct",
    label: "Born outside the U.S.",
    short: "Foreign-born",
    kind: "pct",
    definition: "Share of residents born outside the United States and its territories.",
    table: "ACS B05012",
  },
  median_rent: {
    key: "median_rent",
    label: "Median gross rent",
    short: "Median rent",
    kind: "usd",
    definition: "Monthly contract rent plus utilities for renter-occupied units, median.",
    table: "ACS B25064",
  },
  rent_burden_pct: {
    key: "rent_burden_pct",
    label: "Rent-burdened households",
    short: "Rent-burdened",
    kind: "pct",
    definition: "Renter households paying 30% or more of income on gross rent.",
    table: "ACS B25070",
  },
  severe_burden_pct: {
    key: "severe_burden_pct",
    label: "Severely rent-burdened",
    short: "Severely burdened",
    kind: "pct",
    definition: "Renter households paying 50% or more of income on gross rent.",
    table: "ACS B25070",
  },
  renter_pct: {
    key: "renter_pct",
    label: "Households that rent",
    short: "Renters",
    kind: "pct",
    definition: "Share of occupied housing units that are renter-occupied.",
    table: "ACS B25003",
  },
  median_income: {
    key: "median_income",
    label: "Median household income",
    short: "Median income",
    kind: "usd",
    definition: "Household income in the past 12 months, median, in survey-year dollars.",
    table: "ACS B19013",
  },
  poverty_pct: {
    key: "poverty_pct",
    label: "Below the poverty line",
    short: "Poverty",
    kind: "pct",
    definition: "Share of people whose income is below the federal poverty threshold.",
    table: "ACS B17001",
  },
  unemployment_pct: {
    key: "unemployment_pct",
    label: "Unemployment rate",
    short: "Unemployment",
    kind: "pct",
    definition: "Unemployed people as a share of the civilian labor force (16+).",
    table: "ACS B23025",
  },
  subway_commute_pct: {
    key: "subway_commute_pct",
    label: "Take the subway to work",
    short: "Subway commuters",
    kind: "pct",
    definition: "Workers 16+ whose main way to work is subway or elevated rail.",
    table: "ACS B08301",
  },
  affordable_per_1k_renter_hh: {
    key: "affordable_per_1k_renter_hh",
    label: "Affordable units per 1,000 renter households",
    short: "Affordable units / 1k",
    kind: "rate",
    definition:
      "Units counted under NYC's Housing New York / Housing Our Neighbors plans (new + preserved), per 1,000 renter households.",
    table: "NYC Open Data hg8x-zxpr + ACS B25003",
  },
};

export function value(m: Partial<Metrics & Puma> | undefined, k: MetricKey): number | null {
  if (!m) return null;
  const v = (m as Record<string, unknown>)[k];
  return typeof v === "number" ? v : null;
}

export function moeOf(m: Partial<Metrics> | undefined, k: MetricKey): number | null {
  if (!m) return null;
  const v = (m as Record<string, unknown>)[`${k}_moe`];
  return typeof v === "number" ? v : null;
}

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const int0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmtUsd(v: number | null | undefined) {
  return v == null ? "—" : usd0.format(v);
}
export function fmtInt(v: number | null | undefined) {
  return v == null ? "—" : int0.format(v);
}
export function fmtPct(v: number | null | undefined, digits = 0) {
  return v == null ? "—" : `${v.toFixed(digits)}%`;
}
export function fmtCompact(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
  return int0.format(v);
}

export function fmtMetric(k: MetricKey, v: number | null | undefined, m?: Partial<Metrics>) {
  const def = METRICS[k];
  if (v == null) return "—";
  if (def.kind === "usd") {
    const top =
      (k === "median_rent" && m?.median_rent_topcoded) || (k === "median_income" && m?.median_income_topcoded);
    return fmtUsd(top ? v - 1 : v) + (top ? "+" : "");
  }
  if (def.kind === "rate") return v.toFixed(1);
  return fmtPct(v);
}

export function fmtMoe(k: MetricKey, moe: number | null) {
  if (moe == null) return "";
  const def = METRICS[k];
  if (def.kind === "usd") return `± ${fmtUsd(moe)}`;
  if (def.kind === "rate") return "";
  return `± ${moe.toFixed(1)} pts`;
}
