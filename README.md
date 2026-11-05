<h1 align="center">🚇 The New York Census Line</h1>

<p align="center">
  <strong>A subway-map tour of New York City's five boroughs, built from public data.</strong><br>
  Ride the Q, 7 and 4 lines through housing, immigration and the economy, then end at your own New York on the A.
</p>

<p align="center">
  <a href="https://new-york-census.sophieshih.com"><strong>🌐 Try it live → new-york-census.sophieshih.com</strong></a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=next.js">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="D3" src="https://img.shields.io/badge/D3-geo%20%C2%B7%20scale%20%C2%B7%20shape-F9A03C?logo=d3.js&logoColor=white">
  <img alt="Data: US Census ACS" src="https://img.shields.io/badge/Data-US%20Census%20ACS-1f4e79">
  <img alt="Deployed on Vercel" src="https://img.shields.io/badge/Deployed%20on-Vercel-000?logo=vercel">
</p>

---

## The lines

| Line | Topic | What's on it |
|---|---|---|
| **Q** | Housing | Choropleth maps of median rent, rent burden, severe burden, renter share and affordable units, plus affordable-housing buildings from NYC Open Data as dots. Also: rent at every stop, scatterplots with Pearson's r, and inflation-adjusted trends. |
| **7** | Immigration | A **3D hologram** of all 55 neighborhoods. Pillar height is the share of residents born abroad. You can drag, use the sliders or tilt your phone to move it. Also: a "where is ___ a top-3 birthplace" filter, an arrivals board of birthplaces and borough trends. |
| **4** | Economy | Income and poverty stop-by-stop from the Bronx to Brooklyn, income vs. subway commuting, real income trends. |
| **A** | My New York | Your own photo map: the final destination. |

Each line ends with "service notices", which are findings computed from the data (correlations, gaps, trends). None of them are typed in by hand.

## Highlights

- **Real maps, no tile service:** all 55 NYC neighborhoods (PUMAs) drawn as SVG with d3-geo, rotated so Manhattan stands upright.
- **3D without WebGL:** the immigration hologram is plain CSS 3D transforms, and it responds to dragging, sliders or tilting your phone.
- **Honest numbers:** every estimate keeps its margin of error, and trends are inflation-adjusted with BLS CPI-U.
- **Findings written by the data:** each line's "service notices" are correlations, gaps and trends computed at build time.
- **Fully static:** `next build` exports a static site you can host anywhere.

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

## About

Built by **[Sophie Shih](https://sophieshih.com)**. Ideas and feedback are welcome:
[open an issue](https://github.com/sophiecodie/New-York-Census/issues).
