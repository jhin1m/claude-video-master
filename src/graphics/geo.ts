// Real-geography map layer for the `geo` template, projected with Web Mercator into a 1920×1080
// "full view" that the template then zooms by transforming one <g>.
// Data (Natural Earth, simplified): templates/geo/vietnam.json = Vietnam's 63 provinces (pre-2025),
// templates/geo/world.json = every other country, Vietnam point of view (built by build-world-geo.ts).
// Hoàng Sa / Trường Sa are always drawn here as Vietnamese territory.
import { readFileSync } from 'node:fs';

interface Shape {
  rings: number[][];
}
interface Province extends Shape {
  name: string;
}
interface Country extends Shape {
  iso: string;
  name: string;
  label: LonLat;
}

export type LonLat = [number, number];
/** [lonMin, latMin, lonMax, latMax] */
export type BBox = [number, number, number, number];
export interface MapColors {
  land: string;
  /** Neighbouring countries in the Vietnam view. */
  landDim: string;
  border: string;
}
type Pt = [number, number];

const W = 1920;
const H = 1080;
/** Default full view: mainland Vietnam + both archipelagos. */
const VN_VIEW: BBox = [100.5, 7, 118, 23.8];
const VN_VIEW_CENTER_LON = 108;
const VN_LABEL: LonLat = [105.39, 21.72];
const VN_BOX: BBox = [102.1, 8.4, 109.5, 23.4];

const HOANG_SA: LonLat[] = [[111.6, 16.5], [112.3, 16.8], [111.2, 15.8], [112.7, 16.1], [111.8, 16.0], [112.0, 16.3]];
const TRUONG_SA: LonLat[] = [[114.3, 10.4], [115.8, 10.7], [112.9, 8.6], [114.9, 9.6], [116.1, 11.0], [113.8, 10.0], [114.4, 8.9]];
const SEA_LABELS: { text: string; at: LonLat }[] = [
  { text: 'QĐ Hoàng Sa', at: [112.0, 17.5] },
  { text: 'QĐ Trường Sa', at: [114.6, 11.8] },
];

/** Hand-placed labels for the default Vietnam view. */
const VN_VIEW_LABELS: { text: string; at: LonLat }[] = [
  { text: 'TRUNG QUỐC', at: [109.8, 23.4] },
  { text: 'LÀO', at: [102.6, 19.3] },
  { text: 'THÁI LAN', at: [101.0, 15.2] },
  { text: 'CAMPUCHIA', at: [104.8, 12.7] },
  { text: 'BIỂN ĐÔNG', at: [112.6, 13.4] },
];

const dataFile = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../templates/geo/${name}`, import.meta.url), 'utf8')) as T;
let vnCache: Province[] | undefined;
let worldCache: Country[] | undefined;
const provinces = () => (vnCache ??= dataFile<{ provinces: Province[] }>('vietnam.json').provinces);
const countries = () => (worldCache ??= dataFile<{ countries: Country[] }>('world.json').countries);

const merc = (lat: number) => {
  const l = Math.max(-85, Math.min(85, lat));
  return (Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360)) * 180) / Math.PI;
};

function ringBox(flat: number[]): BBox {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    x0 = Math.min(x0, flat[i]!);
    x1 = Math.max(x1, flat[i]!);
    y0 = Math.min(y0, flat[i + 1]!);
    y1 = Math.max(y1, flat[i + 1]!);
  }
  return [x0, y0, x1, y1];
}
/** Largest ring by (lon/lat) area — the mainland, ignoring islands and overseas parts. */
function mainRing(rings: number[][]): number[] {
  const area = (r: number[]) => {
    let a = 0;
    for (let i = 0; i < r.length; i += 2) {
      const j = (i + 2) % r.length;
      a += r[i]! * r[j + 1]! - r[j]! * r[i + 1]!;
    }
    return Math.abs(a);
  };
  return rings.reduce((a, b) => (area(b) > area(a) ? b : a));
}
const overlaps = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export interface GeoLayers {
  /** SVG content for the zoomable group. */
  world: string;
  /** Full-view labels (countries, sea, archipelagos) as absolutely positioned HTML. */
  labels: string;
}

export interface GeoView {
  /** Full-view projection: world → frame pixels. */
  project(ll: LonLat): Pt;
  /** Camera that frames `box`: scale k and the box centre in full-view pixels. */
  cameraFor(box: BBox): { k: number; cx: number; cy: number };
  /** A highlight's display name, label point (province centroid or country label point) and mainland box. */
  anchor(name: string): { text: string; at: LonLat; box: BBox };
  /**
   * `highlight` = Vietnamese province names and/or ISO-3 country codes (`VNM` = all of Vietnam).
   * `detail` = zoom factor the map will reach, so outlines keep sub-pixel accuracy after zooming.
   * `labels` replaces the automatic country labels. `colors` come from the theme.
   */
  layers(opts: { highlight: string[]; detail: number; labels?: { text: string; lon: number; lat: number }[]; colors: MapColors }): GeoLayers;
}

/**
 * Without `region`: the Vietnam view (neighbours dimmed, hand-placed labels).
 * With `region`: any part of the world, every country drawn alike, labels placed automatically.
 */
export function geoView(region?: BBox): GeoView {
  const vnMode = !region;
  const box = region ?? VN_VIEW;
  if (!(box[0] < box[2] && box[1] < box[3])) throw new Error(`geo: region phải là [lonMin, latMin, lonMax, latMax], nhận ${JSON.stringify(box)}`);
  const centerLon = vnMode ? VN_VIEW_CENTER_LON : (box[0] + box[2]) / 2;
  const scale = Math.min((W - 140) / (box[2] - box[0]), (H - 140) / (merc(box[3]) - merc(box[1])));
  const cy = (merc(box[3]) + merc(box[1])) / 2;

  const project = ([lon, lat]: LonLat): Pt => [W / 2 + (lon - centerLon) * scale, H / 2 - (merc(lat) - cy) * scale];
  const unprojectLat = (y: number) => (Math.atan(Math.exp((((H / 2 - y) / scale + cy) * Math.PI) / 180)) * 360) / Math.PI - 90;
  /** Lon/lat actually visible in the full view (the frame is wider/taller than `box` along one axis). */
  const visible: BBox = [centerLon - W / 2 / scale, unprojectLat(H), centerLon + W / 2 / scale, unprojectLat(0)];

  const cameraFor = (b: BBox) => {
    const [x0, y0] = project([b[0], b[3]]);
    const [x1, y1] = project([b[2], b[1]]);
    return { k: Math.min(W / (x1 - x0), H / (y1 - y0)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  const anchor = (name: string) => {
    if (name === 'VNM') return { text: 'Việt Nam', at: VN_LABEL, box: VN_BOX };
    const c = countries().find((x) => x.iso === name);
    if (c) return { text: c.name, at: c.label, box: ringBox(mainRing(c.rings)) };
    const p = provinces().find((x) => x.name === name);
    if (!p) throw new Error(`geo: "${name}" không phải tên tỉnh (templates/geo/vietnam.json) hay mã ISO-3 nước (templates/geo/world.json)`);
    // Rough label anchor: vertex average of the province's largest ring.
    const ring = p.rings.reduce((a, b) => (b.length > a.length ? b : a));
    let lon = 0;
    let lat = 0;
    for (let i = 0; i < ring.length; i += 2) {
      lon += ring[i]!;
      lat += ring[i + 1]!;
    }
    return { text: p.name, at: [lon / (ring.length / 2), lat / (ring.length / 2)] as LonLat, box: ringBox(ring) };
  };

  function layers({ highlight, detail, labels, colors }: { highlight: string[]; detail: number; labels?: { text: string; lon: number; lat: number }[]; colors: MapColors }): GeoLayers {
    highlight.forEach(anchor); // validates every name
    const cull: BBox = [visible[0] - 2, visible[1] - 2, visible[2] + 2, visible[3] + 2];
    // Drop vertices closer than ~0.6 px at the final zoom; skip rings smaller than that.
    const tol = 0.6 / Math.max(1, detail);
    const ringPath = (flat: number[]): string => {
      if (!overlaps(ringBox(flat), cull)) return '';
      let d = '';
      let n = 0;
      let last: Pt = [NaN, NaN];
      for (let i = 0; i < flat.length; i += 2) {
        const p = project([flat[i]!, flat[i + 1]!]);
        const isEnd = i === flat.length - 2;
        if (n && !isEnd && Math.abs(p[0] - last[0]) < tol && Math.abs(p[1] - last[1]) < tol) continue;
        d += `${n ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
        last = p;
        n++;
      }
      return n >= 3 ? d + 'Z' : '';
    };
    const shapePath = (s: Shape) => s.rings.map(ringPath).join('');

    const others = countries()
      .map((c) => {
        const d = shapePath(c);
        return d ? `<path${highlight.includes(c.iso) ? ` class="hi" data-name="${c.iso}"` : ''} d="${d}"/>` : '';
      })
      .join('');
    const vnHi = highlight.includes('VNM');
    const prov = provinces()
      .map((p) => `<path${highlight.includes(p.name) || vnHi ? ` class="hi" data-name="${p.name}"` : ''} d="${shapePath(p)}"/>`)
      .join('');
    // Archipelago dots stay visible (≥ 1.8 px) even on continent-wide views.
    const r = vnMode ? 2.6 : Math.min(2.6, Math.max(1.8, 0.08 * scale));
    const islands = [...HOANG_SA, ...TRUONG_SA]
      .map((ll) => {
        const [x, y] = project(ll);
        return `<circle${vnHi ? ' class="hi"' : ''} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
      })
      .join('');

    const { land, landDim, border: landStroke } = colors;
    const world = vnMode
      ? `<g fill="${landDim}" stroke="${landStroke}" stroke-opacity=".35" stroke-width="1">${others}</g>` +
        `<g id="vn" fill="${land}" stroke="${landStroke}" stroke-width="0.8">${prov}</g>` +
        `<g fill="${land}">${islands}</g>`
      : // Province borders hidden (stroke = fill); country borders drawn on top so Vietnam's outline stays visible.
        `<g id="vn" fill="${land}" stroke="${land}" stroke-width="0.6">${prov}</g>` +
        `<g fill="${land}" stroke="${landStroke}" stroke-width="1">${others}</g>` +
        `<g fill="${land}">${islands}</g>`;

    const label = (text: string, ll: LonLat, cls: string) => {
      const [x, y] = project(ll);
      return `<div class="${cls}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">${text}</div>`;
    };
    const inFrame = ([x, y]: Pt, m: number) => x > m && x < W - m && y > m && y < H - m;
    // Archipelago names always accompany the dots whenever they are legible.
    const seaLabels = box[2] - box[0] <= 40 ? SEA_LABELS.filter((l) => inFrame(project(l.at), 60)).map((l) => label(l.text, l.at, 'gl gi')).join('') : '';
    const countryLabels = vnMode
      ? VN_VIEW_LABELS.map((l) => label(l.text, l.at, 'gl')).join('')
      : labels
        ? labels.map((l) => label(l.text, [l.lon, l.lat], 'gl')).join('')
        : autoLabels();
    return { world, labels: countryLabels + seaLabels };

    /**
     * Vietnam first (whenever in frame), then the largest mainlands; a name is shown only if it fits
     * inside its mainland and clears the names already placed.
     */
    function autoLabels(): string {
      const vn = { text: 'VIỆT NAM', at: VN_LABEL, pos: project(VN_LABEL), w: Infinity, h: Infinity, tw: 8 * 24, area: Infinity };
      const cands = countries()
        .map((c) => ({ name: c.name, at: c.label, bb: ringBox(mainRing(c.rings)) }))
        .map((c) => {
          const [x0, y1] = project([c.bb[0], c.bb[1]]);
          const [x1, y0] = project([c.bb[2], c.bb[3]]);
          const w = Math.min(x1, W) - Math.max(x0, 0);
          const h = Math.min(y1, H) - Math.max(y0, 0);
          const text = c.name.toUpperCase();
          return { text, at: c.at, pos: project(c.at), w, h, tw: text.length * 24, area: w * h };
        })
        .filter((c) => c.w > 0 && c.h > 0 && inFrame(c.pos, 90) && c.tw <= c.w * 1.1 && c.h >= 45)
        .sort((a, b) => b.area - a.area);
      if (inFrame(vn.pos, 90)) cands.unshift(vn);
      const placed: BBox[] = [];
      const out: string[] = [];
      for (const c of cands) {
        const b: BBox = [c.pos[0] - c.tw / 2 - 16, c.pos[1] - 26, c.pos[0] + c.tw / 2 + 16, c.pos[1] + 26];
        if (placed.some((p) => overlaps(p, b))) continue;
        placed.push(b);
        out.push(label(c.text, c.at, 'gl'));
        if (out.length === 14) break;
      }
      return out.join('');
    }
  }

  return { project, cameraFor, anchor, layers };
}
