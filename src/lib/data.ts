import statsJson from "@/data/stats.json";
import geoJson from "@/data/geo.json";
import type { FeatureCollection, MultiPolygon } from "geojson";

export type Borough = "Bronx" | "Brooklyn" | "Manhattan" | "Queens" | "Staten Island";
export const BOROUGHS: Borough[] = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"];

export type Origin = {
  country: string;
  n: number;
  pct_of_foreign_born: number | null;
  continent?: string | null;
  region?: string | null;
};

/** Metrics shared by PUMAs, boroughs and the city (ACS 5-year). */
export type Metrics = {
  population: number | null;
  foreign_born: number | null;
  foreign_born_pct: number | null;
  foreign_born_pct_moe?: number | null;
  median_rent: number | null;
  median_rent_topcoded?: boolean;
  median_rent_moe?: number | null;
  rent_burden_pct: number | null;
  rent_burden_pct_moe?: number | null;
  severe_burden_pct: number | null;
  severe_burden_pct_moe?: number | null;
  households: number | null;
  renter_households: number | null;
  renter_pct: number | null;
  renter_pct_moe?: number | null;
  median_income: number | null;
  median_income_topcoded?: boolean;
  median_income_moe?: number | null;
  poverty_pct: number | null;
  poverty_pct_moe?: number | null;
  unemployment_pct: number | null;
  unemployment_pct_moe?: number | null;
  subway_commute_pct?: number | null;
  subway_commute_pct_moe?: number | null;
};

export type Puma = Metrics & {
  puma: string;
  name: string;
  borough: Borough;
  cds: number[];
  short: string;
  centroid?: [number, number];
  top_origins: Origin[];
  origins_over_1pct: number;
  affordable_units?: number;
  affordable_buildings?: number;
  affordable_eli_units?: number;
  affordable_new_units?: number;
  affordable_per_1k_renter_hh?: number | null;
  ranks?: Partial<Record<string, number>>;
};

export type SeriesGeo = {
  foreign_born_pct: (number | null)[];
  median_rent: (number | null)[];
  median_rent_real: (number | null)[];
  rent_burden_pct: (number | null)[];
  severe_burden_pct: (number | null)[];
  median_income: (number | null)[];
  median_income_real: (number | null)[];
  poverty_pct: (number | null)[];
  population: (number | null)[];
  foreign_born: (number | null)[];
};

export type Stats = {
  generated: boolean;
  generated_at: string;
  acs5: { year: number; label: string };
  n_pumas: number;
  city: Metrics;
  boroughs: Record<Borough, Metrics>;
  pumas: Puma[];
  origins_city: {
    country: string;
    n: number;
    share_of_foreign_born: number;
    continent: string | null;
    region: string | null;
  }[];
  series: { years: number[]; dollar_base_year: number | null; geos: Record<string, SeriesGeo> };
  affordable: {
    available: boolean;
    dataset?: string;
    start?: string | null;
    end?: string | null;
    total_units?: number;
    buildings?: number;
    unlocated_units?: number;
    eli_units?: number;
    new_construction_units?: number;
    by_borough?: Record<string, number>;
    by_year?: Record<string, number>;
  };
  /** [lng, lat, units, isNewConstruction] */
  affordable_points: [number, number, number, number][];
  sources: Record<string, string | null>;
};

export type PumaFeature = FeatureCollection<MultiPolygon, { puma: string; borough: Borough }>;

export const stats = statsJson as unknown as Stats;
/**
 * d3-geo wants polygon exteriors wound clockwise (RFC 7946 GeoJSON is counter-clockwise).
 * Wrong winding makes d3 treat a neighborhood as "the whole globe minus the neighborhood",
 * so normalise every ring once at load.
 */
function signedArea(ring: number[][]) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[i][0] - ring[j][0]) * (ring[i][1] + ring[j][1]);
  return a; // > 0 means clockwise in lng/lat
}
function rewind(fc: PumaFeature): PumaFeature {
  for (const f of fc.features) {
    const g = f.geometry as unknown as { type: string; coordinates: number[][][] | number[][][][] };
    const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as number[][][][];
    for (const poly of polys) {
      poly.forEach((ring, i) => {
        const cw = signedArea(ring) > 0;
        if ((i === 0 && !cw) || (i > 0 && cw)) ring.reverse();
      });
    }
  }
  return fc;
}

export const geo = rewind(geoJson as unknown as PumaFeature);
/** Boundaries ship with the repo, so maps draw even before the data script has run. */
export const hasGeo = geo.features.length > 0;
export const hasData = Boolean(stats.generated) && hasGeo;

// City-wide affordable-housing rate (units located in a PUMA / city renter households)
if (stats.generated && stats.affordable?.available && stats.city) {
  const units = stats.pumas.reduce((a, p) => a + (p.affordable_units ?? 0), 0);
  const rh = stats.city.renter_households;
  (stats.city as Record<string, unknown>).affordable_per_1k_renter_hh = rh ? Math.round((10000 * units) / rh) / 10 : null;
}

export const pumaById: Record<string, Puma> = Object.fromEntries(
  (stats.pumas ?? []).map((p) => [p.puma, p]),
);

export function findPuma(borough: Borough, cd: number): Puma | undefined {
  return (stats.pumas ?? []).find((p) => p.borough === borough && p.cds.includes(cd));
}

/** "Washington Heights, Inwood & Marble Hill" -> "Washington Heights" for tight labels. */
export function shortName(p: Puma): string {
  return p.short.split(/,| & /)[0].trim();
}

export function cdLabel(p: Puma): string {
  const abbr: Record<Borough, string> = {
    Bronx: "BX",
    Brooklyn: "BK",
    Manhattan: "MN",
    Queens: "QN",
    "Staten Island": "SI",
  };
  return `${abbr[p.borough]} CD ${p.cds.join(" & ")}`;
}
