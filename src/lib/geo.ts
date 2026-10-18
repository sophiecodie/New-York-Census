import { geoMercator, geoPath, type GeoProjection } from "d3-geo";
import { line as d3line, curveCatmullRom } from "d3-shape";
import { geo } from "./data";

/**
 * Rotate the map so Manhattan's street grid runs straight up and down, the way
 * subway diagrams draw it. Set to 0 for true north.
 */
export const MAP_ANGLE = 29;

export type XY = [number, number];
export type Project = (lnglat: [number, number]) => XY;

const cache = new Map<string, GeoProjection>();

export function getProjection(width: number, height: number, pad = 24, angle = MAP_ANGLE): GeoProjection {
  const key = `${width}x${height}:${pad}:${angle}`;
  let p = cache.get(key);
  if (!p) {
    p = geoMercator().angle(angle);
    if (geo.features.length) {
      p.fitExtent(
        [
          [pad, pad],
          [width - pad, height - pad],
        ],
        geo,
      );
    } else {
      p.center([-73.94, 40.7]).scale(90000).translate([width / 2, height / 2]);
    }
    cache.set(key, p);
  }
  return p;
}

export function projector(p: GeoProjection): Project {
  return (ll) => (p(ll) as XY) ?? [0, 0];
}

export function pathFor(p: GeoProjection) {
  return geoPath(p);
}

/** Smooth subway-style curve through points. */
export const smoothLine = d3line<XY>()
  .x((d) => d[0])
  .y((d) => d[1])
  .curve(curveCatmullRom.alpha(0.5));
