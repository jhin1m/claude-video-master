// One-off builder for templates/geo/world.json (country outlines for the `geo` template).
// Input: Natural Earth 10m admin-0, Vietnam point of view (public domain):
//   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_vnm.geojson
// Usage: node src/graphics/build-world-geo.ts <ne_10m_admin_0_countries_vnm.geojson>
// Vietnam itself is left out: the template draws it from provinces (vietnam.json) plus both archipelagos.
import { readFileSync, writeFileSync } from 'node:fs';

type Ring = [number, number][];
interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } | null;
}

/** Douglas–Peucker tolerance in degrees (~2 km) — enough for a 1920 px frame zoomed to a small country. */
const TOLERANCE = 0.02;
/** Drop islands smaller than this (square degrees, ~25 km²) — invisible at any zoom the template uses. */
const MIN_AREA = 0.002;
/** Short names as Vietnamese media print them, where Natural Earth's NAME_VI differs or is too long for a map label. */
const NAME_OVERRIDE: Record<string, string> = {
  TWN: 'Đài Loan (TQ)', HKG: 'Hồng Kông (TQ)', MAC: 'Ma Cao (TQ)',
  PRK: 'Triều Tiên', GBR: 'Anh', ARE: 'UAE', ZAF: 'Nam Phi', TUN: 'Tunisia', MMR: 'Myanmar',
  COD: 'CHDC Congo', COG: 'Congo', IRL: 'Ireland', CYP: 'Síp', CAF: 'Trung Phi', DOM: 'CH Dominica',
  BIH: 'Bosnia', ATA: 'Nam Cực', GNQ: 'Guinea Xích Đạo',
};

function simplify(pts: Ring, tol: number): Ring {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]!;
    const [bx, by] = pts[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]!;
      // Closed rings start and end on the same point: fall back to distance from that point.
      const d = len < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const area = (r: Ring) => Math.abs(r.reduce((s, [x, y], i) => { const [nx, ny] = r[(i + 1) % r.length]!; return s + x * ny - nx * y; }, 0)) / 2;

const src = process.argv[2];
if (!src) throw new Error('usage: node src/graphics/build-world-geo.ts <ne_10m_admin_0_countries_vnm.geojson>');
const fc = JSON.parse(readFileSync(src, 'utf8')) as { features: Feature[] };

const countries = [];
for (const f of fc.features) {
  const p = f.properties;
  const iso = String(p.ADM0_A3);
  if (iso === 'VNM' || !f.geometry) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings: number[][] = [];
  for (const poly of polys) {
    // Outer ring only: lakes/holes are not drawn at this scale.
    const outer = poly[0]!;
    if (area(outer) < MIN_AREA) continue;
    const s = simplify(outer, TOLERANCE);
    if (s.length < 4) continue;
    rings.push(s.flatMap(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
  }
  if (!rings.length) continue;
  countries.push({
    iso,
    name: NAME_OVERRIDE[iso] ?? String(p.NAME_VI || p.NAME),
    label: [Number(p.LABEL_X), Number(p.LABEL_Y)],
    rings,
  });
}

const out = {
  source: 'Natural Earth 10m admin-0, Vietnam point of view (public domain), Douglas–Peucker 0.02°, islands < 0.002 deg² dropped, VNM omitted (drawn from vietnam.json provinces). Rebuild: node src/graphics/build-world-geo.ts',
  countries,
};
const dest = new URL('../../templates/geo/world.json', import.meta.url);
writeFileSync(dest, JSON.stringify(out));
console.log(`${countries.length} countries → ${dest.pathname} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
