// Route geometry helpers for the route maps (no Leaflet import, safe for SSR). Points are [lat, lng].
export type LL = [number, number];

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
export function km(a: LL, b: LL) {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Screen bearing in degrees (0 = east, clockwise positive) between two points, for rotating an arrowhead. */
export function screenAngle(a: LL, b: LL) {
  return (Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * Math.cos(rad(a[0]))) * 180) / Math.PI;
}
/** Point and direction at a fraction (0..1) of a polyline's length. */
export function along(line: LL[], f: number): { pos: LL; deg: number } | null {
  if (line.length < 2) return null;
  const seg = line.slice(1).map((p, i) => km(line[i], p));
  const total = seg.reduce((t, d) => t + d, 0);
  let target = total * f;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, target / seg[i]) : 0; const [a, b] = [line[i], line[i + 1]];
      return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], deg: screenAngle(a, b) };
    }
    target -= seg[i];
  }
  return null;
}
export const lengthKm = (line: LL[]) => line.slice(1).reduce((t, p, i) => t + km(line[i], p), 0);

/** Split a hub -> stops -> hub road line into legs at the stops (nearest line point, in visiting order). */
export function splitLegs(line: LL[], stops: LL[]): LL[][] {
  if (line.length < 2) return [];
  const cuts: number[] = [];
  let from = 0;
  for (const s of stops) {
    let best = from, bestD = Infinity;
    for (let i = from; i < line.length; i++) { const d = km(line[i], s); if (d < bestD) { bestD = d; best = i; } }
    cuts.push(best); from = best;
  }
  const legs: LL[][] = []; let start = 0;
  for (const c of [...cuts, line.length - 1]) { if (c > start) legs.push(line.slice(start, c + 1)); start = c; }
  return legs;
}

/** Stretches of an alternative line that are more than `minKm` away from the main line (where it uses other roads). */
export function differingStretches(alt: LL[], main: LL[], minKm = 0.5, minLengthKm = 2): LL[][] {
  if (alt.length < 2 || main.length < 2) return [];
  const step = Math.max(1, Math.floor(main.length / 1500));
  const sample = main.filter((_, i) => i % step === 0);
  const far = alt.map((p) => sample.every((q) => km(p, q) > minKm));
  const runs: LL[][] = []; let cur: LL[] = [];
  far.forEach((f, i) => { if (f) cur.push(alt[i]); else if (cur.length) { runs.push(cur); cur = []; } });
  if (cur.length) runs.push(cur);
  return runs.filter((r) => lengthKm(r) >= minLengthKm).sort((a, b) => lengthKm(b) - lengthKm(a)).slice(0, 3);
}
