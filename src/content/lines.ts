import type { Borough } from "@/lib/data";
import type { MetricKey } from "@/lib/metrics";

/**
 * The subway lines. Each stop is a real station (its map position), and its
 * numbers come from the Census PUMA (≈ community district) it sits in.
 *
 *  boro + cd  -> which PUMA's statistics the stop shows
 *  at         -> [longitude, latitude] of the station, used to draw the line
 *  via        -> "ferry" draws the segment *into* this stop as a dashed ferry route
 *  note       -> your one-line context (keep numbers out of it; numbers come from the data)
 */
export type Stop = {
  id: string;
  station: string;
  /** neighborhood name shown on the map */
  hood: string;
  boro: Borough;
  cd: number;
  at: [number, number];
  via?: "ferry";
  label?: "left" | "right" | "top" | "bottom";
  note: string;
};

export type LineId = "7" | "Q" | "4" | "A";

export type Line = {
  id: LineId;
  slug: string;
  topic: string;
  name: string;
  color: string;
  ink: string; // text color on the bullet
  tagline: string;
  metrics: MetricKey[];
  stops: Stop[];
  /** small perpendicular nudge (px) so overlapping routes run side by side */
  offset: [number, number];
};

export const LINES: Line[] = [
  {
    id: "Q",
    slug: "housing",
    topic: "Housing",
    name: "The Rent Line",
    color: "#FCCC0A",
    ink: "#111111",
    tagline: "96 St to Coney Island: what a month of rent buys, and what it costs.",
    metrics: ["median_rent", "rent_burden_pct", "severe_burden_pct", "renter_pct", "affordable_per_1k_renter_hh"],
    offset: [-3, 2],
    stops: [
      {
        id: "q-ues",
        hood: "Upper East Side",
        station: "96 St",
        boro: "Manhattan",
        cd: 8,
        at: [-73.9472, 40.7841],
        label: "right",
        note: "The Second Avenue Subway finally reached the Upper East Side in 2017.",
      },
      {
        id: "q-midtown",
        hood: "Midtown",
        station: "Times Sq–42 St",
        boro: "Manhattan",
        cd: 5,
        at: [-73.9869, 40.7553],
        label: "left",
        note: "Offices, hotels and new towers. People live here too.",
      },
      {
        id: "q-chinatown",
        hood: "Chinatown & LES",
        station: "Canal St",
        boro: "Manhattan",
        cd: 3,
        at: [-73.999, 40.718],
        label: "left",
        note: "Tenement blocks next to glass condos, the front line of gentrification debates.",
      },
      {
        id: "q-dtbk",
        hood: "Downtown Brooklyn",
        station: "DeKalb Av",
        boro: "Brooklyn",
        cd: 2,
        at: [-73.9818, 40.6906],
        label: "bottom",
        note: "Downtown Brooklyn was rezoned in 2004 and has filled with high-rises since.",
      },
      {
        id: "q-flatbush",
        hood: "Flatbush",
        station: "Church Av",
        boro: "Brooklyn",
        cd: 14,
        at: [-73.9627, 40.6503],
        label: "left",
        note: "Prewar apartment buildings, many of them rent-stabilized.",
      },
      {
        id: "q-sheepshead",
        hood: "Sheepshead Bay",
        station: "Sheepshead Bay",
        boro: "Brooklyn",
        cd: 15,
        at: [-73.9541, 40.5866],
        label: "right",
        note: "Near the end of the line, by the bay and its fishing boats.",
      },
      {
        id: "q-coney",
        hood: "Coney Island",
        station: "Coney Island–Stillwell Av",
        boro: "Brooklyn",
        cd: 13,
        at: [-73.9813, 40.5774],
        label: "left",
        note: "End of the line: boardwalk, public housing towers and Brighton Beach next door.",
      },
    ],
  },
  {
    id: "7",
    slug: "immigration",
    topic: "Immigration",
    name: "The International Express",
    color: "#B933AD",
    ink: "#FFFFFF",
    tagline: "The 7 has been called the International Express. Ride it through the city's immigrant neighborhoods.",
    metrics: ["foreign_born_pct"],
    offset: [0, 0],
    stops: [
      {
        id: "7-fordham",
        hood: "Fordham",
        station: "Fordham Rd",
        boro: "Bronx",
        cd: 7,
        at: [-73.8977, 40.8613],
        label: "right",
        note: "Fordham Road, one of the Bronx's busiest shopping streets.",
      },
      {
        id: "7-wahi",
        hood: "Washington Heights",
        station: "181 St",
        boro: "Manhattan",
        cd: 12,
        at: [-73.9379, 40.8512],
        label: "left",
        note: "Uptown Manhattan, long a center of the city's Dominican community.",
      },
      {
        id: "7-jackson",
        hood: "Jackson Heights",
        station: "74 St–Broadway",
        boro: "Queens",
        cd: 3,
        at: [-73.8913, 40.7466],
        label: "bottom",
        note: "Jackson Heights is known for its South Asian and Latin American businesses.",
      },
      {
        id: "7-elmhurst",
        hood: "Elmhurst",
        station: "90 St–Elmhurst Av",
        boro: "Queens",
        cd: 4,
        at: [-73.8768, 40.7485],
        label: "right",
        note: "Elmhurst is often called one of the most diverse neighborhoods in the country.",
      },
      {
        id: "7-flushing",
        hood: "Flushing",
        station: "Flushing–Main St",
        boro: "Queens",
        cd: 7,
        at: [-73.8301, 40.7596],
        label: "right",
        note: "End of the 7: Main Street, one of the largest Chinatowns in the city.",
      },
      {
        id: "7-richmondhill",
        hood: "Richmond Hill",
        station: "111 St",
        boro: "Queens",
        cd: 9,
        at: [-73.83, 40.693],
        label: "right",
        note: "Liberty Avenue, home to the city's Guyanese and Indo-Caribbean community.",
      },
      {
        id: "7-eastflatbush",
        hood: "East Flatbush",
        station: "Church Av",
        boro: "Brooklyn",
        cd: 17,
        at: [-73.942, 40.649],
        label: "right",
        note: "East Flatbush, at the heart of the city's Caribbean community.",
      },
      {
        id: "7-sunsetpark",
        hood: "Sunset Park",
        station: "8 Av",
        boro: "Brooklyn",
        cd: 7,
        at: [-74.0115, 40.635],
        label: "left",
        note: "Sunset Park: Brooklyn's Chinatown on 8th Avenue, Latin American shops on 5th.",
      },
      {
        id: "7-statenisland",
        hood: "North Shore",
        station: "St. George",
        boro: "Staten Island",
        cd: 1,
        at: [-74.0736, 40.6437],
        via: "ferry",
        label: "left",
        note: "Take the ferry: the North Shore is home to Mexican, Liberian and Sri Lankan communities.",
      },
    ],
  },
  {
    id: "4",
    slug: "economy",
    topic: "Economy",
    name: "The Lexington Express",
    color: "#00933C",
    ink: "#FFFFFF",
    tagline: "Ride the 4 from the Bronx to Brooklyn and watch income rise and fall along the way.",
    metrics: ["median_income", "poverty_pct", "unemployment_pct", "subway_commute_pct"],
    offset: [3, -2],
    stops: [
      {
        id: "4-bedfordpark",
        hood: "Bedford Park",
        station: "Bedford Park Blvd",
        boro: "Bronx",
        cd: 7,
        at: [-73.8901, 40.8733],
        label: "right",
        note: "Near the top of the line, next to Lehman College and the Botanical Garden.",
      },
      {
        id: "4-burnside",
        hood: "Morris Heights",
        station: "Burnside Av",
        boro: "Bronx",
        cd: 5,
        at: [-73.9076, 40.8534],
        label: "left",
        note: "Under the elevated tracks on Jerome Avenue, rezoned in 2018.",
      },
      {
        id: "4-yankee",
        hood: "Highbridge & Concourse",
        station: "161 St–Yankee Stadium",
        boro: "Bronx",
        cd: 4,
        at: [-73.9258, 40.8279],
        label: "left",
        note: "Yankee Stadium and the Grand Concourse's Art Deco apartment buildings.",
      },
      {
        id: "4-motthaven",
        hood: "Mott Haven",
        station: "138 St–Grand Concourse",
        boro: "Bronx",
        cd: 1,
        at: [-73.9298, 40.8132],
        label: "right",
        note: "The South Bronx, just across the Harlem River from Manhattan.",
      },
      {
        id: "4-eastharlem",
        hood: "East Harlem",
        station: "125 St",
        boro: "Manhattan",
        cd: 11,
        at: [-73.9375, 40.8041],
        label: "right",
        note: "El Barrio: East Harlem, the first stop in Manhattan.",
      },
      {
        id: "4-ues",
        hood: "Upper East Side",
        station: "86 St",
        boro: "Manhattan",
        cd: 8,
        at: [-73.9556, 40.7795],
        label: "left",
        note: "Only a few stops from 125 St, yet a very different economy.",
      },
      {
        id: "4-grandcentral",
        hood: "Midtown",
        station: "Grand Central–42 St",
        boro: "Manhattan",
        cd: 5,
        at: [-73.9768, 40.7519],
        label: "right",
        note: "The office core, where many of the city's jobs are.",
      },
      {
        id: "4-wallst",
        hood: "Financial District",
        station: "Wall St",
        boro: "Manhattan",
        cd: 1,
        at: [-74.0113, 40.7074],
        label: "left",
        note: "The Financial District, now as much a residential neighborhood as an office one.",
      },
      {
        id: "4-boroughhall",
        hood: "Brooklyn Heights",
        station: "Borough Hall",
        boro: "Brooklyn",
        cd: 2,
        at: [-73.9901, 40.6929],
        label: "left",
        note: "Brooklyn's civic center, plus Brooklyn Heights and Fort Greene.",
      },
      {
        id: "4-utica",
        hood: "Crown Heights",
        station: "Crown Hts–Utica Av",
        boro: "Brooklyn",
        cd: 8,
        at: [-73.931, 40.6687],
        label: "right",
        note: "Where the 4 ends: Crown Heights, a neighborhood changing quickly.",
      },
    ],
  },
];

export const A_LINE = {
  id: "A" as const,
  slug: "my-new-york",
  topic: "My New York",
  name: "Last Stop: My New York",
  color: "#0039A6",
  ink: "#FFFFFF",
  tagline: "The final destination: the places that are mine.",
};

export const lineBySlug = (slug: string) => LINES.find((l) => l.slug === slug)!;
