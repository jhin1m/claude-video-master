// Graphic scene templates → standalone HyperFrames HTML (one composition per scene).
// A scene declares `visual.spec = { template, ...data }` in manifest.json; `cvm graphics` renders it.
// The same HTML also autoplays in a plain browser (e.g. published as an Artifact for phone review).
//
// Shared design language: editorial left-aligned grid (180 px margins), kicker = accent bar + masked
// rise, words rise out of masks, big numbers roll like an odometer, slow camera push + drifting glow
// keep the hold alive. Every template settles by ~2.5 s (scenes are 4.5–7.5 s).

import { geoView, type BBox } from './geo.ts';
import type { Theme } from './theme.ts';


type Tone = 'accent' | 'cyan' | 'muted' | 'dim';
/** Spec tones → theme colours (`cyan` is the secondary colour whatever its hue). */
const toneColor = (c: Theme['colors'], tone: Tone = 'accent') => ({ accent: c.accent, cyan: c.secondary, muted: c.line, dim: c.muted })[tone];

/**
 * Optional footage/photo behind any template: blurred, darkened, slow Ken Burns.
 * `src` is relative to the project dir; `cvm graphics` copies it next to index.html as bg.<ext>.
 */
export interface Background {
  src: string;
  /** Seconds into the source video to start from. */
  start?: number;
  /** Blur radius in px (default 6). */
  blur?: number;
  /** Brightness multiplier 0–1 (default 0.6). */
  dim?: number;
}

export const bgFileName = (b: Background) => `bg${b.src.slice(b.src.lastIndexOf('.')).toLowerCase()}`;
const isImage = (file: string) => /\.(png|jpe?g|webp)$/i.test(file);

export type GraphicSpec = { bg?: Background } & (
  | { template: 'counter'; kicker: string; to: number; from?: number; decimals?: number; unit: string; sub: string }
  | { template: 'bars'; kicker: string; items: { label: string; value: number; tone?: Tone }[]; unit: string; sub: string }
  | { template: 'ring'; kicker: string; pct: number; label: string; sub: string }
  | { template: 'map'; kicker: string; points: { label: string; x: number; y: number; highlight?: boolean; tag?: string }[]; links: [number, number][]; sub: string }
  /** `*chữ*` in `text` gets an accent marker; numbers are set in the numeric face and accent colour. */
  | { template: 'text'; kicker: string; text: string; sub: string }
  | { template: 'layers'; kicker: string; items: { label: string; value: string; tone?: Tone }[]; sub: string }
  | { template: 'smile'; kicker: string; sub: string; left: string; right: string; bottom: string }
  | { template: 'versus'; kicker: string; left: string; right: string; leftTag: string; rightTag: string; sub: string }
  | { template: 'chain'; kicker: string; label: string; sub: string }
  /**
   * Real map: opens on `region` (default: Vietnam view), then the camera zooms to `zoom`; both are
   * [lonMin, latMin, lonMax, latMax]. `highlight` = Vietnamese province names and/or ISO-3 country codes.
   * `labels` replaces the automatic country labels of a custom region.
   */
  | { template: 'geo'; kicker: string; region?: BBox; zoom: BBox; highlight?: string[]; labels?: { text: string; lon: number; lat: number }[]; pins: { label: string; lon: number; lat: number; tag?: string; main?: boolean }[]; sub: string }
  /** Columns + trend line; the last item is the headline number (rolling digits). */
  | { template: 'chart'; kicker: string; items: { label: string; value: number }[]; unit: string; label: string; badge?: string; sub: string }
  /** Chat window: `prompt` is typed into the input, sent, then `reply` streams in word by word. */
  | { template: 'chat'; prompt: string; reply: string }
  /**
   * Fast cuts through stills (project-relative 1920×1080 images), each with a year/era stamp;
   * `step` seconds per image (default 0.6), the last one holds to the end.
   */
  | { template: 'montage'; items: { src: string; year: string; label: string }[]; step?: number }
  /**
   * Two rival lines racing along a year axis (qualitative: `level` 0–1, no value axis is drawn).
   * `fade` = index of the line that dims once drawn; `marks` = labelled years revealed as the lines pass.
   */
  | { template: 'duel'; kicker: string; from: number; to: number; lines: { label: string; tone?: Tone; points: [number, number][] }[]; marks?: { year: number; label: string }[]; fade?: number; sub: string }
  /** Words of one sentence joined by glowing arcs (attention); arcs touching `focus` are drawn strongest. */
  | { template: 'links'; kicker: string; words: string[]; links: [number, number][]; focus?: number; sub: string }
);

export const TEMPLATES = ['counter', 'bars', 'ring', 'map', 'text', 'layers', 'smile', 'versus', 'chain', 'geo', 'chart', 'chat', 'montage', 'duel', 'links'] as const;

/**
 * Per-template output version (part of the `cvm graphics` cache key): bump one entry when that
 * template's output changes so only its scenes re-render. A change to shared code (baseCss, kick, sub,
 * mask, background, renderHtml) changes every template → bump every entry.
 */
export const TEMPLATE_VERSIONS: Record<(typeof TEMPLATES)[number], number> = {
  counter: 10, bars: 10, ring: 10, map: 10, text: 11, layers: 10, smile: 10, versus: 10,
  chain: 10, geo: 10, chart: 10, chat: 10, montage: 10, duel: 10, links: 10,
};

const MONTAGE_STEP = 0.6;
const extOf = (file: string) => file.slice(file.lastIndexOf('.')).toLowerCase();

/** Project files a spec needs next to its index.html: `src` (project-relative) → file name in the scene dir. */
export function specFiles(spec: GraphicSpec): { src: string; name: string }[] {
  const files = spec.bg ? [{ src: spec.bg.src, name: bgFileName(spec.bg) }] : [];
  if (spec.template === 'montage') spec.items.forEach((it, i) => files.push({ src: it.src, name: `m${i}${extOf(it.src)}` }));
  return files;
}

/** Chat pacing shared by the page script and its typing SFX. */
function chatTiming(spec: { prompt: string; reply: string }, seconds: number) {
  const type = Math.min(1.3, Math.max(0.6, [...spec.prompt].length * 0.03));
  const typeAt = 0.5;
  const send = typeAt + type + 0.2;
  const words = spec.reply.split(/\s+/).filter(Boolean);
  const streamAt = send + 0.45;
  const stream = Math.max(1.0, Math.min(words.length * 0.09, seconds - streamAt - 0.9));
  return { typeAt, type, send, streamAt, stream, words };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decimalsOf = (v: number) => (String(v).split('.')[1] ?? '').length;
/** Vietnamese number format: 1.234,5 */
const vn = (v: number, dec = decimalsOf(v)) => v.toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const f2 = (n: number) => n.toFixed(2);
/** `#rrggbb` + alpha → rgba() */
const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

interface Parts {
  body: string;
  css?: string;
  js: string[];
  /** Point the glow sits behind and the slow camera push converges on. */
  focus: [number, number];
  /** Content on the left third (footage stays visible on the right) or across the frame. */
  layout: 'left' | 'center';
}

/** Inline mask: the inner span rises out of it. Padding keeps stacked diacritics (Ấ, Ỗ) unclipped. */
const mask = (id: string, html: string) => `<span class="m"><span id="${id}" class="mi">${html}</span></span>`;
const rise = (sel: string, at: number, dur = 0.75) => `tl.fromTo("${sel}", { yPercent: 118 }, { yPercent: 0, duration: ${dur}, ease: "power4.out" }, ${f2(at)});`;
const countTo = (id: string, from: number, to: number, dec: number, at: number, dur: number, ease = 'power2.out') =>
  `{ const o = { v: ${from} }; tl.fromTo(o, { v: ${from} }, { v: ${to}, duration: ${dur}, ease: "${ease}", onUpdate: () => { document.getElementById("${id}").textContent = fmt(o.v, ${dec}); } }, ${f2(at)}); }`;

/**
 * Odometer: each digit is a strip 0…(10+d) that slides up — one extra revolution reads as spinning.
 * Adapted from the HyperFrames registry `number-wheel` component. Every glyph box is 1em tall.
 * The column takes the width of the digit it settles on (hidden sizer), so faces without tabular
 * figures don't leave a gap after a narrow "1"; wider digits are clipped only while spinning.
 */
function wheel(text: string, prefix: string) {
  let n = 0;
  const html = [...text]
    .map((ch) => {
      if (!/\d/.test(ch)) return `<span class="wc">${ch}</span>`;
      const stops = 10 + Number(ch);
      const digits = Array.from({ length: stops + 1 }, (_, i) => `<span>${i % 10}</span>`).join('');
      return `<span class="dg"><span class="dgw">${ch}</span><span class="dgs"><span id="${prefix}${n++}" class="st" data-stops="${stops}">${digits}</span></span></span>`;
    })
    .join('');
  const count = n;
  const js = (at: number, dur: number) =>
    Array.from({ length: count }, (_, i) => `{ const el = document.getElementById("${prefix}${i}"); const n = Number(el.dataset.stops); tl.fromTo(el, { yPercent: 0 }, { yPercent: -100 * n / (n + 1), duration: ${dur}, ease: "power3.out" }, ${f2(at + i * 0.06)}); }`);
  return { html, js };
}

/** Point on a cubic Bézier (used both here and, as the same formula, in the page script). */
const cubic = (p: number[][], t: number) => {
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((k) => w.reduce((s, wi, i) => s + wi * p[i]![k]!, 0)) as [number, number];
};
const polyLength = (pt: (t: number) => [number, number], steps = 80) => {
  let len = 0;
  let prev = pt(0);
  for (let i = 1; i <= steps; i++) {
    const cur = pt(i / steps);
    len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    prev = cur;
  }
  return len;
};

function build(spec: GraphicSpec, t: Theme, seconds: number): Parts {
  const c = t.colors;
  const ACC = c.accent;
  const CY = c.secondary;
  const kick = (text: string, cls = '') => `<div class="kick${cls ? ` ${cls}` : ''}"><i id="kq"></i>${mask('k', esc(text))}</div>`;
  const kickIn = (at = 0.1) => [`tl.fromTo("#kq", { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power3.out" }, ${f2(at)});`, rise('#k', at + 0.1, 0.7)];
  const sub = (text: string, cls = '') => `<div class="sub${cls ? ` ${cls}` : ''}"><div class="mb"><div id="s" class="mi">${esc(text)}</div></div></div>`;
  const pop = (sel: string, at: number, from = 0.4, ease = 'back.out(2.2)', dur = 0.5) => `tl.fromTo("${sel}", { opacity: 0, scale: ${from} }, { opacity: 1, scale: 1, duration: ${dur}, ease: "${ease}" }, ${f2(at)});`;

  switch (spec.template) {
    // Monumental number on the left: odometer roll, unit rises beside it on the same baseline,
    // an accent rule underlines the result, context line last.
    case 'counter': {
      const dec = spec.decimals ?? 0;
      const txt = vn(spec.to, dec);
      const digits = txt.replace(/\D/g, '').length;
      const size = digits <= 2 ? 440 : digits <= 3 ? 380 : digits <= 5 ? 300 : 230;
      const unitSize = 86;
      const w = spec.from === undefined ? wheel(txt, 'cw') : undefined;
      const from = spec.from ?? 0;
      const unitLift = size * t.baseline.numeric - unitSize * t.baseline.display;
      return {
        focus: [620, 520],
        layout: 'left',
        body: `<div class="col">${kick(spec.kicker)}<div class="cn"><div id="cnum" class="cnum num" style="font-size:${size}px">${w ? w.html : `<span id="v">${vn(from, dec)}</span>`}</div><div class="cu disp" style="margin-bottom:${unitLift.toFixed(1)}px">${mask('u', esc(spec.unit))}</div></div><div id="ru" class="rule"></div>${sub(spec.sub)}</div>`,
        css: `.cn{display:flex;flex-wrap:wrap;align-items:flex-end;column-gap:36px;margin-top:22px}.cnum{display:flex;align-items:flex-end;line-height:1;text-shadow:0 12px 60px rgba(0,0,0,.35)}.cu{display:flex;font-size:${unitSize}px;line-height:1;color:${ACC}}.rule{width:520px;height:8px;border-radius:4px;background:linear-gradient(90deg,${ACC},${c.accentHi});transform-origin:left center;margin:40px 0 30px}`,
        js: [
          ...kickIn(0.1),
          'tl.fromTo("#cnum", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.3);',
          ...(w ? w.js(0.4, 1.9) : [countTo('v', from, spec.to, dec, 0.4, 2.0)]),
          rise('#u', 1.2),
          'tl.fromTo("#ru", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "power3.inOut" }, 1.45);',
          rise('#s', 1.75),
        ],
      };
    }

    // Labelled horizontal bars; each value rides the tip of its bar while counting up.
    case 'bars': {
      const n = spec.items.length;
      const big = n <= 3;
      const trackW = 1230;
      const barH = big ? 92 : 58;
      const max = Math.max(...spec.items.map((i) => i.value));
      const rows = spec.items
        .map((it, i) => {
          const w = Math.round((it.value / max) * trackW);
          const col = toneColor(c, it.tone);
          const fill = it.tone === undefined || it.tone === 'accent' ? `linear-gradient(90deg,${ACC},${c.accentHi})` : col;
          return `<div class="br"><div class="bl disp">${mask(`bl${i}`, esc(it.label))}</div><div class="bt"><div class="bk"></div><div id="b${i}" class="bf${it.tone === undefined || it.tone === 'accent' ? ' hot' : ''}" style="width:${w}px;background:${fill}"></div><div id="bw${i}" class="bv num" style="left:${w + 30}px"><span id="bv${i}">0</span></div></div></div>`;
        })
        .join('');
      return {
        focus: [700, 540],
        layout: 'left',
        body: `<div class="col"><div class="bh">${kick(spec.kicker)}<div class="bu">${mask('bu', esc(spec.unit))}</div></div><div class="rows">${rows}</div>${sub(spec.sub)}</div>`,
        css: `.bh{display:flex;justify-content:space-between;align-items:center;width:100%}.bu{font-size:30px;font-weight:700;color:${c.textLabel};letter-spacing:2px}
.rows{width:100%;display:flex;flex-direction:column;gap:${big ? 44 : 26}px;margin:${big ? 64 : 44}px 0 ${big ? 60 : 44}px}
.bl{font-size:${big ? 46 : 34}px;line-height:1.15;margin-bottom:${big ? 16 : 10}px}.bt{position:relative;height:${barH}px}
.bk{position:absolute;left:0;top:0;bottom:0;width:${trackW}px;border-radius:0 12px 12px 0;background:rgba(255,255,255,.045)}
.bf{position:absolute;left:0;top:0;bottom:0;border-radius:0 12px 12px 0;transform-origin:left center}.bf.hot{filter:drop-shadow(0 0 26px ${c.glow})}
.bv{position:absolute;top:0;bottom:0;display:flex;align-items:center;font-size:${big ? 104 : 66}px;line-height:1;white-space:nowrap}`,
        js: [
          ...kickIn(0.1),
          rise('#bu', 0.3),
          ...spec.items.flatMap((it, i) => {
            const at = 0.55 + i * 0.2;
            const w = Math.round((it.value / max) * trackW);
            return [
              rise(`#bl${i}`, 0.3 + i * 0.12),
              `tl.fromTo("#b${i}", { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: "power3.out" }, ${f2(at)});`,
              `tl.fromTo("#bw${i}", { x: ${-w - 30}, opacity: 0 }, { x: 0, opacity: 1, duration: 1.3, ease: "power3.out" }, ${f2(at)});`,
              countTo(`bv${i}`, 0, it.value, decimalsOf(it.value), at, 1.3, 'power3.out'),
            ];
          }),
          rise('#s', 0.9 + n * 0.2),
        ],
      };
    }

    // Split: gauge on the left (arc + travelling tip + outer ticks), the statement on the right.
    case 'ring': {
      const r = 250;
      const circ = 2 * Math.PI * r;
      const ticks = Array.from({ length: 50 }, (_, i) => {
        const major = i % 5 === 0;
        return `<line x1="350" y1="${major ? 30 : 38}" x2="350" y2="54" stroke="${major ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.13)'}" stroke-width="${major ? 5 : 3}" stroke-linecap="round" transform="rotate(${i * 7.2} 350 350)"/>`;
      }).join('');
      const deg = (360 * spec.pct) / 100;
      return {
        focus: [560, 540],
        layout: 'center',
        body: `<div id="rw" class="rw"><svg width="700" height="700" viewBox="0 0 700 700"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.accentHi}"/><stop offset="1" stop-color="${ACC}"/></linearGradient></defs><g id="tk">${ticks}</g><circle cx="350" cy="350" r="${r}" stroke="rgba(255,255,255,.07)" stroke-width="44" fill="none"/><circle id="arc" class="arc" cx="350" cy="350" r="${r}" stroke="url(#rg)" stroke-width="44" stroke-linecap="round" fill="none" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${circ.toFixed(1)}" transform="rotate(-90 350 350)"/><g id="tip"><circle cx="350" cy="100" r="13" fill="${c.text}"/></g></svg><div class="pc num"><div id="pc"><span id="v">0</span><span class="pct">%</span></div></div></div>` +
          `<div class="rc">${kick(spec.kicker)}<div class="rl disp">${esc(spec.label)
            .split(' ')
            .map((wd, i) => mask(`rl${i}`, wd))
            .join(' ')}</div><div id="ru" class="rule"></div>${sub(spec.sub)}</div>`,
        css: `.rw{position:absolute;left:210px;top:190px;width:700px;height:700px}.arc{filter:drop-shadow(0 0 20px ${c.glow})}#tip{filter:drop-shadow(0 0 12px ${c.accentHi})}
.pc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:200px;line-height:1;text-shadow:0 8px 40px rgba(0,0,0,.5)}.pct{font-size:92px;color:${ACC};margin-left:6px}
.rc{position:absolute;left:1000px;right:170px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.rl{font-size:76px;line-height:1.12;margin-top:30px}.rule{width:200px;height:8px;border-radius:4px;background:${ACC};transform-origin:left center;margin:40px 0 28px}`,
        js: [
          'tl.fromTo("#rw", { opacity: 0, scale: 0.84, rotation: -25 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.9, ease: "power3.out" }, 0.05);',
          `tl.fromTo("#arc", { attr: { "stroke-dashoffset": ${circ.toFixed(1)} } }, { attr: { "stroke-dashoffset": ${(circ * (1 - spec.pct / 100)).toFixed(1)} }, duration: 1.8, ease: "power2.out" }, 0.4);`,
          `tl.fromTo("#tip", { rotation: 0, svgOrigin: "350 350" }, { rotation: ${deg.toFixed(1)}, svgOrigin: "350 350", duration: 1.8, ease: "power2.out" }, 0.4);`,
          countTo('v', 0, spec.pct, decimalsOf(spec.pct), 0.4, 1.8),
          'tl.fromTo("#pc", { scale: 1 }, { scale: 1.06, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1 }, 2.2);',
          ...kickIn(0.5),
          ...spec.label.split(' ').map((_, i) => rise(`#rl${i}`, 0.75 + Math.min(i * 0.07, 0.5))),
          'tl.fromTo("#ru", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.inOut" }, 1.5);',
          rise('#s', 1.7),
        ],
      };
    }

    // Abstract point map: pulsing pins, curved routes drawn by a travelling dot, arrowhead on arrival.
    case 'map': {
      const pinAt = (i: number) => 0.35 + i * 0.3;
      const radius = (i: number) => (spec.points[i]!.highlight ? 20 : 13) + 20;
      // Label goes on the side the links don't come from.
      const labelLeft = spec.points.map((p, i) => {
        const dx = spec.links.filter((l) => l.includes(i)).reduce((s, [a, b]) => s + spec.points[a === i ? b : a]!.x - p.x, 0);
        return dx > 0;
      });
      const routes = spec.links.map(([a, b], i) => {
        const pa0 = spec.points[a]!;
        const pb0 = spec.points[b]!;
        const ux = (pb0.x - pa0.x) / Math.hypot(pb0.x - pa0.x, pb0.y - pa0.y);
        const uy = (pb0.y - pa0.y) / Math.hypot(pb0.x - pa0.x, pb0.y - pa0.y);
        const pa = { x: pa0.x + ux * radius(a), y: pa0.y + uy * radius(a) };
        const pb = { x: pb0.x - ux * radius(b), y: pb0.y - uy * radius(b) };
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy);
        let nx = -dy / len;
        let ny = dx / len;
        if (ny > 0) [nx, ny] = [-nx, -ny]; // bulge upwards
        const cx = (pa.x + pb.x) / 2 + nx * len * 0.22;
        const cy = (pa.y + pb.y) / 2 + ny * len * 0.22;
        // Quadratic as cubic so one formula serves every curve.
        const P = [[pa.x, pa.y], [pa.x + (2 / 3) * (cx - pa.x), pa.y + (2 / 3) * (cy - pa.y)], [pb.x + (2 / 3) * (cx - pb.x), pb.y + (2 / 3) * (cy - pb.y)], [pb.x, pb.y]];
        const L = polyLength((u) => cubic(P, u));
        const ang = (Math.atan2(pb.y - cy, pb.x - cx) * 180) / Math.PI;
        const start = Math.max(pinAt(a), pinAt(b)) + 0.35 + i * 0.5;
        return { P, L, ang, start, end: [pb.x, pb.y], i };
      });
      const svg =
        routes
          .map((r) => `<path id="rt${r.i}" d="M${r.P[0]!.join(' ')} C${r.P.slice(1).map((p) => p.join(' ')).join(', ')}" fill="none" stroke="${ACC}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${r.L.toFixed(1)}" stroke-dashoffset="${r.L.toFixed(1)}"/>` +
            `<g transform="translate(${r.end[0]} ${r.end[1]}) rotate(${r.ang.toFixed(1)})"><path id="ah${r.i}" d="M-34 -16 L-10 0 L-34 16" fill="none" stroke="${ACC}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g><circle id="rd${r.i}" r="11" fill="${c.accentHi}" cx="${r.P[0]![0]}" cy="${r.P[0]![1]}"/>`)
          .join('') +
        spec.points
          .map((p, i) => {
            const col = p.highlight ? ACC : CY;
            const rr = p.highlight ? 20 : 13;
            return `<g id="p${i}"><circle id="pu${i}" cx="${p.x}" cy="${p.y}" r="${rr}" fill="none" stroke="${col}" stroke-width="4"/><circle cx="${p.x}" cy="${p.y}" r="${rr + 14}" fill="${alpha(col, 0.16)}"/><circle cx="${p.x}" cy="${p.y}" r="${rr}" fill="${col}"/>${p.highlight ? `<circle cx="${p.x}" cy="${p.y}" r="${rr * 0.4}" fill="${c.bg}"/>` : ''}</g>`;
          })
          .join('');
      const labels = spec.points
        .map((p, i) => `<div id="pl${i}" class="pl${p.highlight ? ' hi' : ''}${labelLeft[i] ? ' lf' : ''}" style="${labelLeft[i] ? `right:${1920 - p.x + (p.highlight ? 46 : 36)}px` : `left:${p.x + (p.highlight ? 46 : 36)}px`};top:${p.y - (p.highlight ? 34 : 26)}px"><b>${esc(p.label)}</b>${p.tag ? `<span class="ptag">${esc(p.tag)}</span>` : ''}</div>`)
        .join('');
      return {
        focus: [960, 520],
        layout: 'center',
        body: `<svg class="mp" width="1920" height="1080" viewBox="0 0 1920 1080">${svg}</svg>${labels}${kick(spec.kicker, 'tl-k')}${sub(spec.sub, 'bl-s')}`,
        css: `#grid{background-image:radial-gradient(circle,rgba(255,255,255,.075) 2.4px,transparent 3px),${c.texture};background-size:48px 48px,100% 100%}
.mp{position:absolute;inset:0;overflow:visible}.pl{position:absolute;white-space:nowrap;text-shadow:0 2px 14px ${c.bg},0 0 4px ${c.bg}}.pl b{display:block;font-size:40px;line-height:1.2}.pl.hi b{font-size:54px}.pl.lf{text-align:right}
.ptag{display:inline-block;margin-top:10px;padding:5px 16px;border-radius:999px;font-size:30px;font-weight:700;text-shadow:none;background:${alpha(CY, 0.18)};color:${c.text};box-shadow:inset 0 0 0 3px ${CY}}.pl.hi .ptag{background:${ACC};color:${c.onAccent};box-shadow:none}
.tl-k{position:absolute;left:180px;top:120px}.bl-s{position:absolute;left:180px;bottom:110px}`,
        js: [
          ...kickIn(0.1),
          ...spec.points.flatMap((p, i) => [
            `tl.fromTo("#p${i}", { opacity: 0, scale: 0.3, svgOrigin: "${p.x} ${p.y}" }, { opacity: 1, scale: 1, svgOrigin: "${p.x} ${p.y}", duration: 0.55, ease: "back.out(2.4)" }, ${f2(pinAt(i))});`,
            `tl.fromTo("#pl${i}", { opacity: 0, x: ${labelLeft[i] ? 24 : -24} }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, ${f2(pinAt(i) + 0.12)});`,
            // Two expanding pulses on each pin (finite).
            ...[0, 0.9].map((d) => `tl.fromTo("#pu${i}", { scale: 1, opacity: 0.9, svgOrigin: "${p.x} ${p.y}" }, { scale: ${p.highlight ? 3.4 : 2.6}, opacity: 0, svgOrigin: "${p.x} ${p.y}", duration: 1.1, ease: "power2.out", immediateRender: false }, ${f2(pinAt(i) + 0.4 + d)});`),
          ]),
          ...routes.flatMap((r) => [
            `{ const P = ${JSON.stringify(r.P)}; const path = document.getElementById("rt${r.i}"), dot = document.getElementById("rd${r.i}"); const o = { p: 0 };
tl.fromTo(o, { p: 0 }, { p: 1, duration: 1.1, ease: "power2.inOut", onUpdate: () => { const u = 1 - o.p, w = [u*u*u, 3*u*u*o.p, 3*u*o.p*o.p, o.p*o.p*o.p]; path.setAttribute("stroke-dashoffset", ${f2(r.L)} * (1 - o.p)); dot.setAttribute("cx", w[0]*P[0][0] + w[1]*P[1][0] + w[2]*P[2][0] + w[3]*P[3][0]); dot.setAttribute("cy", w[0]*P[0][1] + w[1]*P[1][1] + w[2]*P[2][1] + w[3]*P[3][1]); } }, ${f2(r.start)}); }`,
            `tl.fromTo("#rd${r.i}", { opacity: 0 }, { opacity: 1, duration: 0.15 }, ${f2(r.start)});`,
            `tl.to("#rd${r.i}", { opacity: 0, duration: 0.25 }, ${f2(r.start + 1.05)});`,
            `tl.fromTo("#ah${r.i}", { opacity: 0, scale: 0.3, transformOrigin: "100% 50%" }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(3)" }, ${f2(r.start + 1.0)});`,
          ]),
          rise('#s', 0.6 + spec.points.length * 0.3),
        ],
      };
    }

    // The statement itself: huge words rising in a wave; numbers in the numeric face, *marked*
    // words on an accent marker, otherwise the last word gets an underline sweep.
    case 'text': {
      // Units: a plain word, or a whole *marked* phrase. `glue` = no space before it in the source
      // ("*nghĩ được*?" → "?" glues to the phrase) → rendered inside one no-wrap span, never split by a line break.
      const parts: { word: string; hl: boolean }[] = [];
      const units: { hl: boolean; words: number[]; glue: boolean }[] = [];
      let prevEndsTight = false;
      for (const seg of spec.text.split(/(\*[^*]+\*)/)) {
        if (!seg) continue;
        const hl = /^\*[^*]+\*$/.test(seg);
        const inner = hl ? seg.slice(1, -1) : seg;
        const words = inner.split(/\s+/).filter(Boolean);
        const idx = words.map((word) => parts.push({ word, hl }) - 1);
        const glue = prevEndsTight && !/^\s/.test(inner) && units.length > 0;
        if (hl) units.push({ hl, words: idx, glue });
        else idx.forEach((w, k) => units.push({ hl, words: [w], glue: k === 0 && glue }));
        prevEndsTight = words.length > 0 && !/\s$/.test(inner);
      }
      const isNum = (w: string) => /^[+\-−×=]?[\d.,%]*\d[\d.,%]*$|^[+\-−×=]$/.test(w);
      const plain = spec.text.replace(/\*/g, '');
      const size = plain.length <= 10 ? 230 : plain.length <= 16 ? 200 : plain.length <= 24 ? 170 : plain.length <= 36 ? 140 : 116;
      const anyNum = parts.some((p) => isNum(p.word));
      const anyHl = parts.some((p) => p.hl);
      const underline = !anyNum && !anyHl;
      const wordHtml = (i: number) => {
        const w = mask(`w${i}`, esc(parts[i]!.word));
        return isNum(parts[i]!.word) ? `<span class="tn num">${w}</span>` : underline && i === parts.length - 1 ? `<span class="ulw">${w}<i id="ul" class="ul"></i></span>` : w;
      };
      const unitHtml = (u: (typeof units)[number]) => (u.hl ? `<span class="hlw"><i class="hlb"></i>${u.words.map(wordHtml).join(' ')}</span>` : wordHtml(u.words[0]!));
      let html = '';
      units.forEach((u, i) => {
        if (u.glue) return; // emitted with the unit before it
        let run = unitHtml(u);
        let j = i + 1;
        for (; units[j]?.glue; j++) run += unitHtml(units[j]!);
        html += (html ? ' ' : '') + (j > i + 1 ? `<span class="nb">${run}</span>` : run);
      });
      const step = Math.min(0.1, 0.6 / parts.length);
      const done = 0.35 + step * parts.length + 0.35;
      return {
        focus: [700, 520],
        layout: 'left',
        // Marker boxes reach .2em above the line for stacked diacritics (Ễ, Ỗ); the kicker gap grows by the same amount.
        body: `<div class="col">${kick(spec.kicker)}<div class="tx disp${anyHl ? ' txh' : ''}" style="font-size:${size}px">${html}</div>${sub(spec.sub)}</div>`,
        css: `.tx{position:relative;z-index:0;line-height:1.06;max-width:1560px;margin:34px 0 50px;letter-spacing:-.02em}.txh{margin-top:calc(34px + .2em)}.tn{color:${ACC};font-size:1.08em;letter-spacing:0}
.nb{white-space:nowrap}.nb>.hlw+*{margin-left:.04em}.nb>*+.hlw{margin-left:.16em}.hlw{position:relative;display:inline-block;white-space:normal;color:${c.onAccent}}.hlb{position:absolute;left:-.1em;right:-.1em;top:-.2em;bottom:-.02em;background:${ACC};border-radius:.06em;z-index:-1;transform-origin:left center}
.ulw{position:relative;display:inline-block}.ul{position:absolute;left:0;right:0;bottom:-.06em;height:.075em;border-radius:.04em;background:linear-gradient(90deg,${ACC},${c.accentHi});transform-origin:left center}`,
        js: [
          ...kickIn(0.1),
          ...parts.map((_, i) => rise(`#w${i}`, 0.35 + i * step, 0.85)),
          ...(anyHl ? [`tl.fromTo(".hlb", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, ${f2(done - 0.2)});`] : []),
          ...(underline ? [`tl.fromTo("#ul", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.inOut" }, ${f2(done - 0.15)});`] : []),
          rise('#s', done + 0.25),
        ],
      };
    }

    // A stack of plates; the odd one out (minority tone) lights up once the stack is built.
    case 'layers': {
      const tones = spec.items.map((it) => it.tone ?? 'accent');
      const counts = new Map<string, number>();
      tones.forEach((tn) => counts.set(tn, (counts.get(tn) ?? 0) + 1));
      const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const odd = counts.size > 1 ? tones.map((tn, i) => (tn !== majority ? i : -1)).filter((i) => i >= 0) : [];
      const n = spec.items.length;
      const rowH = n <= 4 ? 108 : 84;
      const rows = spec.items
        .map((it, i) => {
          const col = toneColor(c, it.tone);
          const filled = (it.tone ?? 'accent') === 'accent';
          return `<div id="ly${i}" class="ly"><i class="lys" style="background:${col}"></i><span class="lyl disp">${esc(it.label)}</span><span id="lv${i}" class="lv" style="${filled ? `background:${col};color:${c.onAccent}` : `color:${col};box-shadow:inset 0 0 0 3px ${col}`}">${esc(it.value)}</span></div>`;
        })
        .join('');
      const end = 0.4 + n * 0.16 + 0.6;
      return {
        focus: [760, 540],
        layout: 'left',
        body: `<div class="col">${kick(spec.kicker)}<div class="stack">${rows}</div>${sub(spec.sub)}</div>`,
        css: `.stack{width:1180px;display:flex;flex-direction:column;gap:18px;margin:50px 0 48px}
.ly{position:relative;display:flex;align-items:center;justify-content:space-between;height:${rowH}px;padding:0 30px 0 52px;border-radius:14px;background:rgba(255,255,255,.045);overflow:hidden}
.lys{position:absolute;left:0;top:0;bottom:0;width:10px}.lyl{font-size:${n <= 4 ? 50 : 40}px;line-height:1}
.lv{font-size:${n <= 4 ? 32 : 26}px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:10px 26px;border-radius:999px;line-height:1.1}`,
        js: [
          ...kickIn(0.1),
          ...spec.items.flatMap((_, i) => [
            `tl.fromTo("#ly${i}", { opacity: 0, y: 56 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${f2(0.35 + i * 0.16)});`,
            pop(`#lv${i}`, 0.6 + i * 0.16, 0.5),
          ]),
          ...odd.flatMap((i) => [
            `tl.fromTo("#ly${i}", { backgroundColor: "rgba(255,255,255,0.045)", scale: 1 }, { backgroundColor: "${alpha(toneColor(c, spec.items[i]!.tone), 0.2)}", scale: 1.035, duration: 0.45, ease: "back.out(2)" }, ${f2(end)});`,
          ]),
          rise('#s', end + 0.2),
        ],
      };
    }

    // Two lines race left→right over a year axis; labelled years light up as the lines pass them,
    // then the losing line (`fade`) dims while the other's end label pops.
    case 'duel': {
      const X0 = 180;
      const X1 = 1560;
      const Y0 = 300;
      const Y1 = 820;
      const DRAW = 0.35;
      const DUR = 2.2;
      const xOf = (yr: number) => X0 + ((yr - spec.from) / (spec.to - spec.from)) * (X1 - X0);
      const yOf = (lv: number) => Y1 - Math.min(1, Math.max(0, lv)) * (Y1 - Y0);
      const atX = (x: number) => DRAW + ((x - X0) / (X1 - X0)) * DUR;
      // Catmull-Rom through the points → cubic Béziers (smooth, passes every point).
      const smooth = (pts: [number, number][]) => {
        const P = pts.map(([yr, lv]) => [xOf(yr), yOf(lv)] as const);
        let d = `M${f2(P[0]![0])} ${f2(P[0]![1])}`;
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[Math.max(0, i - 1)]!;
          const b = P[i]!;
          const e = P[i + 1]!;
          const g = P[Math.min(P.length - 1, i + 2)]!;
          d += ` C${f2(b[0] + (e[0] - a[0]) / 6)} ${f2(b[1] + (e[1] - a[1]) / 6)} ${f2(e[0] - (g[0] - b[0]) / 6)} ${f2(e[1] - (g[1] - b[1]) / 6)} ${f2(e[0])} ${f2(e[1])}`;
        }
        return d;
      };
      const ends = spec.lines.map((ln) => {
        const [yr, lv] = ln.points.at(-1)!;
        return { x: xOf(yr), y: yOf(lv), col: toneColor(c, ln.tone) };
      });
      const lines = spec.lines
        .map((ln, i) => `<path id="dl${i}" d="${smooth(ln.points)}" pathLength="1" fill="none" stroke="${ends[i]!.col}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1" style="filter:drop-shadow(0 0 18px ${alpha(ends[i]!.col, 0.55)})"/>`)
        .join('');
      const marks = (spec.marks ?? [])
        .map((m, i) => {
          const x = xOf(m.year);
          return `<line id="mk${i}" x1="${f2(x)}" y1="${Y0 - 40}" x2="${f2(x)}" y2="${Y1}" stroke="${c.line}" stroke-width="3" stroke-dasharray="10 12"/>` +
            `<text id="my${i}" x="${f2(x)}" y="${Y1 + 62}" text-anchor="middle" font-size="40" fill="${c.text}" class="num">${m.year}</text>` +
            `<text id="ml${i}" x="${f2(x)}" y="${Y0 - 62}" text-anchor="middle" font-size="32" fill="${c.textSub}">${esc(m.label)}</text>`;
        })
        .join('');
      const axis = `<line x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}" stroke="${c.line}" stroke-width="4"/>` +
        `<text x="${X0}" y="${Y1 + 62}" font-size="36" fill="${c.textLabel}" class="num">${spec.from}</text><text x="${X1}" y="${Y1 + 62}" text-anchor="end" font-size="36" fill="${c.textLabel}" class="num">${spec.to}</text>`;
      const tags = spec.lines
        .map((ln, i) => `<div id="dt${i}" class="dtag" style="left:${f2(Math.min(ends[i]!.x + 30, 1600))}px;top:${f2(ends[i]!.y - 34)}px;background:${ends[i]!.col}">${esc(ln.label)}</div>`)
        .join('');
      const done = DRAW + DUR;
      return {
        focus: [960, 560],
        layout: 'center',
        body: `<svg class="dsv" width="1920" height="1080" viewBox="0 0 1920 1080">${axis}${marks}${lines}</svg>${tags}${kick(spec.kicker, 'tl-k')}${sub(spec.sub, 'bc-s')}`,
        css: `.dsv{position:absolute;inset:0;overflow:visible}.dtag{position:absolute;padding:12px 30px;border-radius:999px;font-size:38px;font-weight:700;line-height:1.1;color:${c.onAccent};white-space:nowrap;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.tl-k{position:absolute;left:180px;top:110px}.bc-s{position:absolute;left:180px;right:180px;bottom:64px;max-width:none}`,
        js: [
          ...kickIn(0.1),
          ...spec.lines.map((_, i) => `tl.fromTo("#dl${i}", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: ${f2(DUR * ((ends[i]!.x - X0) / (X1 - X0)))}, ease: "none" }, ${f2(DRAW)});`),
          ...(spec.marks ?? []).flatMap((m, i) => {
            const at = atX(xOf(m.year));
            return [
              `tl.fromTo("#mk${i}", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${f2(at - 0.1)});`,
              `tl.fromTo(["#my${i}", "#ml${i}"], { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, ${f2(at - 0.05)});`,
            ];
          }),
          ...spec.lines.map((_, i) => pop(`#dt${i}`, atX(ends[i]!.x) + 0.05, 0.5)),
          ...(spec.fade !== undefined ? [`tl.to(["#dl${spec.fade}", "#dt${spec.fade}"], { opacity: 0.25, duration: 0.6, ease: "power2.out" }, ${f2(done + 0.1)});`] : []),
          rise('#s', done + 0.2),
        ],
      };
    }

    // One sentence as a row of word chips; arcs rise between related words, the focus word's last and brightest.
    case 'links': {
      const size = spec.words.length <= 6 ? 72 : 60;
      const widths = spec.words.map((w) => [...w].length * size * 0.56 + 64);
      const gapW = 22;
      const total = widths.reduce((a, b) => a + b, 0) + gapW * (spec.words.length - 1);
      const x0 = (1920 - total) / 2;
      const cx: number[] = [];
      let x = x0;
      widths.forEach((w) => {
        cx.push(x + w / 2);
        x += w + gapW;
      });
      const rowY = 640;
      const top = rowY - size * 0.9;
      const f = spec.focus;
      const order = spec.links.map((l, i) => ({ l, i, strong: f !== undefined && (l[0] === f || l[1] === f) })).sort((a, b) => Number(a.strong) - Number(b.strong));
      const arcs = order
        .map(({ l: [a, b], i, strong }) => {
          const xa = cx[a]!;
          const xb = cx[b]!;
          const h = 70 + Math.abs(xb - xa) * 0.32;
          const col = strong ? c.accentHi : c.secondary;
          return `<path id="ar${i}" d="M${f2(xa)} ${f2(top)} Q${f2((xa + xb) / 2)} ${f2(top - h * 2)} ${f2(xb)} ${f2(top)}" pathLength="1" fill="none" stroke="${col}" stroke-width="${strong ? 9 : 5}" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1" opacity="${strong ? 1 : 0.75}" style="filter:drop-shadow(0 0 ${strong ? 20 : 10}px ${alpha(col, 0.7)})"/>`;
        })
        .join('');
      const chips = spec.words
        .map((w, i) => `<div id="wc${i}" class="wc2${i === f ? ' wf' : ''}" style="left:${f2(cx[i]! - widths[i]! / 2)}px;top:${f2(rowY - size * 0.9)}px;width:${f2(widths[i]!)}px;height:${f2(size * 1.8)}px;font-size:${size}px">${esc(w)}</div>`)
        .join('');
      const t0 = 0.3 + spec.words.length * 0.08 + 0.2;
      const step = Math.min(0.28, 1.6 / Math.max(1, order.length));
      return {
        focus: [960, 520],
        layout: 'center',
        body: `<svg class="lsv" width="1920" height="1080" viewBox="0 0 1920 1080">${arcs}</svg>${chips}${kick(spec.kicker, 'tl-k')}${sub(spec.sub, 'bc-s')}`,
        css: `.lsv{position:absolute;inset:0;overflow:visible}.wc2{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:18px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 3px ${c.line};font-family:"${t.fonts.display}";font-weight:${t.displayWeight};line-height:1}
#world .wf{background:${ACC};color:${c.onAccent};box-shadow:0 0 44px ${c.glow};-webkit-text-stroke:0;text-shadow:none}.tl-k{position:absolute;left:180px;top:110px}.bc-s{position:absolute;left:180px;right:180px;bottom:90px;text-align:center;max-width:none}`,
        js: [
          ...kickIn(0.1),
          ...spec.words.map((_, i) => `tl.fromTo("#wc${i}", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${f2(0.3 + i * 0.08)});`),
          ...order.map(({ i }, k) => `tl.fromTo("#ar${i}", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.55, ease: "power2.inOut" }, ${f2(t0 + k * step)});`),
          ...(f !== undefined ? [pop(`#wc${f}`, t0 + order.length * step, 0.85, 'back.out(3)', 0.4)] : []),
          rise('#s', t0 + order.length * step + 0.3),
        ],
      };
    }

    // Area under the value curve fills as a marker travels it; the bottom node pulses.
    case 'smile': {
      const P = [[160, 110], [460, 590], [1140, 590], [1440, 110]];
      const L = polyLength((u) => cubic(P, u));
      const [bx, by] = cubic(P, 0.5);
      const d = `M160 110 C460 590, 1140 590, 1440 110`;
      return {
        focus: [960, 560],
        layout: 'left',
        body: `<div class="col">${kick(spec.kicker)}<svg class="sm" width="1560" height="640" viewBox="0 0 1560 640"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACC}" stop-opacity=".30"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></linearGradient><clipPath id="ac"><rect id="acr" x="0" y="0" width="0" height="640"/></clipPath></defs>
<path d="M80 36 V600 H1520" fill="none" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/><path d="M68 52 L80 32 L92 52" fill="none" stroke="${c.line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<text transform="translate(44 330) rotate(-90)" text-anchor="middle" font-size="24" font-weight="700" letter-spacing="4" fill="${c.textLabel}">GIÁ TRỊ GIA TĂNG</text>
<path d="${d} L1440 600 L160 600 Z" fill="url(#ag)" clip-path="url(#ac)"/><path id="cv" d="${d}" fill="none" stroke="${ACC}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${L.toFixed(1)}"/>
<g id="nL"><circle cx="160" cy="110" r="26" fill="${alpha(ACC, 0.2)}"/><circle cx="160" cy="110" r="14" fill="${ACC}"/></g><g id="nR"><circle cx="1440" cy="110" r="26" fill="${alpha(ACC, 0.2)}"/><circle cx="1440" cy="110" r="14" fill="${ACC}"/></g>
<g id="nB"><circle id="pu" cx="${bx}" cy="${by}" r="18" fill="none" stroke="${CY}" stroke-width="4"/><circle cx="${bx}" cy="${by}" r="30" fill="${alpha(CY, 0.22)}"/><circle cx="${bx}" cy="${by}" r="18" fill="${CY}"/></g><circle id="mk" r="12" fill="${c.text}" cx="160" cy="110"/>
<g id="tL"><text x="200" y="64" font-size="42" font-weight="700" fill="${c.text}">${esc(spec.left)}</text></g><g id="tR"><text x="1400" y="64" text-anchor="end" font-size="42" font-weight="700" fill="${c.text}">${esc(spec.right)}</text></g>
<g id="tB"><text x="${bx}" y="${by + 88}" text-anchor="middle" font-size="54" font-weight="800" fill="${CY}">${esc(spec.bottom)}</text></g></svg>${sub(spec.sub)}</div>`,
        css: `.sm{overflow:visible;margin:26px 0 20px;font-family:"${t.fonts.display}"}`,
        js: [
          ...kickIn(0.1),
          pop('#nL', 0.35),
          `{ const P = ${JSON.stringify(P)}; const cv = document.getElementById("cv"), mk = document.getElementById("mk"), cr = document.getElementById("acr"); const o = { p: 0 };
tl.fromTo(o, { p: 0 }, { p: 1, duration: 1.8, ease: "power2.inOut", onUpdate: () => { const u = 1 - o.p, w = [u*u*u, 3*u*u*o.p, 3*u*o.p*o.p, o.p*o.p*o.p]; const x = w[0]*P[0][0] + w[1]*P[1][0] + w[2]*P[2][0] + w[3]*P[3][0], y = w[0]*P[0][1] + w[1]*P[1][1] + w[2]*P[2][1] + w[3]*P[3][1]; cv.setAttribute("stroke-dashoffset", ${f2(L)} * (1 - o.p)); mk.setAttribute("cx", x); mk.setAttribute("cy", y); cr.setAttribute("width", x); } }, 0.45); }`,
          'tl.fromTo("#mk", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.45);',
          'tl.to("#mk", { opacity: 0, duration: 0.25 }, 2.15);',
          `tl.fromTo("#tL", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.55);`,
          pop('#nB', 1.3, 0.2),
          `tl.fromTo("#tB", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 1.4);`,
          ...[1.5, 2.3].map((at) => `tl.fromTo("#pu", { scale: 1, opacity: 0.9, svgOrigin: "${bx} ${by}" }, { scale: 3, opacity: 0, svgOrigin: "${bx} ${by}", duration: 1.1, ease: "power2.out", immediateRender: false }, ${at});`),
          pop('#nR', 2.2),
          `tl.fromTo("#tR", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 2.25);`,
          rise('#s', 2.45),
        ],
      };
    }

    // Split screen, one colour per side; each side's tag flies across the centre line and the
    // opposite name recoils on impact.
    case 'versus': {
      const fit = (s: string) => Math.min(150, Math.floor(720 / (s.length * 0.74)));
      return {
        focus: [960, 500],
        layout: 'center',
        body: `<div id="pL" class="vp vpl"></div><div id="pR" class="vp vpr"></div><div id="dv" class="vdv"></div>` +
          `<div class="vn vnl"><div id="nL" class="disp" style="font-size:${fit(spec.left)}px">${mask('xL', esc(spec.left))}</div><i id="bL" style="background:${ACC}"></i></div>` +
          `<div class="vn vnr"><div id="nR" class="disp" style="font-size:${fit(spec.right)}px">${mask('xR', esc(spec.right))}</div><i id="bR" style="background:${CY}"></i></div>` +
          `<div id="vs" class="vs num">VS</div><div id="t1" class="vt" style="top:650px;background:${ACC}">${esc(spec.leftTag)}</div><div id="t2" class="vt" style="top:752px;background:${CY}">${esc(spec.rightTag)}</div>` +
          `${kick(spec.kicker, 'tl-k')}${sub(spec.sub, 'bc-s')}`,
        css: `.vp{position:absolute;top:0;bottom:0;width:960px}.vpl{left:0;background:linear-gradient(90deg,${alpha(ACC, 0.1)},${alpha(ACC, 0.01)});transform-origin:left center}.vpr{right:0;background:linear-gradient(270deg,${alpha(CY, 0.16)},${alpha(CY, 0.01)});transform-origin:right center}
.vdv{position:absolute;left:958px;top:170px;width:4px;height:740px;border-radius:2px;background:linear-gradient(180deg,transparent,${c.line} 15%,${c.line} 85%,transparent);transform-origin:50% 50%}
.vn{position:absolute;top:330px;width:960px;display:flex;flex-direction:column;align-items:center;gap:26px;line-height:1}.vnl{left:0}.vnr{left:960px}.vn i{display:block;width:96px;height:8px;border-radius:4px;transform-origin:50% 50%}
.vs{position:absolute;left:896px;top:352px;width:128px;height:128px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:56px;color:${c.textSub};background:${c.bg};box-shadow:inset 0 0 0 4px ${c.line}}
.vt{position:absolute;left:960px;padding:14px 36px;border-radius:999px;font-size:44px;font-weight:700;color:${c.onAccent};white-space:nowrap;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.tl-k{position:absolute;left:180px;top:120px}.bc-s{position:absolute;left:260px;right:260px;bottom:110px;text-align:center;max-width:none}`,
        js: [
          'tl.fromTo("#pL", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out" }, 0.05);',
          'tl.fromTo("#pR", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out" }, 0.05);',
          ...kickIn(0.15),
          rise('#xL', 0.3, 0.8),
          rise('#xR', 0.4, 0.8),
          'tl.fromTo("#bL", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out" }, 0.6);',
          'tl.fromTo("#bR", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.out" }, 0.7);',
          'tl.fromTo("#dv", { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: "power3.inOut" }, 0.45);',
          pop('#vs', 0.75, 0.2, 'back.out(2.6)'),
          'tl.fromTo("#t1", { xPercent: -50, x: -560, opacity: 0 }, { xPercent: -50, x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, 0.95);',
          'tl.fromTo("#nR", { x: 0 }, { x: 16, duration: 0.06, ease: "sine.inOut", yoyo: true, repeat: 5, immediateRender: false }, 1.35);',
          'tl.fromTo("#t2", { xPercent: -50, x: 560, opacity: 0 }, { xPercent: -50, x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, 1.35);',
          'tl.fromTo("#nL", { x: 0 }, { x: -16, duration: 0.06, ease: "sine.inOut", yoyo: true, repeat: 5, immediateRender: false }, 1.75);',
          rise('#s', 2.0),
        ],
      };
    }

    // A real chain (face-on and edge-on links) strains, then its middle link snaps with a flash.
    case 'chain': {
      const N = 9;
      const pitch = 160;
      const x0 = 140;
      const cy = 150;
      const mid = 4;
      const cxOf = (i: number) => x0 + i * pitch;
      const edge = (i: number) => `<rect id="lk${i}" x="${cxOf(i) - 120}" y="${cy - 13}" width="240" height="26" rx="13" fill="url(#steel)"/>`;
      const face = (i: number) => `<rect id="lk${i}" x="${cxOf(i) - 120}" y="${cy - 60}" width="240" height="120" rx="60" fill="none" stroke="url(#steel)" stroke-width="22"/>`;
      const link = (i: number) => (i % 2 ? edge(i) : face(i));
      const mx = cxOf(mid);
      const half = (side: -1 | 1) =>
        `<path id="h${side < 0 ? 'L' : 'R'}" d="M${mx + side * 6} ${cy - 60} H${mx + side * 60} A60 60 0 0 ${side < 0 ? 0 : 1} ${mx + side * 60} ${cy + 60} H${mx + side * 6}" fill="none" stroke="${c.textSub}" stroke-width="22" stroke-linecap="round"/>`;
      const order = (from: number, to: number) => {
        // Edge-on links first so face-on links overlap their ends (reads as interlocked).
        const idx = Array.from({ length: to - from + 1 }, (_, k) => from + k);
        return [...idx.filter((i) => i % 2), ...idx.filter((i) => !(i % 2))].map(link).join('');
      };
      const sparks = Array.from({ length: 12 }, (_, i) => {
        const a = i * 30 + (i % 3) * 8;
        const len = 40 + ((i * 37) % 50);
        return `<g transform="translate(${mx} ${cy}) rotate(${a})"><line id="sp${i}" x1="20" y1="0" x2="${20 + len * 0.4}" y2="0" stroke="${ACC}" stroke-width="6" stroke-linecap="round" opacity="0"/></g>`;
      }).join('');
      const tB = 1.55;
      return {
        focus: [960, 470],
        layout: 'center',
        body: `<div class="colc">${kick(spec.kicker)}<svg class="ch" width="1560" height="300" viewBox="0 0 1560 300"><defs><linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.text}"/><stop offset="1" stop-color="${c.line}"/></linearGradient><radialGradient id="fg"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${c.accentHi}" stop-opacity=".85"/><stop offset="1" stop-color="${c.accentHi}" stop-opacity="0"/></radialGradient></defs>
<g id="chain"><g id="chL">${order(0, mid - 1)}${half(-1)}</g><g id="chR">${order(mid + 1, N - 1)}${half(1)}</g></g>
<circle id="fl" cx="${mx}" cy="${cy}" r="90" fill="url(#fg)" opacity="0"/>${sparks}</svg><div class="cl disp">${mask('cl', esc(spec.label))}</div>${sub(spec.sub)}</div>`,
        css: `.colc{position:absolute;left:180px;right:180px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.ch{overflow:visible;margin:56px 0 64px}.cl{font-size:70px;line-height:1.1;margin-bottom:26px}.colc .sub{text-align:center}`,
        js: [
          ...kickIn(0.1),
          ...Array.from({ length: N }, (_, i) => i).filter((i) => i !== mid).map((i) => `tl.fromTo("#lk${i}", { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, ${f2(0.25 + i * 0.05)});`),
          `tl.fromTo(["#hL", "#hR"], { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, ${f2(0.25 + mid * 0.05)});`,
          // Strain, then snap.
          `tl.fromTo("#chain", { x: -5 }, { x: 5, duration: 0.05, ease: "sine.inOut", yoyo: true, repeat: 7, immediateRender: false }, 1.1);`,
          `tl.set("#chain", { x: 0 }, ${f2(tB)});`,
          `tl.fromTo(["#hL", "#hR"], { attr: { stroke: "${c.textSub}" } }, { attr: { stroke: "${ACC}" }, duration: 0.2 }, ${f2(tB)});`,
          `tl.fromTo("#chL", { x: 0, rotation: 0, svgOrigin: "${mx} ${cy}" }, { x: -70, rotation: -4, svgOrigin: "${mx} ${cy}", duration: 0.7, ease: "power3.out" }, ${f2(tB)});`,
          `tl.fromTo("#chR", { x: 0, rotation: 0, svgOrigin: "${mx} ${cy}" }, { x: 70, rotation: 4, svgOrigin: "${mx} ${cy}", duration: 0.7, ease: "power3.out" }, ${f2(tB)});`,
          `tl.fromTo("#hL", { x: 0, y: 0, rotation: 0, svgOrigin: "${mx - 60} ${cy}" }, { x: -24, y: 26, rotation: -22, svgOrigin: "${mx - 60} ${cy}", duration: 0.8, ease: "power2.out" }, ${f2(tB)});`,
          `tl.fromTo("#hR", { x: 0, y: 0, rotation: 0, svgOrigin: "${mx + 60} ${cy}" }, { x: 24, y: 26, rotation: 22, svgOrigin: "${mx + 60} ${cy}", duration: 0.8, ease: "power2.out" }, ${f2(tB)});`,
          `tl.fromTo("#fl", { scale: 0.3, opacity: 1, svgOrigin: "${mx} ${cy}" }, { scale: 1.8, opacity: 0, svgOrigin: "${mx} ${cy}", duration: 0.4, ease: "power2.out", immediateRender: false }, ${f2(tB)});`,
          ...Array.from({ length: 12 }, (_, i) => {
            const len = 40 + ((i * 37) % 50);
            return `tl.fromTo("#sp${i}", { attr: { x1: 20, x2: ${20 + len * 0.4} }, opacity: 1 }, { attr: { x1: ${90 + len}, x2: ${100 + len * 1.4} }, opacity: 0, duration: 0.55, ease: "power2.out", immediateRender: false }, ${f2(tB + 0.02)});`;
          }),
          rise('#cl', tB + 0.35, 0.8),
          rise('#s', tB + 0.7),
        ],
      };
    }

    // Real map; the main pin gets a callout card on a leader line, other pins a dot + label.
    case 'geo': {
      const hi = spec.highlight ?? [];
      const view = geoView(spec.region);
      const cam = view.cameraFor(spec.zoom);
      const layers = view.layers({ highlight: hi, detail: cam.k, colors: { land: c.mapLand, landDim: c.mapLandDim, border: c.mapBorder }, ...(spec.labels ? { labels: spec.labels } : {}) });
      // Where a full-view point lands on screen once the camera has zoomed in.
      const at = (lon: number, lat: number) => {
        const [x, y] = view.project([lon, lat]);
        return [960 + (x - cam.cx) * cam.k, 540 + (y - cam.cy) * cam.k] as const;
      };
      const pinXY = spec.pins.map((p) => at(p.lon, p.lat));
      const leaders: string[] = [];
      const pins = spec.pins
        .map((p, i) => {
          const [x, y] = pinXY[i]!;
          if (!p.main) {
            return `<div id="pin${i}" class="pin" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px"><i></i><div class="pl"><b>${esc(p.label)}</b>${p.tag ? `<span class="ptag">${esc(p.tag)}</span>` : ''}</div></div>`;
          }
          // Callout up-right of the pin; flipped when it would leave the frame.
          const sx = x > 1320 ? -1 : 1;
          const sy = y < 300 ? 1 : -1;
          const ex = x + sx * 70;
          const ey = y + sy * 90;
          leaders.push(`<path id="ld${i}" d="M${x.toFixed(0)} ${y.toFixed(0)} L${ex.toFixed(0)} ${ey.toFixed(0)} H${(ex + sx * 30).toFixed(0)}" fill="none" stroke="${ACC}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="200" stroke-dashoffset="200"/>`);
          const card = `<div id="cd${i}" class="cd" style="${sx > 0 ? `left:${(ex + sx * 30).toFixed(0)}px` : `right:${(1920 - ex + 30).toFixed(0)}px`};top:${(ey - 44).toFixed(0)}px"><b class="disp">${esc(p.label)}</b>${p.tag ? `<span>${esc(p.tag)}</span>` : ''}</div>`;
          return `<div id="pin${i}" class="pin main" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px"><s id="pp${i}"></s><i></i></div>${card}`;
        })
        .join('');
      // Area name on the highlight when it fits after the zoom (44 px bold ≈ 34 px/char) and no pin
      // or callout sits on it; otherwise try the bottom of the area, else skip.
      // Screen boxes taken by pins and their labels/callouts: [x0, y0, x1, y1].
      const taken = spec.pins.map((p, i) => {
        const [x, y] = pinXY[i]!;
        if (!p.main) return [x - 24, y - 30, x + 40 + p.label.length * 23, y + (p.tag ? 70 : 30)];
        const sx = x > 1320 ? -1 : 1;
        const sy = y < 300 ? 1 : -1;
        const w = Math.max(p.label.length * 29, (p.tag ?? '').length * 20) + 90;
        const ex = x + sx * 100;
        const ey = y + sy * 90;
        return [Math.min(x - 40, sx > 0 ? ex : ex - w), Math.min(y - 40, ey - 50), Math.max(x + 40, sx > 0 ? ex + w : ex), Math.max(y + 40, ey + 60)];
      });
      const clear = (x: number, y: number, w: number) => taken.every(([x0, y0, x1, y1]) => x + w / 2 + 20 < x0! || x - w / 2 - 20 > x1! || y + 30 < y0! || y - 30 > y1!);
      const hiLabels = hi.map((name, i) => {
        const a = view.anchor(name);
        const [x0, yb] = at(a.box[0], a.box[1]);
        const [x1] = at(a.box[2], a.box[3]);
        const w = a.text.length * 34;
        if (x1 - x0 < w) return '';
        const [x, y] = at(...a.at);
        // The anchor sits at the centre of the whole area, which can fall outside a tight zoom.
        const inFrame = (sx: number, sy: number) => sx - w / 2 >= 40 && sx + w / 2 <= 1880 && sy >= 180 && sy <= 900;
        const spot = [[x, y + 60], [x, yb - 40]].find(([sx, sy]) => inFrame(sx!, sy!) && clear(sx!, sy!, w));
        return spot ? `<div id="hl${i}" class="hl" style="left:${spot[0]!.toFixed(0)}px;top:${spot[1]!.toFixed(0)}px">${esc(a.text.toUpperCase())}</div>` : '';
      });
      // Zoom toward a point: scale grows geometrically while the target glides linearly from
      // where it sits in the full view to the frame centre, so it never drifts off-screen.
      const zoom = `{ const cam = document.getElementById("cam"); const c = { t: 0 }; const k1 = ${cam.k.toFixed(4)}, tx = ${cam.cx.toFixed(2)}, ty = ${cam.cy.toFixed(2)};
tl.fromTo(c, { t: 0 }, { t: 1, duration: 1.7, ease: "power2.inOut", onUpdate: () => { const k = Math.pow(k1, c.t); const sx = tx + (960 - tx) * c.t, sy = ty + (540 - ty) * c.t; cam.setAttribute("transform", "translate(" + (sx - tx * k) + " " + (sy - ty * k) + ") scale(" + k + ")"); } }, 0.7); }`;
      return {
        focus: [960, 540],
        layout: 'center',
        body: `<svg class="map" width="1920" height="1080" viewBox="0 0 1920 1080"><g id="cam">${layers.world}</g></svg><div id="gls">${layers.labels}</div>${hiLabels.join('')}<svg class="ldr" width="1920" height="1080" viewBox="0 0 1920 1080">${leaders.join('')}</svg>${pins}${kick(spec.kicker, 'gk')}${sub(spec.sub, 'gs')}`,
        css: `#root{background:${c.mapSea}}#glow{opacity:.55}#grid{display:none}.map,.ldr{position:absolute;inset:0}.map path{vector-effect:non-scaling-stroke}.map .hi{fill:${c.mapLand}}.map path.hi{stroke-width:3px}
.gl{position:absolute;transform:translate(-50%,-50%);font-size:30px;letter-spacing:6px;color:${c.textLabel};font-weight:700;white-space:nowrap}.gi{font-size:28px;letter-spacing:1px;color:${c.textSub}}
.hl{position:absolute;transform:translate(-50%,-50%);font-size:40px;letter-spacing:10px;font-weight:800;color:${c.accentHi};white-space:nowrap;text-shadow:0 2px 14px ${c.bg},0 0 4px ${c.bg}}
.pin{position:absolute;width:0;height:0}.pin i{position:absolute;left:-12px;top:-12px;width:24px;height:24px;border-radius:50%;background:${CY};box-shadow:0 0 0 6px ${alpha(CY, 0.3)},0 0 0 12px ${alpha(c.bg, 0.55)}}
.pin.main i{left:-17px;top:-17px;width:34px;height:34px;background:${c.text};box-shadow:0 0 0 9px ${ACC},0 0 0 16px ${alpha(c.bg, 0.6)}}.pin s{position:absolute;left:-40px;top:-40px;width:80px;height:80px;border-radius:50%;box-shadow:inset 0 0 0 5px ${ACC}}
.pl{position:absolute;left:30px;top:-27px;white-space:nowrap;text-shadow:0 2px 14px ${c.bg},0 0 4px ${c.bg}}.pl b{display:block;font-size:40px;line-height:1.2}.ptag{display:inline-block;margin-top:8px;padding:4px 16px;border-radius:999px;background:${c.panel};color:${ACC};font-size:32px;font-weight:700;text-shadow:none}
.cd{position:absolute;display:flex;flex-direction:column;gap:4px;padding:16px 26px 18px 24px;border-radius:12px;background:${c.panel};box-shadow:inset 6px 0 0 ${ACC},0 18px 50px rgba(0,0,0,.45);white-space:nowrap}.cd b{font-size:50px;line-height:1.1}.cd span{font-size:34px;font-weight:700;color:${ACC}}
.gk{position:absolute;top:84px;left:120px;padding:16px 26px;background:${c.panel};border-radius:10px}.gs{position:absolute;bottom:84px;left:120px;padding:14px 26px;background:${c.panel};border-radius:10px;max-width:1300px}`,
        js: [
          'tl.fromTo(".map", { opacity: 0, scale: 1.04, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 0);',
          'tl.fromTo("#gls", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.15);',
          ...kickIn(0.1),
          'tl.to("#gls", { opacity: 0, duration: 0.3 }, 0.7);',
          zoom,
          ...(hi.length ? [`tl.fromTo(".map .hi", { fill: "${c.mapLand}", stroke: "${c.mapBorder}" }, { fill: "${alpha(ACC, 0.3)}", stroke: "${ACC}", duration: 0.5, ease: "power2.out" }, 1.9);`] : []),
          ...hiLabels.flatMap((h, i) => (h ? [`tl.fromTo("#hl${i}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 2.1);`] : [])),
          ...spec.pins.flatMap((p, i) => {
            const t0 = p.main ? 2.5 : 2.3;
            return [
              `tl.fromTo("#pin${i}", { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(2.2)" }, ${f2(t0)});`,
              ...(p.main
                ? [
                    ...[0, 0.8].map((d) => `tl.fromTo("#pp${i}", { scale: 0.4, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 1, ease: "power2.out", immediateRender: false }, ${f2(t0 + 0.3 + d)});`),
                    `tl.set("#pp${i}", { opacity: 0 }, 0);`,
                    `tl.fromTo("#ld${i}", { attr: { "stroke-dashoffset": 200 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.35, ease: "power2.out" }, ${f2(t0 + 0.2)});`,
                    `tl.fromTo("#cd${i}", { opacity: 0, x: ${pinXY[i]![0] > 1320 ? 24 : -24} }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, ${f2(t0 + 0.45)});`,
                  ]
                : []),
            ];
          }),
          rise('#s', 2.9),
        ],
      };
    }

    // Headline number rolls on the left; columns grow on the right, trend line draws over them.
    case 'chart': {
      const last = spec.items.at(-1)!;
      const max = Math.max(...spec.items.map((i) => i.value)) * 1.12;
      const base = 560;
      const hgt = 470;
      const colW = 120;
      const gap = (1000 - colW * spec.items.length) / (spec.items.length + 1);
      const xs = spec.items.map((_, i) => gap + i * (colW + gap) + colW / 2);
      const ys = spec.items.map((it) => base - (it.value / max) * hgt);
      let len = 0;
      for (let i = 1; i < xs.length; i++) len += Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!);
      const colPath = (x: number, y: number, w: number, r: number) => `M${f2(x)} ${f2(base)} V${f2(y + r)} Q${f2(x)} ${f2(y)} ${f2(x + r)} ${f2(y)} H${f2(x + w - r)} Q${f2(x + w)} ${f2(y)} ${f2(x + w)} ${f2(y + r)} V${f2(base)} Z`;
      const grid = [1, 2, 3].map((k) => `<line x1="0" y1="${base - (hgt * k) / 3}" x2="1000" y2="${base - (hgt * k) / 3}" stroke="rgba(255,255,255,.06)" stroke-width="2"/>`).join('');
      const cols = spec.items
        .map((it, i) => {
          const isLast = i === spec.items.length - 1;
          return `<path id="col${i}" d="${colPath(xs[i]! - colW / 2, ys[i]!, colW, 12)}" fill="${isLast ? 'url(#cg)' : c.muted}"${isLast ? ' class="hot"' : ''}/>` +
            `<text id="cv${i}" x="${f2(xs[i]!)}" y="${f2(ys[i]! - 60)}" text-anchor="middle" font-size="${isLast ? 50 : 40}" fill="${isLast ? ACC : c.textSub}">${vn(it.value)}</text>` +
            `<text x="${f2(xs[i]!)}" y="${base + 54}" text-anchor="middle" font-size="36" fill="${isLast ? c.text : c.textLabel}">${esc(it.label)}</text>`;
        })
        .join('');
      const dots = xs.map((x, i) => (i === xs.length - 1 ? `<circle id="dt${i}" cx="${f2(x)}" cy="${f2(ys[i]! - 22)}" r="11" fill="${c.accentHi}"/>` : `<circle id="dt${i}" cx="${f2(x)}" cy="${f2(ys[i]! - 22)}" r="9" fill="${c.bg}" stroke="${CY}" stroke-width="5"/>`)).join('');
      const line = `<path id="trend" d="M${xs.map((x, i) => `${f2(x)} ${f2(ys[i]! - 22)}`).join('L')}" fill="none" stroke="${CY}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${len.toFixed(1)}"/>`;
      const w = wheel(vn(last.value), 'st');
      const badge = spec.badge ? `<div id="bd" class="badge"><b>▲</b>${esc(spec.badge)}</div>` : '';
      return {
        focus: [480, 520],
        layout: 'left',
        body: `<div class="cl">${kick(spec.kicker)}<div id="nw" class="nw num">${w.html}</div><div class="un disp">${mask('un', esc(spec.unit))}</div><div class="lb">${mask('lb', esc(spec.label))}</div>${badge}</div>` +
          `<svg class="cr num" width="940" height="602" viewBox="0 0 1000 640"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.accentHi}"/><stop offset="1" stop-color="${ACC}"/></linearGradient></defs>${grid}<line x1="0" y1="${base}" x2="1000" y2="${base}" stroke="${c.line}" stroke-width="4"/>${cols}${line}${dots}</svg>` +
          sub(spec.sub, 'cs'),
        css: `.cl{position:absolute;left:180px;width:600px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.nw{display:flex;align-items:flex-end;font-size:240px;margin-top:26px;text-shadow:0 12px 60px rgba(0,0,0,.35)}.un{font-size:72px;line-height:1.1;color:${ACC};margin-top:6px}.lb{font-size:38px;color:${c.textSub};margin-top:8px}
.badge{display:inline-flex;align-items:center;gap:12px;margin-top:30px;padding:10px 24px;border-radius:999px;font-size:34px;font-weight:700;color:${c.text};background:${alpha(CY, 0.2)};box-shadow:inset 0 0 0 3px ${CY}}.badge b{color:${CY};font-size:26px}
.cr{position:absolute;left:800px;top:200px;overflow:visible}.hot{filter:drop-shadow(0 0 26px ${c.glow})}.cs{position:absolute;left:800px;top:846px;font-size:30px;color:${c.textLabel}}`,
        js: [
          ...kickIn(0.1),
          ...spec.items.flatMap((_, i) => [`tl.fromTo("#col${i}", { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.7, ease: "power3.out" }, ${f2(0.3 + i * 0.16)});`, `tl.fromTo("#cv${i}", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${f2(0.65 + i * 0.16)});`]),
          `tl.fromTo("#trend", { attr: { "stroke-dashoffset": ${len.toFixed(1)} } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.0, ease: "power1.inOut" }, 1.3);`,
          ...xs.map((_, i) => `tl.fromTo("#dt${i}", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, ${f2(1.3 + (i / Math.max(1, xs.length - 1)) * 1.0)});`),
          'tl.fromTo("#nw", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.9);',
          ...w.js(1.2, 1.7),
          rise('#un', 2.3),
          rise('#lb', 2.5),
          ...(spec.badge ? [pop('#bd', 3.2, 0.6, 'back.out(2.5)', 0.45)] : []),
          rise('#s', 3.4),
        ],
      };
    }
    // Light chat window centred on the ink background: caret blinks, the question is typed into the
    // input, sent up as a bubble, then the reply streams in word by word behind a block cursor.
    case 'chat': {
      const k = chatTiming(spec, seconds);
      const blinks = Math.max(1, Math.floor((k.send - 0.1) / 0.45));
      return {
        focus: [960, 540],
        layout: 'center',
        body: `<div id="cw" class="cw"><div class="cbar"><i></i><i></i><i></i></div><div class="cms">` +
          `<div id="cu" class="cu">${esc(spec.prompt)}</div>` +
          `<div class="ca"><b id="cav" class="cav"></b><div class="cat"><span id="crt"></span><i id="ccur" class="ccur"></i></div></div></div>` +
          `<div class="cin"><span id="cit"></span><i id="crt2" class="caret"></i><b id="csd" class="csd">↑</b></div></div>`,
        css: `#glow{opacity:.8}.cw{position:absolute;left:260px;top:150px;width:1400px;height:780px;border-radius:36px;background:${c.text};color:${c.bg};box-shadow:0 40px 120px rgba(0,0,0,.5);overflow:hidden}
.cbar{display:flex;gap:14px;padding:30px 40px}.cbar i{width:18px;height:18px;border-radius:50%;background:${alpha(c.bg, 0.14)}}
.cms{position:absolute;left:80px;right:80px;top:110px;bottom:190px;display:flex;flex-direction:column;gap:44px}
.cu{align-self:flex-end;max-width:900px;padding:24px 36px;border-radius:32px 32px 8px 32px;background:${alpha(c.bg, 0.08)};font-size:44px;line-height:1.35;font-weight:700}
.ca{display:flex;gap:28px;align-items:flex-start}.cav{flex:none;width:60px;height:60px;border-radius:50%;background:${ACC};box-shadow:inset 0 0 0 10px ${alpha(c.text, 0.35)}}
.cat{font-size:42px;line-height:1.45;max-width:1080px}.ccur{display:inline-block;width:.5em;height:1em;margin-left:.15em;vertical-align:-.12em;background:${c.bg}}
.cin{position:absolute;left:80px;right:80px;bottom:56px;height:104px;border-radius:52px;box-shadow:inset 0 0 0 3px ${alpha(c.bg, 0.16)};display:flex;align-items:center;padding:0 40px;font-size:42px;font-weight:700;white-space:nowrap}
.caret{display:inline-block;width:4px;height:1.15em;margin-left:4px;background:${ACC}}.csd{position:absolute;right:18px;top:16px;width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${alpha(c.bg, 0.12)};color:${c.text};font-size:40px}`,
        js: [
          'tl.fromTo("#cw", { opacity: 0, y: 50, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" }, 0);',
          'tl.set(["#cu", "#cav", "#ccur"], { opacity: 0 }, 0);',
          `tl.fromTo("#crt2", { opacity: 1 }, { opacity: 0, duration: 0.225, ease: "steps(1)", yoyo: true, repeat: ${blinks * 2 - 1} }, 0.1);`,
          `{ const el = document.getElementById("cit"); const s = [...${JSON.stringify(spec.prompt)}]; const o = { n: 0 }; tl.fromTo(o, { n: 0 }, { n: s.length, duration: ${f2(k.type)}, ease: "none", onUpdate: () => { el.textContent = s.slice(0, Math.round(o.n)).join(""); } }, ${f2(k.typeAt)}); }`,
          `tl.fromTo("#csd", { backgroundColor: "${alpha(c.bg, 0.12)}" }, { backgroundColor: "${ACC}", duration: 0.2 }, ${f2(k.type + k.typeAt)});`,
          `tl.fromTo("#csd", { scale: 1 }, { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1, ease: "power2.inOut" }, ${f2(k.send - 0.1)});`,
          `tl.set(["#cit", "#crt2"], { opacity: 0 }, ${f2(k.send)});`,
          `tl.fromTo("#cu", { opacity: 0, y: 40, scale: 0.94, transformOrigin: "100% 100%" }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.8)" }, ${f2(k.send)});`,
          `tl.fromTo("#cav", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2.4)" }, ${f2(k.streamAt - 0.3)});`,
          `tl.set("#ccur", { opacity: 1 }, ${f2(k.streamAt - 0.2)});`,
          `{ const el = document.getElementById("crt"); const w = ${JSON.stringify(k.words)}; const o = { n: 0 }; tl.fromTo(o, { n: 0 }, { n: w.length, duration: ${f2(k.stream)}, ease: "none", onUpdate: () => { el.textContent = w.slice(0, Math.ceil(o.n)).join(" "); } }, ${f2(k.streamAt)}); }`,
          `tl.fromTo("#ccur", { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "steps(1)", yoyo: true, repeat: 7 }, ${f2(k.streamAt + k.stream + 0.1)});`,
        ],
      };
    }

    // Hard cuts through full-frame stills, each easing out of a slight push-in; a light flash marks
    // every cut, the era stamp swaps bottom-left and a progress rule fills along the bottom edge.
    case 'montage': {
      const step = spec.step ?? MONTAGE_STEP;
      const n = spec.items.length;
      const imgs = spec.items.map((it, i) => `<div id="mo${i}" class="mo"><img src="m${i}${extOf(it.src)}" alt="" /></div>`).join('');
      const labs = spec.items.map((it, i) => `<div id="ml${i}" class="ml"><b class="num">${esc(it.year)}</b><span>${esc(it.label)}</span></div>`).join('');
      return {
        focus: [960, 540],
        layout: 'center',
        body: `${imgs}<div class="mvig"></div><div id="mfl" class="mfl"></div>${labs}<div class="mtl"><i id="mbar"></i></div>`,
        css: `#grid,#glow{display:none}.mo{position:absolute;inset:0;opacity:0}.mo img{width:100%;height:100%;object-fit:cover}
.mvig{position:absolute;inset:0;background:linear-gradient(0deg,${alpha(c.bg, 0.85)} 0%,${alpha(c.bg, 0)} 32%)}.mfl{position:absolute;inset:0;background:${c.text};opacity:0}
.ml{position:absolute;left:120px;bottom:118px;display:flex;align-items:baseline;gap:28px;opacity:0;text-shadow:0 2px 24px rgba(0,0,0,.6)}.ml b{font-size:112px;line-height:1;color:${ACC}}.ml span{font-size:40px;font-weight:700;color:${c.text}}
.mtl{position:absolute;left:120px;right:120px;bottom:70px;height:6px;border-radius:3px;background:${alpha(c.text, 0.18)}}.mtl i{position:absolute;inset:0;border-radius:3px;background:${ACC};transform-origin:left center;transform:scaleX(0)}`,
        js: spec.items.flatMap((_, i) => {
          const at = i * step;
          const hold = i === n - 1 ? Math.max(step, seconds - at) : step + 0.2;
          return [
            `tl.set("#mo${i}", { opacity: 1 }, ${f2(at)});`,
            `tl.fromTo("#mo${i}", { scale: 1.12 }, { scale: 1, duration: ${f2(hold)}, ease: "power2.out" }, ${f2(at)});`,
            `tl.set("#ml${i}", { opacity: 1 }, ${f2(at)});`,
            ...(i < n - 1 ? [`tl.set("#ml${i}", { opacity: 0 }, ${f2(at + step)});`] : []),
            `tl.fromTo("#ml${i} b", { y: 30 }, { y: 0, duration: 0.35, ease: "power3.out" }, ${f2(at)});`,
            ...(i > 0 ? [`tl.fromTo("#mfl", { opacity: 0.28 }, { opacity: 0, duration: 0.18, ease: "power1.out", immediateRender: false }, ${f2(at)});`] : []),
            `tl.to("#mbar", { scaleX: ${f2((i + 1) / n)}, duration: 0.3, ease: "power2.out" }, ${f2(at)});`,
          ];
        }),
      };
    }
  }
}

/** Seconds (scene-local) of the headline count/roll: the chapter mix lays tick SFX over it. */
function countWindow(spec: GraphicSpec): { at: number; dur: number; ease: 'power2' | 'power3' } | undefined {
  switch (spec.template) {
    case 'counter':
      return spec.from === undefined ? { at: 0.4, dur: 1.9, ease: 'power3' } : { at: 0.4, dur: 2.0, ease: 'power2' };
    case 'ring':
      return { at: 0.4, dur: 1.8, ease: 'power2' };
    case 'chart':
      return { at: 1.2, dur: 1.7, ease: 'power3' };
    case 'bars':
      return { at: 0.55, dur: 1.3, ease: 'power3' };
    default:
      return undefined;
  }
}

export interface SoundCue {
  sfx: 'tick' | 'whoosh' | 'pop';
  at: number;
  gain: number;
}

/** Sound effects that belong to a template's own motion, in scene-local seconds. */
export function soundCues(spec: GraphicSpec): SoundCue[] {
  const cues: SoundCue[] = [];
  const w = countWindow(spec);
  if (w) {
    // One tick per equal step of the displayed value, so ticks slow down with the ease-out.
    const n = 12;
    const pow = w.ease === 'power2' ? 2 : 3;
    for (let k = 1; k <= n; k++) cues.push({ sfx: 'tick', at: w.at + w.dur * (1 - Math.pow(1 - k / (n + 1), 1 / pow)), gain: 0.5 - (0.25 * k) / n });
  }
  if (spec.template === 'geo') {
    cues.push({ sfx: 'whoosh', at: 0.75, gain: 0.5 });
    spec.pins.forEach((p) => cues.push({ sfx: 'pop', at: p.main ? 2.5 : 2.3, gain: 0.45 }));
  }
  if (spec.template === 'map') spec.points.forEach((_, i) => cues.push({ sfx: 'pop', at: 0.35 + i * 0.3, gain: 0.3 }));
  if (spec.template === 'chain') cues.push({ sfx: 'pop', at: 1.55, gain: 0.55 });
  if (spec.template === 'versus') cues.push({ sfx: 'whoosh', at: 0.95, gain: 0.35 }, { sfx: 'whoosh', at: 1.35, gain: 0.35 });
  if (spec.template === 'chart' && spec.badge) cues.push({ sfx: 'pop', at: 3.2, gain: 0.45 });
  if (spec.template === 'chat') {
    // Key clicks while the question is typed (pacing does not depend on the scene length), a pop on send.
    const k = chatTiming(spec, 0);
    for (let at = k.typeAt; at < k.typeAt + k.type; at += 0.11) cues.push({ sfx: 'tick', at, gain: 0.3 });
    cues.push({ sfx: 'pop', at: k.send, gain: 0.4 });
  }
  if (spec.template === 'duel') cues.push({ sfx: 'whoosh', at: 0.35, gain: 0.35 }, { sfx: 'pop', at: 2.6, gain: 0.3 });
  if (spec.template === 'links') spec.links.forEach((_, k) => k < 6 && cues.push({ sfx: 'tick', at: 0.5 + spec.words.length * 0.08 + k * Math.min(0.28, 1.6 / spec.links.length), gain: 0.3 }));
  if (spec.template === 'montage') spec.items.forEach((_, i) => i > 0 && cues.push({ sfx: 'tick', at: i * (spec.step ?? MONTAGE_STEP), gain: 0.5 }));
  return cues;
}

/** Static film grain (seeded SVG turbulence): dithers dark gradients so H.264 doesn't band them. */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

function baseCss(t: Theme): string {
  const c = t.colors;
  const faces = t.fontFaces.map((f) => `@font-face { font-family:"${f.family}"; src:url("fonts/${f.file}") format("truetype"); font-weight:${f.weight}; }`).join('\n');
  return `
${faces}
*{box-sizing:border-box}
body{margin:0;background:${c.bg};}
#root{position:relative;width:100%;height:100%;overflow:hidden;background:${c.bg};color:${c.text};font-family:"${t.fonts.body}",sans-serif;-webkit-font-smoothing:antialiased;}
#glow{position:absolute;width:1500px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,${c.bgGlow} 0%,${alpha(c.bgGlow, 0.45)} 45%,${alpha(c.bgGlow, 0)} 100%);}
#grid{position:absolute;inset:0;background-image:${c.texture};${c.textureSize ? `background-size:${c.textureSize};` : ''}}
#grain{position:absolute;inset:0;pointer-events:none;background-image:${GRAIN};background-size:256px 256px;opacity:${t.grain};}
#world{position:absolute;inset:0;}
.kick{display:flex;align-items:center;gap:18px;font-size:30px;line-height:1.1;letter-spacing:${t.kicker.letterSpacingPx}px;${t.kicker.uppercase ? 'text-transform:uppercase;' : ''}color:${c.accent};font-weight:700;}
.kick i{display:block;flex:none;width:46px;height:6px;border-radius:3px;background:${c.accent};transform-origin:left center;}
.sub{font-size:34px;color:${c.textSub};max-width:1180px;line-height:1.4;}
.m{display:inline-block;overflow:hidden;vertical-align:bottom;padding:.42em .08em .16em;margin:-.42em -.08em -.16em;}
.mb{overflow:hidden;padding:.42em .08em .16em;margin:-.42em -.08em -.16em;}
.mi{display:inline-block;will-change:transform;}.mb>.mi{display:block;}
.col{position:absolute;left:180px;right:180px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;}
.disp{font-family:"${t.fonts.display}";font-weight:${t.displayWeight};letter-spacing:-.01em;}
.num{font-family:"${t.fonts.numeric}";font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:0;}
.dg{position:relative;display:inline-block;height:1em;overflow:hidden;padding:0 .04em;margin:0 -.04em;}.dgw{display:inline-block;height:1em;line-height:1;visibility:hidden;}
.dgs{position:absolute;top:0;left:-50%;right:-50%;display:flex;justify-content:center;}.st{display:grid;justify-items:center;}.st span,.wc{display:inline-block;height:1em;line-height:1;}
#world *{-webkit-text-stroke:calc(3px + .03em) ${c.stroke};paint-order:stroke fill;text-shadow:0 4px 22px rgba(0,0,0,.5);}
#world svg text{stroke:${c.stroke};stroke-width:6px;stroke-linejoin:round;paint-order:stroke fill;}
#world :is(.cw,.hlw,.vt,.lv,.ptag,.dtag),#world :is(.cw,.hlw,.vt,.lv,.ptag,.dtag) *{-webkit-text-stroke:0;text-shadow:none;}`;
}

export function validateSpec(sceneId: string, spec: unknown): GraphicSpec {
  const t = (spec as { template?: string } | null)?.template;
  if (!t || !(TEMPLATES as readonly string[]).includes(t)) throw new Error(`${sceneId}: visual.spec.template phải là một trong ${TEMPLATES.join(', ')}`);
  return spec as GraphicSpec;
}

/**
 * Footage/photo layer under the graphic: blurred + dimmed, slow push-in with a slight drift.
 * `left` layouts darken the left side hard (content lives there) and let the footage show on the right.
 */
function background(b: Background, dur: string, t: Theme, layout: Parts['layout']): { html: string; css: string; js: string } {
  const file = bgFileName(b);
  const bg = t.colors.bg;
  const media = isImage(file)
    ? `<img id="bgm" src="${file}" alt="" />`
    : `<video id="bgm" class="clip" src="${file}" data-start="0" data-duration="${dur}" data-media-start="${(b.start ?? 0).toFixed(2)}" muted playsinline></video>`;
  const scrim =
    layout === 'left'
      ? `linear-gradient(90deg,${alpha(bg, 0.8)} 0%,${alpha(bg, 0.62)} 40%,${alpha(bg, 0.25)} 75%,${alpha(bg, 0.1)} 100%)`
      : `radial-gradient(ellipse at 50% 50%,${alpha(bg, 0)} 30%,${alpha(bg, 0.5)} 100%),linear-gradient(${t.colors.scrim},${t.colors.scrim})`;
  return {
    html: `<div id="bgw" class="bgw">${media}</div><div class="scrim"></div>`,
    css: `#grid,#glow{display:none;}.bgw{position:absolute;inset:-5%;filter:blur(${b.blur ?? 6}px) brightness(${b.dim ?? 0.6}) saturate(1.15);}.bgw>*{width:100%;height:100%;object-fit:cover;}.scrim{position:absolute;inset:0;background:${scrim};}`,
    js: `tl.fromTo("#bgw", { scale: 1.1, xPercent: -1.5 }, { scale: 1.0, xPercent: 1.5, duration: ${dur}, ease: "none" }, 0);`,
  };
}

export function renderHtml(spec: GraphicSpec, seconds: number, theme: Theme): string {
  const p = build(spec, theme, seconds);
  const dur = seconds.toFixed(2);
  const bg = spec.bg ? background(spec.bg, dur, theme, p.layout) : undefined;
  const [fx, fy] = p.focus;
  // Ambient life for the hold: slow camera push toward the focus, glow drifting across it.
  const ambient = [
    `tl.fromTo("#world", { scale: 1 }, { scale: 1.03, duration: ${dur}, ease: "none" }, 0);`,
    `tl.fromTo("#glow", { xPercent: -56, yPercent: -50 }, { xPercent: -44, yPercent: -47, duration: ${dur}, ease: "sine.inOut" }, 0);`,
  ];
  return `<!doctype html>
<html lang="vi"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${baseCss(theme)}${bg?.css ?? ''}${p.css ?? ''}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="${dur}">
<div id="glow" style="left:${fx}px;top:${fy}px"></div><div id="grid"></div>${bg?.html ?? ''}
<section id="scene" class="clip" data-start="0" data-duration="${dur}"><div id="world" style="transform-origin:${fx}px ${fy}px">${p.body}</div></section>
<div id="grain"></div>
</div>
<script>
const tl = gsap.timeline({ paused: true });
const fmt = (v, d) => v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
${[...ambient, ...(bg ? [bg.js] : []), ...p.js].join('\n')}
const hosted = !!window.__timelines;
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
if (!hosted) {
  // Plain-browser preview only; under HyperFrames the framework owns media playback.
  document.querySelectorAll("video").forEach((v) => { v.currentTime = Number(v.dataset.mediaStart || 0); v.play(); });
  tl.play();
}
</script></body></html>
`;
}
