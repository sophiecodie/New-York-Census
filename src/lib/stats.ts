/** Small, dependency-free statistics helpers used for the "findings" on each line. */

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx,
      dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Ordinary least squares y = a + b x. */
export function ols(xs: number[], ys: number[]): { a: number; b: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  if (!sxx) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

export function median(vs: number[]): number | null {
  if (!vs.length) return null;
  const s = [...vs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function describeR(r: number): string {
  const a = Math.abs(r);
  const strength = a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.2 ? "weak" : "almost no";
  if (strength === "almost no") return "almost no linear relationship";
  return `a ${strength} ${r > 0 ? "positive" : "negative"} relationship`;
}

/** First and last non-null points of a series, with their indexes. */
export function endpoints(vals: (number | null)[]) {
  let i0 = -1,
    i1 = -1;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] != null) {
      if (i0 < 0) i0 = i;
      i1 = i;
    }
  }
  if (i0 < 0 || i0 === i1) return null;
  return { i0, i1, v0: vals[i0] as number, v1: vals[i1] as number };
}
