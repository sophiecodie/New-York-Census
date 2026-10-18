# The New York Census Line

A subway-map tour of New York City's five boroughs built from public data.

| Line | Topic | What's on it |
|---|---|---|
| **Q** | Housing | Choropleth maps of median rent, rent burden, severe burden, renter share and affordable units, plus affordable-housing buildings from NYC Open Data as dots. Also: rent at every stop, scatterplots with Pearson's r, and inflation-adjusted trends. |
| **7** | Immigration | A **3D hologram** of all 55 neighborhoods. Pillar height is the share of residents born abroad. You can drag, use the sliders or tilt your phone to move it. Also: a "where is ___ a top-3 birthplace" filter, an arrivals board of birthplaces and borough trends. |
| **4** | Economy | Income and poverty stop-by-stop from the Bronx to Brooklyn, income vs. subway commuting, real income trends. |
| **A** | My New York | Your own photo map: the final destination. |

Each line ends with "service notices", which are findings computed from the data (correlations, gaps, trends). None of them are typed in by hand.

## Run it

```bash
npm install

# 1. Get the data (free key, takes 2 minutes: https://api.census.gov/data/key_signup.html)
export CENSUS_API_KEY=your_key
npm run data            # = python3 scripts/fetch_data.py  (standard library only, nothing to pip install)

# 2. Look at it
npm run dev             # http://localhost:3000

# 3. Ship it
npm run build           # static site in /out, deploy to Vercel / Netlify / GitHub Pages
```

The maps already draw before step 1, because accurate NYC boundaries ship in the repo. The numbers appear once `npm run data` has run.

## Make it yours

- **Photos:** put images in `public/photos/` and edit `src/content/places.ts`, which holds each place's name, `[lng, lat]`, photos and caption. The blue A line connects your places in the order you list them.
- **Stops:** edit `src/content/lines.ts`. Each stop is a real station (`at`) plus the borough + community district whose Census numbers it shows. Write the `note` lines in your own voice.
- **Map orientation:** `MAP_ANGLE` in `src/lib/geo.ts` (29° makes Manhattan vertical; 0 = true north).

## Data

- **U.S. Census Bureau ACS** (Census Data API): 5-year estimates for NYC's 55 PUMAs, the 5 boroughs and the city, with margins of error. Trends use 1-year estimates from 2010 to the latest year (no 2020 release).
- **NYC Open Data**: Affordable Housing Production by Building (`hg8x-zxpr`), joined to neighborhoods by point-in-polygon.
- **Boundaries**: NYC DCP 2020 PUMAs from NYC Open Data when available. Otherwise the bundled DCP boundaries (`scripts/nyc_pumas_dcp.geojson`, via [nycehs/NYC_geography](https://github.com/nycehs/NYC_geography), GPL-3.0) are matched by community district. Census TIGERweb is the last resort.
- **BLS CPI-U** for inflation adjustment.

See the site's **Data & Methods** page for definitions and the MOE formulas.

## Stack

Next.js 15 (App Router, static export) · React 19 · TypeScript · d3-geo / d3-shape / d3-scale for the SVG maps and charts · plain CSS 3D transforms for the hologram (no WebGL). There's no map-tile service, so there's no API token to manage.
