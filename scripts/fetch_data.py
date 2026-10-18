#!/usr/bin/env python3
"""
Same City, Different Stories: data pipeline
===========================================

Builds the two files the website reads:

    src/data/stats.json   every number on the site (ACS estimates + margins of error,
                          trends, birthplaces, affordable-housing totals)
    src/data/geo.json     simplified 2020 PUMA boundaries for the five boroughs

Sources
-------
1. U.S. Census Bureau, American Community Survey (Census Data API)
   - ACS 5-year, 55 NYC PUMAs (≈ community districts): the neighborhood stops
   - ACS 5-year, the 5 counties (boroughs) and New York City (place 51000)
   - ACS 1-year, 2010–latest, boroughs + NYC: the trend lines
2. U.S. Census Bureau TIGERweb REST API: PUMA boundaries (fallback geometry)
3. NYC Open Data:
   - "Affordable Housing Production by Building" (hg8x-zxpr), HPD
   - "2020 Public Use Microdata Areas (PUMAs)", NYC Dept. of City Planning
     (shoreline-clipped, preferred geometry; found through the Socrata catalog)
   - fallback: scripts/nyc_pumas_dcp.geojson (DCP boundaries, matched by community district)

Usage
-----
    export CENSUS_API_KEY=your_key      # free: https://api.census.gov/data/key_signup.html
    python3 scripts/fetch_data.py

Uses only the Python standard library, so nothing needs to be installed.

Options:
    --acs5-year 2024        force a 5-year vintage (default: newest available)
    --geometry file.geojson use a PUMA GeoJSON you downloaded yourself
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "src", "data")

CENSUS = "https://api.census.gov/data"
STATE = "36"
COUNTIES = {
    "005": "Bronx",
    "047": "Brooklyn",
    "061": "Manhattan",
    "081": "Queens",
    "085": "Staten Island",
}
NYC_PLACE = "51000"

# CPI-U, U.S. city average, all items, annual average (BLS series CUUR0000SA0).
# Used to put ACS 1-year dollar values (which are in each survey year's dollars)
# into constant dollars of the latest year.
CPI_U = {
    2010: 218.056, 2011: 224.939, 2012: 229.594, 2013: 232.957, 2014: 236.736,
    2015: 237.017, 2016: 240.007, 2017: 245.120, 2018: 251.107, 2019: 255.657,
    2020: 258.811, 2021: 270.970, 2022: 292.655, 2023: 304.702, 2024: 313.689,
}

AFFORDABLE_DATASET = "hg8x-zxpr"
NYC_ODP = "https://data.cityofnewyork.us"

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def get_json(url: str, params: dict | None = None, retries: int = 3, timeout: int = 180):
    if params:
        url = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(params, safe=":,*()'", quote_via=urllib.parse.quote)
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "same-city-different-stories/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read().decode("utf-8")
                if not body.strip():
                    return None
                return json.loads(body)
        except urllib.error.HTTPError as e:
            # 204 / 400 / 404 are "this does not exist"; don't retry those
            if e.code in (204, 400, 404):
                raise
            last = e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Request failed after {retries} tries: {url}\n  {last}")


# ---------------------------------------------------------------------------
# Census helpers
# ---------------------------------------------------------------------------

NULL_SENTINELS = {-999999999, -888888888, -666666666, -555555555, -333333333, -222222222}


def num(v):
    """Census strings -> float, with jam values / annotations -> None."""
    if v is None or v == "":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    if x < 0:
        return None
    return x


def moe(v):
    """MOE strings -> float. -555555555 means 'controlled, no sampling error' -> 0."""
    if v is None or v == "":
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    if x == -555555555:
        return 0.0
    if x < 0:
        return None
    return x


class Census:
    def __init__(self, key: str):
        self.key = key
        self._groups: dict = {}

    def get(self, year: int, dataset: str, variables: list[str], geo_for: str, geo_in: str | None = None):
        """Returns list of dict rows, merging chunked requests (API max 50 vars)."""
        url = f"{CENSUS}/{year}/{dataset}"
        geo_cols = None
        merged: dict[tuple, dict] = {}
        chunks = [variables[i:i + 45] for i in range(0, len(variables), 45)] or [[]]
        for chunk in chunks:
            params = {"get": ",".join(["NAME"] + chunk), "for": geo_for, "key": self.key}
            if geo_in:
                params["in"] = geo_in
            data = get_json(url, params)
            header, rows = data[0], data[1:]
            if geo_cols is None:
                geo_cols = [h for h in header if h not in chunk and h != "NAME"]
            for row in rows:
                rec = dict(zip(header, row))
                k = tuple(rec[c] for c in geo_cols)
                merged.setdefault(k, {}).update(rec)
        return list(merged.values())

    def group_vars(self, year: int, dataset: str, group: str) -> dict:
        """{var_name: label} for the estimate variables of a table."""
        ck = (year, dataset, group)
        if ck not in self._groups:
            meta = get_json(f"{CENSUS}/{year}/{dataset}/groups/{group}.json")
            out = {}
            for name, info in meta["variables"].items():
                if name.startswith(group + "_") and name.endswith("E") and not name.endswith("EA"):
                    out[name] = info["label"]
            self._groups[ck] = out
        return self._groups[ck]

    def find_var(self, year, dataset, group, pattern) -> str | None:
        rx = re.compile(pattern, re.I)
        hits = [n for n, lab in sorted(self.group_vars(year, dataset, group).items()) if rx.search(lab)]
        return hits[0] if hits else None


def prop_moe(n, n_m, d, d_m):
    """Census formula for the MOE of a proportion n/d (ACS Handbook, ch. 8)."""
    if None in (n, n_m, d, d_m) or not d:
        return None
    p = n / d
    under = n_m ** 2 - (p ** 2) * (d_m ** 2)
    if under < 0:  # fall back to the ratio formula, as Census recommends
        under = n_m ** 2 + (p ** 2) * (d_m ** 2)
    return math.sqrt(under) / d


def sum_moe(*ms):
    if any(m is None for m in ms):
        return None
    return math.sqrt(sum(m * m for m in ms))


def pct(x):
    return None if x is None else round(100 * x, 1)


def rnd(x, n=0):
    if x is None:
        return None
    return round(x) if n == 0 else round(x, n)


# ---------------------------------------------------------------------------
# Core ACS metrics (same definitions for PUMAs, boroughs, the city, every year)
# ---------------------------------------------------------------------------

BASE_TABLE_VARS = [
    "B01003_001",                     # total population
    "B05012_001", "B05012_003",       # nativity: total, foreign-born
    "B25064_001",                     # median gross rent
    "B25070_001", "B25070_007", "B25070_008", "B25070_009", "B25070_010", "B25070_011",
    "B25003_001", "B25003_003",       # tenure: occupied units, renter-occupied
    "B19013_001",                     # median household income
    "B17001_001", "B17001_002",       # poverty universe, below poverty
    "B23025_003", "B23025_005",       # civilian labor force, unemployed
]


def with_moe(vars_):
    return [v + "E" for v in vars_] + [v + "M" for v in vars_]


def metrics_from_row(r: dict, subway_var: str | None = None, include_moe=True) -> dict:
    E = lambda v: num(r.get(v + "E"))
    M = lambda v: moe(r.get(v + "M"))

    out: dict = {}
    pop = E("B01003_001")
    out["population"] = rnd(pop)

    # Immigration
    fb, fb_m, tot, tot_m = E("B05012_003"), M("B05012_003"), E("B05012_001"), M("B05012_001")
    out["foreign_born"] = rnd(fb)
    out["foreign_born_pct"] = pct(fb / tot) if fb is not None and tot else None
    if include_moe:
        out["foreign_born_pct_moe"] = pct(prop_moe(fb, fb_m, tot, tot_m))

    # Housing
    rent = E("B25064_001")
    out["median_rent"] = rnd(rent)
    out["median_rent_topcoded"] = rent is not None and rent in (2001, 3501, 4001)
    if include_moe:
        out["median_rent_moe"] = rnd(M("B25064_001"))

    burden_vars = ["B25070_007", "B25070_008", "B25070_009", "B25070_010"]
    b_vals = [E(v) for v in burden_vars]
    b_moes = [M(v) for v in burden_vars]
    r_tot, r_tot_m = E("B25070_001"), M("B25070_001")
    r_nc, r_nc_m = E("B25070_011"), M("B25070_011")
    if None not in b_vals and r_tot is not None and r_nc is not None and (r_tot - r_nc) > 0:
        computed = r_tot - r_nc
        burdened = sum(b_vals)
        out["rent_burden_pct"] = pct(burdened / computed)
        sev, sev_m = E("B25070_010"), M("B25070_010")
        out["severe_burden_pct"] = pct(sev / computed)
        if include_moe:
            computed_m = sum_moe(r_tot_m, r_nc_m)
            out["rent_burden_pct_moe"] = pct(prop_moe(burdened, sum_moe(*b_moes), computed, computed_m))
            out["severe_burden_pct_moe"] = pct(prop_moe(sev, sev_m, computed, computed_m))
    else:
        out["rent_burden_pct"] = out["severe_burden_pct"] = None

    occ, renters = E("B25003_001"), E("B25003_003")
    out["households"] = rnd(occ)
    out["renter_households"] = rnd(renters)
    out["renter_pct"] = pct(renters / occ) if occ and renters is not None else None
    if include_moe:
        out["renter_pct_moe"] = pct(prop_moe(renters, M("B25003_003"), occ, M("B25003_001")))

    # Economy
    inc = E("B19013_001")
    out["median_income"] = rnd(inc)
    out["median_income_topcoded"] = inc is not None and inc >= 250001
    if include_moe:
        out["median_income_moe"] = rnd(M("B19013_001"))

    pov, pov_u = E("B17001_002"), E("B17001_001")
    out["poverty_pct"] = pct(pov / pov_u) if pov is not None and pov_u else None
    if include_moe:
        out["poverty_pct_moe"] = pct(prop_moe(pov, M("B17001_002"), pov_u, M("B17001_001")))

    unemp, lf = E("B23025_005"), E("B23025_003")
    out["unemployment_pct"] = pct(unemp / lf) if unemp is not None and lf else None
    if include_moe:
        out["unemployment_pct_moe"] = pct(prop_moe(unemp, M("B23025_005"), lf, M("B23025_003")))

    if subway_var:
        sub, workers = E(subway_var), E("B08301_001")
        out["subway_commute_pct"] = pct(sub / workers) if sub is not None and workers else None
        if include_moe:
            out["subway_commute_pct_moe"] = pct(prop_moe(sub, M(subway_var), workers, M("B08301_001")))

    return out


# ---------------------------------------------------------------------------
# PUMA names
# ---------------------------------------------------------------------------

BORO_RX = r"(Bronx|Brooklyn|Manhattan|Queens|Staten Island)"


def parse_puma_name(name: str) -> dict:
    """
    'NYC-Manhattan Community District 12--Washington Heights, Inwood & Marble Hill PUMA; New York'
      -> {borough: Manhattan, cds: [12], short: 'Washington Heights, Inwood & Marble Hill'}
    """
    clean = name.split(";")[0].split(", New York")[0].strip()
    m = re.match(rf"NYC-{BORO_RX} Community Districts? ([\d\s,&and]+?)\s*--\s*(.+?)\s*PUMA\s*$", clean)
    if m:
        return {
            "borough": m.group(1),
            "cds": [int(x) for x in re.findall(r"\d+", m.group(2))],
            "short": m.group(3).strip(),
        }
    b = re.search(BORO_RX, clean)
    short = re.sub(r"^NYC-", "", clean)
    short = re.sub(r"\s*PUMA\s*$", "", short)
    return {"borough": b.group(1) if b else None, "cds": [], "short": short}


# ---------------------------------------------------------------------------
# Birthplaces (table B05006)
# ---------------------------------------------------------------------------


def clean_country(label_leaf: str) -> str:
    s = label_leaf.rstrip(":").strip()
    s = re.sub(r",\s*excluding.*$", "", s)
    s = re.sub(r"\s*\((inc|includ|excl)[^)]*\)", "", s, flags=re.I)
    return s.strip()


def birthplace_leaves(labels: dict) -> dict:
    """{var: {country, continent, region}} for leaf rows of B05006 (actual places)."""
    paths = {v: [p.rstrip(":") for p in lab.split("!!")] for v, lab in labels.items()}
    as_str = {v: "!!".join(p) for v, p in paths.items()}
    leaves = {}
    for v, p in paths.items():
        s = as_str[v]
        if any(o != s and o.startswith(s + "!!") for o in as_str.values()):
            continue  # has children -> not a leaf
        if len(p) < 4:  # 'Estimate!!Total' or a bare continent
            continue
        leaf = p[-1]
        if re.match(r"^other\b", leaf, re.I) or "n.e.c" in leaf.lower() or "not specified" in leaf.lower():
            continue
        if len(p) > 5 and p[3] == "Latin America":
            region = p[4]  # Caribbean / Central America / South America
        elif len(p) > 4:
            region = p[3]  # e.g. Eastern Asia, Northern Europe, Northern America
        else:
            region = p[2]
        leaves[v] = {
            "country": clean_country(leaf),
            "continent": p[2] if len(p) > 2 else None,
            "region": region,
        }
    return leaves


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------


def _perp_dist(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def simplify_ring(pts, tol):
    """Iterative Douglas–Peucker."""
    if len(pts) < 5:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        s, e = stack.pop()
        dmax, idx = 0.0, None
        for i in range(s + 1, e):
            d = _perp_dist(pts[i], pts[s], pts[e])
            if d > dmax:
                dmax, idx = d, i
        if idx is not None and dmax > tol:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    out = [p for p, k in zip(pts, keep) if k]
    if out[0] != out[-1]:
        out.append(out[0])
    return out


def ring_area(r):
    a = 0.0
    for (x1, y1), (x2, y2) in zip(r, r[1:]):
        a += x1 * y2 - x2 * y1
    return a / 2


def ring_centroid(r):
    a = ring_area(r)
    if a == 0:
        xs, ys = zip(*r)
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(r, r[1:]):
        f = x1 * y2 - x2 * y1
        cx += (x1 + x2) * f
        cy += (y1 + y2) * f
    return cx / (6 * a), cy / (6 * a)


def polygons_of(geom) -> list:
    if geom is None:
        return []
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def simplify_geometry(geom, tol=0.00025, min_area=2e-7):
    polys = []
    for poly in polygons_of(geom):
        rings = []
        for i, ring in enumerate(poly):
            ring = [[round(x, 5), round(y, 5)] for x, y, *_ in ring]
            s = simplify_ring(ring, tol)
            if len(s) >= 4 and abs(ring_area(s)) >= (min_area if i == 0 else min_area * 4):
                rings.append(s)
            elif i == 0:
                break
        if rings:
            polys.append(rings)
    if not polys:
        return None
    # d3-geo convention: exterior rings clockwise, holes counter-clockwise
    for rings in polys:
        for i, r in enumerate(rings):
            ccw = ring_area(r) > 0
            if (i == 0 and ccw) or (i > 0 and not ccw):
                r.reverse()
    return {"type": "MultiPolygon", "coordinates": polys}


def main_centroid(geom):
    best, best_a = None, -1
    for poly in polygons_of(geom):
        a = abs(ring_area(poly[0]))
        if a > best_a:
            best, best_a = poly[0], a
    return ring_centroid(best) if best else None


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def point_in_geom(x, y, geom):
    for poly in polygons_of(geom):
        if point_in_ring(x, y, poly[0]) and not any(point_in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


def bbox(geom):
    xs, ys = [], []
    for poly in polygons_of(geom):
        for x, y, *_ in poly[0]:
            xs.append(x)
            ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def puma_code(v) -> str | None:
    if v is None:
        return None
    s = re.sub(r"\D", "", str(v))
    if not s:
        return None
    return s[-5:].zfill(5)


def geometry_from_nyc_open_data(wanted: set[str]):
    """NYC DCP's shoreline-clipped 2020 PUMAs, found through the Socrata catalog."""
    cat = get_json(
        "https://api.us.socrata.com/api/catalog/v1",
        {"domains": "data.cityofnewyork.us", "search_context": "data.cityofnewyork.us",
         "q": "2020 Public Use Microdata Areas PUMAs", "limit": 20},
    )
    cands = []
    for res in cat.get("results", []):
        r = res.get("resource", {})
        nm = (r.get("name") or "").lower()
        if "microdata" in nm or "puma" in nm:
            score = ("2020" in nm) * 2 + ("water" not in nm)
            cands.append((score, r.get("id"), r.get("name")))
    for _, rid, name in sorted(cands, reverse=True):
        for url in (f"{NYC_ODP}/resource/{rid}.geojson?$limit=1000",
                    f"{NYC_ODP}/api/geospatial/{rid}?method=export&format=GeoJSON"):
            try:
                gj = get_json(url)
            except Exception:
                continue
            feats = (gj or {}).get("features") or []
            out = {}
            for f in feats:
                props = {k.lower(): v for k, v in (f.get("properties") or {}).items()}
                code = puma_code(props.get("puma") or props.get("puma2020") or props.get("pumacode"))
                if code in wanted and f.get("geometry"):
                    out[code] = f["geometry"]
            if len(out) >= 0.9 * len(wanted):
                log(f"  geometry: NYC Open Data '{name}' ({rid}), {len(out)} PUMAs")
                return out, f"NYC Open Data: {name} ({rid})"
    return None, None


def geometry_from_bundled(pumas: list[dict]):
    """
    Bundled fallback: NYC DCP PUMA boundaries (shoreline-clipped, simplified) shipped in
    scripts/nyc_pumas_dcp.geojson, matched to the Census PUMAs by borough + community district(s).
    NYC's PUMAs are built from community districts, so the shapes line up.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nyc_pumas_dcp.geojson")
    if not os.path.exists(path):
        return None, None
    with open(path) as fh:
        gj = json.load(fh)
    by_key = {(f["properties"]["borough"], tuple(sorted(f["properties"]["cds"]))): f["geometry"] for f in gj["features"]}
    out = {}
    for p in pumas:
        g = by_key.get((p["borough"], tuple(sorted(p["cds"]))))
        if g:
            out[p["puma"]] = g
    if len(out) >= 0.9 * len(pumas):
        log(f"  geometry: bundled NYC DCP boundaries matched by community district, {len(out)} PUMAs")
        return out, gj.get("source", "NYC Department of City Planning PUMA boundaries")
    return None, None


def geometry_from_tigerweb(wanted: set[str]):
    base = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer"
    meta = get_json(base, {"f": "json"})
    layers = [l for l in meta.get("layers", []) if "microdata" in l.get("name", "").lower()]
    layers.sort(key=lambda l: ("2020" in l["name"]), reverse=True)
    for layer in layers:
        try:
            gj = get_json(f"{base}/{layer['id']}/query", {
                "where": f"STATE='{STATE}'", "outFields": "*", "outSR": "4326",
                "f": "geojson", "returnGeometry": "true", "maxAllowableOffset": "0.0001",
            })
        except Exception:
            continue
        out = {}
        for f in (gj or {}).get("features", []):
            props = {k.upper(): v for k, v in (f.get("properties") or {}).items()}
            code = puma_code(props.get("PUMA") or props.get("PUMACE20") or props.get("GEOID"))
            if code in wanted and f.get("geometry"):
                out[code] = f["geometry"]
        if len(out) >= 0.9 * len(wanted):
            log(f"  geometry: TIGERweb layer '{layer['name']}', {len(out)} PUMAs")
            return out, f"Census TIGERweb: {layer['name']}"
    return None, None


# ---------------------------------------------------------------------------
# NYC Open Data: affordable housing
# ---------------------------------------------------------------------------


def to_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def fetch_affordable(app_token: str | None):
    params = {"$limit": "100000"}
    if app_token:
        params["$$app_token"] = app_token
    rows = get_json(f"{NYC_ODP}/resource/{AFFORDABLE_DATASET}.json", params)
    buildings = []
    dates = []
    for r in rows:
        try:
            lat, lng = float(r.get("latitude")), float(r.get("longitude"))
        except (TypeError, ValueError):
            lat = lng = None
        units = to_int(r.get("all_counted_units"))
        eli = to_int(r.get("extremely_low_income_units")) + to_int(r.get("very_low_income_units"))
        low = to_int(r.get("low_income_units"))
        typ = (r.get("reporting_construction_type") or "").strip()
        d = (r.get("project_start_date") or "")[:10]
        if d:
            dates.append(d)
        buildings.append({
            "lat": lat, "lng": lng, "units": units, "eli": eli, "low": low,
            "new": typ.lower().startswith("new"), "borough": r.get("borough"),
            "year": int(d[:4]) if d[:4].isdigit() else None,
        })
    return buildings, (min(dates) if dates else None), (max(dates) if dates else None)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def latest_year(census: Census, dataset: str, start: int) -> int:
    for y in range(start, 2009, -1):
        try:
            census.get(y, dataset, ["B01003_001E"], f"county:061", f"state:{STATE}")
            return y
        except Exception:
            continue
    raise RuntimeError(f"No {dataset} vintage found")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--key", default=os.environ.get("CENSUS_API_KEY"))
    ap.add_argument("--app-token", default=os.environ.get("NYC_APP_TOKEN"))
    ap.add_argument("--acs5-year", type=int)
    ap.add_argument("--geometry", help="local GeoJSON of 2020 PUMAs (needs a 'puma' property)")
    args = ap.parse_args()

    if not args.key:
        sys.exit("Set CENSUS_API_KEY (free: https://api.census.gov/data/key_signup.html) or pass --key")

    c = Census(args.key)
    this_year = date.today().year

    # ---- 1. Vintages -------------------------------------------------------
    y5 = args.acs5_year or latest_year(c, "acs/acs5", this_year - 1)
    log(f"ACS 5-year vintage: {y5 - 4}–{y5}")

    subway_var = c.find_var(y5, "acs/acs5", "B08301", r"Subway or elevated")
    log(f"  subway commute variable: {subway_var}")
    vars5 = with_moe(BASE_TABLE_VARS + ["B08301_001"] + ([subway_var[:-1]] if subway_var else []))
    sv = subway_var[:-1] if subway_var else None

    # ---- 2. PUMAs ------------------------------------------------------------
    log("Fetching PUMA estimates…")
    rows = c.get(y5, "acs/acs5", vars5, "public use microdata area:*", f"state:{STATE}")
    pumas = []
    for r in rows:
        if not r["NAME"].startswith("NYC-"):
            continue
        code = puma_code(r["public use microdata area"])
        info = parse_puma_name(r["NAME"])
        rec = {"puma": code, "name": r["NAME"].split(";")[0].split(", New York")[0], **info}
        rec.update(metrics_from_row(r, sv))
        pumas.append(rec)
    pumas.sort(key=lambda p: p["puma"])
    log(f"  {len(pumas)} NYC PUMAs")
    if len(pumas) < 50:
        log("  WARNING: expected ~55 NYC PUMAs")

    # Birthplaces
    log("Fetching birthplaces (B05006)…")
    labels = c.group_vars(y5, "acs/acs5", "B05006")
    leaves = birthplace_leaves(labels)
    bp_rows = c.get(y5, "acs/acs5", sorted(leaves), "public use microdata area:*", f"state:{STATE}")
    by_puma = {puma_code(r["public use microdata area"]): r for r in bp_rows}
    city_counts: dict[str, float] = {}
    country_meta: dict[str, dict] = {}
    for p in pumas:
        r = by_puma.get(p["puma"], {})
        counts = []
        for v, meta in leaves.items():
            n = num(r.get(v))
            if n:
                counts.append((n, meta["country"]))
                city_counts[meta["country"]] = city_counts.get(meta["country"], 0) + n
                country_meta[meta["country"]] = meta
        counts.sort(reverse=True)
        fb = p.get("foreign_born") or 0
        p["top_origins"] = [
            {"country": name, "n": rnd(n), "pct_of_foreign_born": pct(n / fb) if fb else None,
             "continent": country_meta[name]["continent"], "region": country_meta[name]["region"]}
            for n, name in counts[:5]
        ]
        # Diversity: how many birthplaces account for 1%+ of this PUMA's immigrants
        p["origins_over_1pct"] = sum(1 for n, _ in counts if fb and n / fb >= 0.01)

    # ---- 3. Boroughs + city (5-year) -----------------------------------------
    log("Fetching borough + city estimates…")
    boroughs = {}
    for r in c.get(y5, "acs/acs5", vars5, "county:" + ",".join(COUNTIES), f"state:{STATE}"):
        boroughs[COUNTIES[r["county"]]] = metrics_from_row(r, sv)
    city_row = c.get(y5, "acs/acs5", vars5, f"place:{NYC_PLACE}", f"state:{STATE}")[0]
    city = metrics_from_row(city_row, sv)

    total_fb = sum(city_counts.values()) or 1
    origins_city = [
        {"country": k, "n": rnd(v), "share_of_foreign_born": pct(v / total_fb),
         "continent": country_meta[k]["continent"], "region": country_meta[k]["region"]}
        for k, v in sorted(city_counts.items(), key=lambda kv: -kv[1])[:30]
    ]

    # ---- 4. Time series (1-year) ---------------------------------------------
    log("Fetching ACS 1-year series…")
    ts_vars = with_moe(BASE_TABLE_VARS)
    years, series_b, series_c = [], {b: [] for b in COUNTIES.values()}, []
    for y in range(2010, this_year):
        if y == 2020:  # 2020 1-year standard tables were not released (pandemic)
            continue
        try:
            rows_y = c.get(y, "acs/acs1", ts_vars, "county:" + ",".join(COUNTIES), f"state:{STATE}")
            city_y = c.get(y, "acs/acs1", ts_vars, f"place:{NYC_PLACE}", f"state:{STATE}")[0]
        except Exception as e:
            log(f"  {y}: not available ({type(e).__name__})")
            continue
        years.append(y)
        for r in rows_y:
            series_b[COUNTIES[r["county"]]].append(metrics_from_row(r, include_moe=False))
        series_c.append(metrics_from_row(city_y, include_moe=False))
        log(f"  {y} ✓")

    base_year = max(y for y in years if y in CPI_U) if years else None

    def real(vals_by_year, key):
        out = []
        for y, m in zip(years, vals_by_year):
            v = m.get(key)
            if v is None or y not in CPI_U or base_year is None:
                out.append(None)
            else:
                out.append(round(v * CPI_U[base_year] / CPI_U[y]))
        return out

    def pick(vals_by_year, key):
        return [m.get(key) for m in vals_by_year]

    series = {
        "years": years,
        "dollar_base_year": base_year,
        "geos": {},
    }
    for name, vals in list(series_b.items()) + [("New York City", series_c)]:
        series["geos"][name] = {
            "foreign_born_pct": pick(vals, "foreign_born_pct"),
            "median_rent": pick(vals, "median_rent"),
            "median_rent_real": real(vals, "median_rent"),
            "rent_burden_pct": pick(vals, "rent_burden_pct"),
            "severe_burden_pct": pick(vals, "severe_burden_pct"),
            "median_income": pick(vals, "median_income"),
            "median_income_real": real(vals, "median_income"),
            "poverty_pct": pick(vals, "poverty_pct"),
            "population": pick(vals, "population"),
            "foreign_born": pick(vals, "foreign_born"),
        }

    # ---- 5. Geometry -------------------------------------------------------------
    log("Fetching PUMA boundaries…")
    wanted = {p["puma"] for p in pumas}
    geoms, geo_source = None, None
    if args.geometry:
        with open(args.geometry) as fh:
            gj = json.load(fh)
        geoms = {}
        for f in gj["features"]:
            props = {k.lower(): v for k, v in f["properties"].items()}
            code = puma_code(props.get("puma") or props.get("puma2020") or props.get("pumace20"))
            if code in wanted:
                geoms[code] = f["geometry"]
        geo_source = f"local file {os.path.basename(args.geometry)}"
    if not geoms:
        try:
            geoms, geo_source = geometry_from_nyc_open_data(wanted)
        except Exception as e:
            log(f"  NYC Open Data geometry failed: {e}")
    if not geoms:
        geoms, geo_source = geometry_from_bundled(pumas)
    if not geoms:
        try:
            geoms, geo_source = geometry_from_tigerweb(wanted)
        except Exception as e:
            log(f"  TIGERweb geometry failed: {e}")
    if not geoms:
        sys.exit("Could not get PUMA boundaries. Download them from NYC Open Data and pass --geometry")

    features = []
    for p in pumas:
        g = geoms.get(p["puma"])
        if not g:
            log(f"  missing geometry for {p['puma']}")
            continue
        sg = simplify_geometry(g)
        if not sg:
            continue
        cx, cy = main_centroid(sg)
        p["centroid"] = [round(cx, 5), round(cy, 5)]
        p["_geom_full"] = g
        features.append({"type": "Feature", "properties": {"puma": p["puma"], "borough": p["borough"]}, "geometry": sg})

    # ---- 6. Affordable housing (NYC Open Data) -----------------------------------
    log("Fetching NYC affordable housing production…")
    affordable = {"available": False}
    points = []
    try:
        buildings, d0, d1 = fetch_affordable(args.app_token)
        boxes = {p["puma"]: bbox(p["_geom_full"]) for p in pumas if "_geom_full" in p}
        agg = {p["puma"]: {"units": 0, "eli": 0, "buildings": 0, "new_units": 0} for p in pumas}
        unlocated_units = 0
        for b in buildings:
            if b["lat"] is None or b["lng"] is None:
                unlocated_units += b["units"]
                continue
            hit = None
            for p in pumas:
                bx = boxes.get(p["puma"])
                if not bx or not (bx[0] <= b["lng"] <= bx[2] and bx[1] <= b["lat"] <= bx[3]):
                    continue
                if point_in_geom(b["lng"], b["lat"], p["_geom_full"]):
                    hit = p["puma"]
                    break
            if hit:
                a = agg[hit]
                a["units"] += b["units"]
                a["eli"] += b["eli"]
                a["buildings"] += 1
                a["new_units"] += b["units"] if b["new"] else 0
            if b["units"] > 0:
                points.append([round(b["lng"], 4), round(b["lat"], 4), b["units"], 1 if b["new"] else 0])
        total_units = sum(b["units"] for b in buildings)
        by_boro: dict[str, int] = {}
        for b in buildings:
            k = (b["borough"] or "Unknown").title()
            by_boro[k] = by_boro.get(k, 0) + b["units"]
        by_year: dict[int, int] = {}
        for b in buildings:
            if b["year"]:
                by_year[b["year"]] = by_year.get(b["year"], 0) + b["units"]
        for p in pumas:
            a = agg[p["puma"]]
            rh = p.get("renter_households") or 0
            p["affordable_units"] = a["units"]
            p["affordable_buildings"] = a["buildings"]
            p["affordable_eli_units"] = a["eli"]
            p["affordable_new_units"] = a["new_units"]
            p["affordable_per_1k_renter_hh"] = round(1000 * a["units"] / rh, 1) if rh else None
        affordable = {
            "available": True,
            "dataset": f"NYC Open Data: Affordable Housing Production by Building ({AFFORDABLE_DATASET})",
            "start": d0, "end": d1,
            "total_units": total_units,
            "buildings": len(buildings),
            "unlocated_units": unlocated_units,
            "eli_units": sum(b["eli"] for b in buildings),
            "new_construction_units": sum(b["units"] for b in buildings if b["new"]),
            "by_borough": by_boro,
            "by_year": {str(k): v for k, v in sorted(by_year.items())},
        }
        log(f"  {len(buildings)} buildings, {total_units:,} units")
    except Exception as e:
        log(f"  affordable housing skipped: {e}")

    for p in pumas:
        p.pop("_geom_full", None)

    # ---- 7. Ranks (1 = highest) ----------------------------------------------------
    rank_keys = ["foreign_born_pct", "median_rent", "rent_burden_pct", "severe_burden_pct", "renter_pct",
                 "median_income", "poverty_pct", "unemployment_pct", "subway_commute_pct",
                 "affordable_per_1k_renter_hh", "affordable_units", "origins_over_1pct"]
    for k in rank_keys:
        vals = sorted((p[k] for p in pumas if p.get(k) is not None), reverse=True)
        for p in pumas:
            v = p.get(k)
            if v is not None:
                p.setdefault("ranks", {})[k] = vals.index(v) + 1

    stats = {
        "generated": True,
        "generated_at": date.today().isoformat(),
        "acs5": {"year": y5, "label": f"ACS {y5 - 4}–{y5} 5-year estimates"},
        "n_pumas": len(pumas),
        "city": city,
        "boroughs": boroughs,
        "pumas": pumas,
        "origins_city": origins_city,
        "series": series,
        "affordable": affordable,
        "affordable_points": points,
        "sources": {
            "acs": f"U.S. Census Bureau, American Community Survey {y5 - 4}–{y5} 5-year and 1-year estimates, via the Census Data API",
            "geometry": geo_source,
            "affordable": affordable.get("dataset"),
            "cpi": "BLS CPI-U, U.S. city average, annual averages",
        },
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "stats.json"), "w") as fh:
        json.dump(stats, fh, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "geo.json"), "w") as fh:
        json.dump({"type": "FeatureCollection", "features": features}, fh, separators=(",", ":"))
    log(f"\nWrote {OUT_DIR}/stats.json and geo.json  ✓")


if __name__ == "__main__":
    main()
