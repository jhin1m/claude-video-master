// "Hồ sơ tư liệu" style: the frame is a sheet of aged paper on a desk of evidence.
// Footage becomes a taped photo print (left layouts) or a faint photocopy (full-frame layouts);
// kickers are embossed label tape, key words get a highlighter pass, numbers are circled in red ink,
// sources are typed out like a footnote, verdicts land as rubber stamps.
//
// Techniques adapted from the HyperFrames registry: marker-highlight (stretched hand-drawn paths
// revealed by a measured dash), hw-* (deterministic stop-motion "boil" on ink every 3 frames),
// headline-slam (landing + three-frame shake), freeze-frame-dressing (tape + flash),
// organic-light-leak-overlay (warm screen-blend leak, here on the photo print only).
//
// Timings that carry SFX (count windows, versus whooshes, chart badge pop) match templates.ts
// so `soundCues()` stays valid for both styles.

import { alpha, bgFileName, chatTiming, countTo, cubic, decimalsOf, esc, extOf, f2, isImage, MONTAGE_STEP, polyLength, vn, wheel, type Background, type GraphicSpec, type Parts } from './templates.ts';
import type { Theme } from './theme.ts';

/** Where a template wants the footage: a taped print at this spot, or a faint photocopy of the whole frame. */
export type PrintSpot = { x: number; y: number; w: number; h: number; rot: number } | 'copy';
export interface DossierParts extends Parts {
  print: PrintSpot;
}

const PRINT_RIGHT: PrintSpot = { x: 1190, y: 250, w: 580, h: 420, rot: 2.6 };

/** Deterministic pseudo-random in [-1, 1] (same hash as the registry hw-* family). */
const hash = (n: number, seed: number) => {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** Catmull-Rom through points → cubic Bézier path (smooth, passes every point). */
function smooth(P: [number, number][]): string {
  let d = `M${f2(P[0]![0])} ${f2(P[0]![1])}`;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[Math.max(0, i - 1)]!;
    const b = P[i]!;
    const e = P[i + 1]!;
    const g = P[Math.min(P.length - 1, i + 2)]!;
    d += ` C${f2(b[0] + (e[0] - a[0]) / 6)} ${f2(b[1] + (e[1] - a[1]) / 6)} ${f2(e[0] - (g[0] - b[0]) / 6)} ${f2(e[1] - (g[1] - b[1]) / 6)} ${f2(e[0])} ${f2(e[1])}`;
  }
  return d;
}

/** A red-ink loop around a w×h box (px), starting top-left and overshooting past its start. */
function inkLoop(w: number, h: number, seed: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const N = 28;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = -Math.PI * 0.72 + u * Math.PI * 2 * 1.1;
    const j = 1 + hash(i, seed) * 0.025 + u * 0.045; // the loop drifts outward as the pen comes round
    pts.push([cx + Math.cos(a) * (w / 2 - 14) * j, cy + Math.sin(a) * (h / 2 - 14) * j + u * 6]);
  }
  return smooth(pts);
}

// Authored in a fixed viewBox and stretched into the word box (preserveAspectRatio="none"): the
// anisotropic stretch is what gives the stroke its marker-nib weight.
const HIGHLIGHT = { viewBox: '0 0 100 40', d: 'M 3 24 C 22 20.5, 47 25.5, 68 22.5 C 79 21, 90 23, 97 21.5', width: 26 };
const UNDERLINE = { viewBox: '0 0 100 12', d: 'M 2 7 C 20 4.5, 46 8.5, 66 6 C 80 4.5, 92 7.5, 98 5.5', width: 4.5 };
/** Pencil hatching (`url(#hatch)`), one per composition. */
const HATCH = (ink: string) => `<defs><pattern id="hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line x1="0" y1="0" x2="0" y2="16" stroke="${ink}" stroke-width="3.2" opacity=".42"/></pattern></defs>`;
const markSvg = (m: typeof HIGHLIGHT, id: string, cls: string, color: string) =>
  `<svg class="${cls}" viewBox="${m.viewBox}" preserveAspectRatio="none" aria-hidden="true"><path id="${id}" d="${m.d}" fill="none" stroke="${color}" stroke-width="${m.width}" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`;

/**
 * Page runtime: dash draw-on from the measured length (ink hidden until its cue, since a round cap
 * paints a dot at dashoffset == length), stop-motion boil, typewriter, blinking caret.
 */
const RUNTIME = `const hs = { fns: [] };
tl.eventCallback("onUpdate", () => { for (const f of hs.fns) f(); });
hs.hash = (n, seed) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
hs.draw = (id, at, dur, op) => { const p = document.getElementById(id), L = p.getTotalLength(); p.style.strokeDasharray = L; gsap.set(p, { strokeDashoffset: L, opacity: 0 }); tl.set(p, { opacity: op }, at); tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, at); };
hs.boil = (sel, seed, amp, rot, base) => { const els = gsap.utils.toArray(sel); hs.fns.push(() => { const step = Math.floor(tl.time() * 30 / 3); els.forEach((el, i) => gsap.set(el, { x: hs.hash(step * 3 + i * 97, seed) * amp, y: hs.hash(step * 3 + 1 + i * 97, seed) * amp, rotation: base + hs.hash(step * 3 + 2 + i * 97, seed) * rot })); }); };
hs.type = (id, at, dur) => { const el = document.getElementById(id), full = [...el.dataset.full], end = at + dur; hs.fns.push(() => { const t = tl.time(); const k = t < at ? 0 : Math.min(full.length, Math.round((t - at) / dur * full.length)); const caret = t >= at && (t < end || Math.floor((t - end) * 2.4) % 2 === 0); el.textContent = full.slice(0, k).join("") + (caret ? "▌" : ""); }); };`;

export function dossierCss(t: Theme): string {
  const c = t.colors;
  const hand = t.fonts.hand ?? t.fonts.body;
  return `
#glow{display:none;}
#world *{-webkit-text-stroke:0;text-shadow:none;}
.col{left:170px;right:auto;}
.disp{text-transform:uppercase;letter-spacing:.005em;}
.hand{font-family:"${hand}";font-weight:400;color:${c.accent};}
#world .dy{display:inline-flex;align-items:center;padding:15px 34px 13px;background:linear-gradient(180deg,#2c2a25,#121110);color:#efe9dc;font-family:"${t.fonts.body}";font-weight:700;font-size:28px;line-height:1;letter-spacing:.22em;text-transform:uppercase;clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 16%,calc(100% - 6px) 33%,100% 50%,calc(100% - 6px) 67%,100% 84%,calc(100% - 9px) 100%,9px 100%,0 84%,6px 67%,0 50%,6px 33%,0 16%);text-shadow:0 -1px 0 rgba(0,0,0,.85),0 1px 0 rgba(255,255,255,.3);}
.dyw{display:inline-block;filter:drop-shadow(0 3px 2px rgba(40,28,10,.35));}
.tw{position:relative;font-family:"${t.fonts.body}";font-size:28px;line-height:1.5;color:${c.textSub};}
.tw .gh{visibility:hidden;}.tw .ty{position:absolute;left:0;top:0;right:0;}
.tw::before{content:"";position:absolute;left:-26px;top:.35em;width:10px;height:.9em;background:${c.accent};opacity:.85;}
#world .stamp{display:inline-flex;align-items:center;gap:.3em;padding:.2em .55em .12em;border:.09em solid ${c.accent};border-radius:.14em;box-shadow:inset 0 0 0 .05em ${c.bg},inset 0 0 0 .1em ${c.accent};color:${c.accent};font-family:"${t.fonts.display}";letter-spacing:.06em;text-transform:uppercase;line-height:1;white-space:nowrap;opacity:.9;-webkit-mask-image:${SPECKLE};mask-image:${SPECKLE};-webkit-mask-size:420px 420px;mask-size:420px 420px;}
.ink{position:absolute;overflow:visible;pointer-events:none;}
.tape{position:absolute;width:176px;height:48px;background:rgba(238,226,190,.8);box-shadow:0 1px 3px rgba(60,40,10,.22);clip-path:polygon(3% 0,97% 4%,100% 22%,97% 40%,100% 62%,97% 80%,99% 100%,2% 96%,0 78%,3% 58%,0 40%,3% 20%);}
.pushpin{position:absolute;width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e46a55,${c.accent} 55%,#6d1d10);box-shadow:0 5px 6px rgba(40,20,10,.35);}
#world .slip{position:absolute;padding:14px 34px 12px 26px;background:#fdfcf6;border-left:12px solid ${c.accent};font-family:"${t.fonts.body}";font-weight:700;font-size:38px;line-height:1.1;color:${c.text};white-space:nowrap;box-shadow:0 10px 24px rgba(52,36,12,.25);}
.gpaper{position:absolute;background-color:#f8f6ef;background-image:linear-gradient(rgba(70,120,170,.3) 2px,transparent 2px),linear-gradient(90deg,rgba(70,120,170,.3) 2px,transparent 2px),linear-gradient(rgba(70,120,170,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(70,120,170,.13) 1px,transparent 1px);background-size:110px 110px,110px 110px,22px 22px,22px 22px;box-shadow:0 22px 44px rgba(52,36,12,.3),0 2px 5px rgba(52,36,12,.22);}
.tl-k{position:absolute;left:170px;top:110px;}
/* Templates still on the editorial layout (geo): label-tape kicker, paper callouts, push-pins, paper under the map. */
#root #grid{display:block;}
#world .gk{background:none;padding:0;border-radius:0;}
#world .kick{display:inline-flex;gap:0;padding:15px 34px 13px;background:linear-gradient(180deg,#2c2a25,#121110);color:#efe9dc;font-size:28px;letter-spacing:.22em;clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 16%,calc(100% - 6px) 33%,100% 50%,calc(100% - 6px) 67%,100% 84%,calc(100% - 9px) 100%,9px 100%,0 84%,6px 67%,0 50%,6px 33%,0 16%);}
#world .kick i{display:none;}
#world .gs{border-radius:2px;box-shadow:0 10px 24px rgba(52,36,12,.22);}
#world .pin i{background:radial-gradient(circle at 35% 35%,#7c9ddb,${c.secondary} 55%,#10275a);box-shadow:0 4px 5px rgba(40,20,10,.35);}
#world .pin.main i{background:radial-gradient(circle at 35% 35%,#e46a55,${c.accent} 55%,#6d1d10);box-shadow:0 5px 6px rgba(40,20,10,.4);}
#world .cd{border-radius:2px;background:#fdfcf6;box-shadow:inset 10px 0 0 ${c.accent},0 12px 26px rgba(52,36,12,.3);}
#world .cd b{text-transform:uppercase;}
#world .hl{color:${c.accent};}
#world .pl{text-shadow:0 0 6px ${c.mapSea},0 0 3px ${c.mapSea};}
#world .ptag{background:#fdfcf6;border-radius:2px;}`;
}

/** Worn-ink mask for stamps: mostly opaque, seeded speckle holes. */
const SPECKLE = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='s'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='2' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4.2 0 0 0 -1.25'/></filter><rect width='420' height='420' filter='url(#s)'/></svg>`)}")`;

/** Footage as a taped photo print (with a light leak drifting over it) or as a faint photocopy. */
export function dossierBackground(b: Background, dur: string, spot: PrintSpot, focus: [number, number]): { html: string; css: string; js: string } {
  const file = bgFileName(b);
  const media = isImage(file)
    ? `<img id="bgm" src="${file}" alt="" />`
    : `<video id="bgm" class="clip" src="${file}" data-start="0" data-duration="${dur}" data-media-start="${(b.start ?? 0).toFixed(2)}" muted playsinline></video>`;
  if (spot === 'copy') {
    return {
      html: `<div id="cp" class="copy">${media}</div>`,
      css: `.copy{position:absolute;inset:-3%;mix-blend-mode:multiply;filter:grayscale(1) contrast(1.75) brightness(1.08) blur(${b.blur ?? 1.2}px);}.copy>*{width:100%;height:100%;object-fit:cover;}`,
      js: `tl.fromTo("#cp", { opacity: 0 }, { opacity: ${f2((b.dim ?? 0.6) * 0.2)}, duration: 0.8, ease: "power2.out" }, 0); tl.fromTo("#cp", { scale: 1.06 }, { scale: 1, duration: ${dur}, ease: "none" }, 0);`,
    };
  }
  const { x, y, w, h, rot } = spot;
  return {
    html: `<div id="prw" class="prw" style="transform-origin:${focus[0]}px ${focus[1]}px"><div id="pr" class="print" style="left:${x}px;top:${y}px;width:${w + 32}px;height:${h + 88}px">` +
      `<div class="pi"><div id="pm" class="pm">${media}</div><div id="lk" class="lk"><i class="la"></i><i class="lb"></i></div><div id="pf" class="pf"></div></div>` +
      `<span class="pcap">ảnh minh hoạ</span><i id="tp0" class="tape" style="left:-54px;top:-6px"></i><i id="tp1" class="tape" style="right:-54px;top:-6px"></i></div></div>`,
    css: `.prw{position:absolute;inset:0;}
.print{position:absolute;padding:16px 16px 72px;background:#f8f5ed;box-shadow:0 26px 50px rgba(52,36,12,.34),0 3px 6px rgba(52,36,12,.28);}
.pi{position:relative;width:100%;height:100%;overflow:hidden;background:#2a2723;}
.pm{position:absolute;inset:0;}.pm>*{width:100%;height:100%;object-fit:cover;filter:sepia(.28) contrast(1.06) saturate(.82) brightness(${b.dim === undefined ? 1 : Math.min(1, b.dim + 0.4)});}
.lk{position:absolute;inset:-20%;mix-blend-mode:screen;opacity:0;}.lk i{position:absolute;inset:0;}
.la{background:radial-gradient(ellipse 50% 100% at 12% 58%,rgba(255,241,197,.9),transparent 46%),radial-gradient(ellipse 70% 120% at 24% 54%,rgba(255,126,57,.7),transparent 66%);filter:blur(26px);}
.lb{background:linear-gradient(104deg,transparent 26%,rgba(255,144,62,.3) 42%,rgba(255,247,205,.7) 52%,rgba(255,124,48,.2) 62%,transparent 78%);filter:blur(20px);}
.pf{position:absolute;inset:0;background:#fff;opacity:0;}
.pcap{position:absolute;left:24px;bottom:18px;font-family:"Patrick Hand";font-size:34px;line-height:1;color:#4a453b;}`,
    js: [
      `tl.fromTo("#pr", { opacity: 0, y: -80, rotation: ${f2(rot + 7)} }, { opacity: 1, y: 0, rotation: ${f2(rot)}, duration: 0.7, ease: "power3.out" }, 0.12);`,
      `tl.fromTo("#pf", { opacity: 0 }, { opacity: 0.85, duration: 0.05, ease: "power2.out" }, 0.62); tl.to("#pf", { opacity: 0, duration: 0.3, ease: "power2.in" }, 0.67);`,
      `tl.fromTo("#tp0", { opacity: 0, scale: 1.2, rotation: -38 }, { opacity: 1, scale: 1, rotation: -38, duration: 0.24, ease: "power2.out" }, 0.78);`,
      `tl.fromTo("#tp1", { opacity: 0, scale: 1.2, rotation: 36 }, { opacity: 1, scale: 1, rotation: 36, duration: 0.24, ease: "power2.out" }, 0.9);`,
      `tl.fromTo("#pm", { scale: 1.14 }, { scale: 1, duration: ${dur}, ease: "none" }, 0);`,
      `tl.fromTo("#prw", { scale: 1 }, { scale: 1.03, duration: ${dur}, ease: "none" }, 0);`,
      `tl.fromTo("#lk", { opacity: 0 }, { opacity: 0.75, duration: 0.9, ease: "sine.out" }, 0.7); tl.to("#lk", { opacity: 0.25, duration: 1.4, ease: "sine.inOut" }, 1.8);`,
      `tl.fromTo("#lk .la", { xPercent: -22 }, { xPercent: 20, duration: ${dur}, ease: "sine.inOut" }, 0); tl.fromTo("#lk .lb", { xPercent: -30 }, { xPercent: 26, duration: ${dur}, ease: "sine.inOut" }, 0);`,
    ].join('\n'),
  };
}

/** Dossier layout for the templates this style covers; `undefined` → the editorial layout. */
export function buildDossier(spec: GraphicSpec, t: Theme, seconds: number): DossierParts | undefined {
  const c = t.colors;
  const hasPrint = !!spec.bg;
  const label = (text: string, cls = '') => `<div id="dy" class="dyw${cls ? ` ${cls}` : ''}"><div class="dy">${esc(text)}</div></div>`;
  const labelIn = (at = 0.1) =>
    `tl.fromTo("#dy", { clipPath: "inset(-40% 100% -40% -6%)", rotation: -1.4, y: -10 }, { clipPath: "inset(-40% -6% -40% -6%)", rotation: -1.4, y: 0, duration: 0.55, ease: "power2.out" }, ${f2(at)});`;
  const typed = (id: string, text: string, cls = '', style = '') => `<div class="tw${cls ? ` ${cls}` : ''}"${style ? ` style="${style}"` : ''}><span class="gh">${esc(text)}▌</span><span id="${id}" class="ty" data-full="${esc(text)}"></span></div>`;
  const typeIn = (id: string, at: number, text: string) => `hs.type("${id}", ${f2(at)}, ${f2(Math.min(1.5, Math.max(0.5, [...text].length * 0.024)))});`;
  /** Handwriting written on left→right. */
  const writeIn = (sel: string, at: number, dur = 0.55) => `tl.fromTo("${sel}", { clipPath: "inset(-30% 100% -30% -10%)" }, { clipPath: "inset(-30% -10% -30% -10%)", duration: ${dur}, ease: "power1.inOut" }, ${f2(at)});`;
  /** Rubber stamp: slams down from 1.6×, then a three-frame shake of the whole sheet. */
  const stampIn = (sel: string, at: number, rot: number) => [
    `tl.fromTo("${sel}", { opacity: 0, scale: 1.6, rotation: ${rot - 6} }, { opacity: 0.9, scale: 1, rotation: ${rot}, duration: 0.24, ease: "expo.in" }, ${f2(at)});`,
    `tl.to("#world", { x: 5, y: -3, duration: 1 / 30, ease: "none" }, ${f2(at + 0.24)}); tl.to("#world", { x: -4, y: 2, duration: 1 / 30, ease: "none" }, ">"); tl.to("#world", { x: 0, y: 0, duration: 1 / 30, ease: "none" }, ">");`,
  ];
  /** Word pressed into the paper: lands from slightly large and blurred. */
  const press = (sel: string, at: number) => `tl.fromTo("${sel}", { opacity: 0, scale: 1.14, filter: "blur(6px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.3, ease: "power2.out" }, ${f2(at)});`;
  const tapeIn = (sel: string, at: number, rot: number) => `tl.fromTo("${sel}", { opacity: 0, scale: 1.2, rotation: ${rot} }, { opacity: 1, scale: 1, rotation: ${rot}, duration: 0.24, ease: "power2.out" }, ${f2(at)});`;
  const base = { layout: 'left' as const, print: hasPrint ? PRINT_RIGHT : ('copy' as const) };

  switch (spec.template) {
    // The statement as a headline: words press into the paper; *marked* words get a highlighter
    // stroke, numbers are red ink, otherwise the last word is underlined in ink.
    case 'text': {
      const W = hasPrint ? 940 : 1540;
      const parts: { word: string; hl: boolean; unit: number }[] = [];
      let unit = 0;
      for (const seg of spec.text.split(/(\*[^*]+\*)/)) {
        if (!seg) continue;
        const hl = /^\*[^*]+\*$/.test(seg);
        const words = (hl ? seg.slice(1, -1) : seg).split(/\s+/).filter(Boolean);
        words.forEach((word) => parts.push({ word, hl, unit: hl ? unit : unit++ }));
        if (hl) unit++;
      }
      const isNum = (w: string) => /^[+\-−×=]?[\d.,%]*\d[\d.,%]*$|^[+\-−×=]$/.test(w);
      const plain = spec.text.replace(/\*/g, '');
      const L = [...plain].length;
      const upper = L <= 44;
      const size = Math.round(Math.max(84, Math.min(upper ? 200 : 150, (W * 2.7) / (L * (upper ? 0.54 : 0.46)))));
      const anyHl = parts.some((p) => p.hl);
      const anyNum = parts.some((p) => isNum(p.word));
      const underline = !anyHl && !anyNum;
      const word = (p: (typeof parts)[number], i: number) => `<span id="w${i}" class="wd${isNum(p.word) ? ' tn' : ''}">${esc(p.word)}</span>`;
      let html = '';
      let hlCount = 0;
      for (let i = 0; i < parts.length; ) {
        const p = parts[i]!;
        if (p.hl) {
          let j = i;
          const run: string[] = [];
          for (; parts[j]?.hl && parts[j]!.unit === p.unit; j++) run.push(word(parts[j]!, j));
          html += `${html ? ' ' : ''}<span class="hl">${markSvg(HIGHLIGHT, `hm${hlCount++}`, 'hlm', alpha(c.accentHi, 1))}<span class="hlt">${run.join(' ')}</span></span>`;
          i = j;
        } else {
          const last = underline && i === parts.length - 1;
          html += `${html ? ' ' : ''}${last ? `<span class="ulw">${word(p, i)}<span id="ulb" class="ulb">${markSvg(UNDERLINE, 'um', 'ulm', c.accent)}</span></span>` : word(p, i)}`;
          i++;
        }
      }
      const step = Math.min(0.09, 0.7 / parts.length);
      const done = 0.4 + step * parts.length + 0.3;
      return {
        ...base,
        focus: [620, 520],
        body: `<div class="col" style="width:${W}px">${label(spec.kicker)}<div class="tx disp" style="font-size:${size}px;${upper ? '' : 'text-transform:none;'}">${html}</div>${typed('s', spec.sub)}</div>`,
        css: `.tx{line-height:1.13;margin:44px 0 46px;color:${c.text};}.wd{display:inline-block;transform-origin:50% 60%;}.tn{color:${c.accent};}
.hl{position:relative;display:inline-block;white-space:nowrap;}.hlt{position:relative;z-index:1;}.hlm{position:absolute;left:-4%;top:16%;width:108%;height:74%;z-index:0;overflow:visible;}
.ulw{position:relative;display:inline-block;}.ulb{position:absolute;left:-2%;bottom:-.04em;width:105%;height:.2em;}.ulm{width:100%;height:100%;overflow:visible;}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          ...parts.map((_, i) => press(`#w${i}`, 0.4 + i * step)),
          ...Array.from({ length: hlCount }, (_, k) => `hs.draw("hm${k}", ${f2(done - 0.15 + k * 0.2)}, 0.55, 0.62);`),
          ...(underline ? [`hs.draw("um", ${f2(done - 0.1)}, 0.5, 1);`, `hs.boil("#ulb", 7, 1.2, 0.4, 0);`] : []),
          typeIn('s', done + 0.35, spec.sub),
        ],
      };
    }

    // The figure in headline type, rolling like an odometer; the unit is written in by hand and
    // the result gets circled in red ink.
    case 'counter': {
      const dec = spec.decimals ?? 0;
      const txt = vn(spec.to, dec);
      const digits = txt.replace(/\D/g, '').length;
      const size = digits <= 2 ? 440 : digits <= 3 ? 380 : digits <= 5 ? 300 : 230;
      const numW = [...txt].reduce((s, ch) => s + (/\d/.test(ch) ? 0.5 : 0.24), 0) * size;
      const loopW = Math.round(numW + size * 0.5);
      const loopH = Math.round(size * 1.28);
      const w = spec.from === undefined ? wheel(txt, 'cw') : undefined;
      const from = spec.from ?? 0;
      const unitSize = 110;
      return {
        ...base,
        focus: [560, 520],
        body: `<div class="col">${label(spec.kicker)}<div class="cn"><div class="cb"><div id="cnum" class="cnum num" style="font-size:${size}px">${w ? w.html : `<span id="v">${vn(from, dec)}</span>`}</div>` +
          `<div id="lpb" class="ink" style="left:${f2(numW / 2 - loopW / 2)}px;top:${f2(size / 2 - loopH / 2 + size * 0.02)}px"><svg width="${loopW}" height="${loopH}" style="overflow:visible"><path id="lp" d="${inkLoop(loopW, loopH, 3)}" fill="none" stroke="${c.accent}" stroke-width="11" stroke-linecap="round" opacity="0"/></svg></div></div>` +
          `<div id="cu" class="cu hand">${esc(spec.unit)}</div></div>${typed('s', spec.sub)}</div>`,
        css: `.cn{display:flex;align-items:flex-end;gap:${Math.round(size * 0.22)}px;margin:${Math.round(size * 0.16) + 30}px 0 ${Math.round(size * 0.14) + 40}px ${Math.round(size * 0.12)}px}.cb{position:relative}.cnum{display:flex;align-items:flex-end;line-height:1;color:${c.text}}
.cu{font-size:${unitSize}px;line-height:1;white-space:nowrap;transform:rotate(-5deg);margin-bottom:${Math.round(size * 0.12)}px}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          'tl.fromTo("#cnum", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.3);',
          ...(w ? w.js(0.4, 1.9) : [countTo('v', from, spec.to, dec, 0.4, 2.0)]),
          writeIn('#cu', 1.3, 0.6),
          'hs.boil("#cu", 5, 1.4, 0.5, -5);',
          'hs.draw("lp", 2.25, 0.7, 1);',
          'hs.boil("#lpb", 9, 1.6, 0.35, 0);',
          typeIn('s', 2.1, spec.sub),
        ],
      };
    }

    // A ledger of highlighter strokes: each value rides the tip of its stroke while counting up.
    case 'bars': {
      const n = spec.items.length;
      const big = n <= 3;
      const trackW = hasPrint ? 740 : 1240;
      const barH = big ? 78 : 54;
      const max = Math.max(...spec.items.map((i) => i.value));
      const marker = (tone?: string) =>
        tone === 'cyan' ? 'rgba(96,150,226,.62)' : tone === 'muted' ? 'rgba(150,138,112,.5)' : tone === 'dim' ? 'rgba(150,138,112,.28)' : alpha(c.accentHi, 0.82);
      const rows = spec.items
        .map((it, i) => {
          const wpx = Math.max(24, Math.round((it.value / max) * trackW));
          return `<div class="br"><div id="bl${i}" class="bl">${esc(it.label)}</div><div class="bt"><div id="b${i}" class="bf" style="width:${wpx}px;background-color:${marker(it.tone)}"></div><div id="bw${i}" class="bv num" style="left:${wpx + 26}px"><span id="bv${i}">0</span></div></div></div>`;
        })
        .join('');
      return {
        ...base,
        focus: [620, 540],
        body: `<div class="col" style="width:${trackW + 260}px"><div class="bh">${label(spec.kicker)}<div id="bu" class="bu hand">${esc(spec.unit)}</div></div><div class="rows"><i id="ax" class="ax"></i>${rows}</div>${typed('s', spec.sub)}</div>`,
        css: `.bh{display:flex;justify-content:space-between;align-items:center;width:100%}.bu{font-size:52px;line-height:1;transform:rotate(-3deg)}
.rows{position:relative;width:100%;display:flex;flex-direction:column;gap:${big ? 40 : 24}px;margin:${big ? 58 : 40}px 0 ${big ? 54 : 40}px;padding-left:26px}
.ax{position:absolute;left:0;top:-14px;bottom:-14px;width:5px;border-radius:3px;background:${c.text};opacity:.8;transform-origin:50% 0}
.bl{font-family:"${t.fonts.body}";font-weight:700;font-size:${big ? 34 : 28}px;line-height:1.2;margin-bottom:${big ? 12 : 8}px;color:${c.text}}.bt{position:relative;height:${barH}px}
.bf{position:absolute;left:-10px;top:0;bottom:0;transform-origin:left center;clip-path:polygon(0 10%,2% 0,97% 4%,100% 20%,98.5% 50%,100% 82%,97.5% 100%,1% 93%,0 60%);background-image:linear-gradient(180deg,rgba(255,255,255,.2) 0 12%,transparent 12% 30%,rgba(0,0,0,.05) 30% 34%,transparent 34% 70%,rgba(255,255,255,.16) 70% 76%,transparent 76%)}
.bv{position:absolute;top:0;bottom:0;display:flex;align-items:center;font-size:${big ? 88 : 60}px;line-height:1;white-space:nowrap;color:${c.text}}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          writeIn('#bu', 0.35, 0.5),
          'hs.boil("#bu", 4, 1.2, 0.4, -3);',
          'tl.fromTo("#ax", { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power2.inOut" }, 0.2);',
          ...spec.items.flatMap((it, i) => {
            const at = 0.55 + i * 0.2;
            const wpx = Math.max(24, Math.round((it.value / max) * trackW));
            return [
              `tl.fromTo("#bl${i}", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "steps(${Math.max(4, [...it.label].length)})" }, ${f2(0.3 + i * 0.12)});`,
              `tl.fromTo("#b${i}", { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: "power3.out" }, ${f2(at)});`,
              `tl.fromTo("#bw${i}", { x: ${-wpx - 26}, opacity: 0 }, { x: 0, opacity: 1, duration: 1.3, ease: "power3.out" }, ${f2(at)});`,
              countTo(`bv${i}`, 0, it.value, decimalsOf(it.value), at, 1.3, 'power3.out'),
            ];
          }),
          typeIn('s', 0.9 + n * 0.2, spec.sub),
        ],
      };
    }

    // Headline number on the left; a taped sheet of graph paper on the right with pencil-hatched
    // columns, a red-ink trend line and handwritten values; the badge lands as a rubber stamp.
    case 'chart': {
      const last = spec.items.at(-1)!;
      const max = Math.max(...spec.items.map((i) => i.value)) * 1.14;
      const baseY = 560;
      const hgt = 460;
      const colW = 116;
      const gap = (1000 - colW * spec.items.length) / (spec.items.length + 1);
      const xs = spec.items.map((_, i) => gap + i * (colW + gap) + colW / 2);
      const ys = spec.items.map((it) => baseY - (it.value / max) * hgt);
      let len = 0;
      for (let i = 1; i < xs.length; i++) len += Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!);
      // Slightly wobbly outline: a column drawn with a ruler but by hand.
      const colPath = (x: number, y: number, i: number) => {
        const j = (k: number) => f2(hash(i * 13 + k, 21) * 2.2);
        return `M${f2(x)} ${baseY} L${f2(x + +j(1))} ${f2(y)} L${f2(x + colW + +j(2))} ${f2(y + +j(3))} L${f2(x + colW)} ${baseY}`;
      };
      const cols = spec.items
        .map((it, i) => {
          const isLast = i === spec.items.length - 1;
          const x = xs[i]! - colW / 2;
          return `<g id="col${i}"><rect x="${f2(x)}" y="${f2(ys[i]!)}" width="${colW}" height="${f2(baseY - ys[i]!)}" fill="${isLast ? alpha(c.accentHi, 0.85) : 'url(#hatch)'}"/><path d="${colPath(x, ys[i]!, i)}" fill="none" stroke="${c.text}" stroke-width="${isLast ? 4.5 : 3.5}" stroke-linejoin="round" stroke-linecap="round"/></g>` +
            `<text id="cv${i}" x="${f2(xs[i]!)}" y="${f2(ys[i]! - 58)}" text-anchor="middle" class="hv" font-size="${isLast ? 58 : 46}" fill="${isLast ? c.accent : c.textSub}">${vn(it.value)}</text>` +
            `<text x="${f2(xs[i]!)}" y="${baseY + 54}" text-anchor="middle" class="xl" font-size="32" fill="${isLast ? c.text : c.textLabel}">${esc(it.label)}</text>`;
        })
        .join('');
      const dots = xs.map((x, i) => `<circle id="dt${i}" cx="${f2(x)}" cy="${f2(ys[i]! - 24)}" r="${i === xs.length - 1 ? 11 : 8}" fill="${c.accent}"/>`).join('');
      const line = `<path id="trend" d="M${xs.map((x, i) => `${f2(x)} ${f2(ys[i]! - 24)}`).join('L')}" fill="none" stroke="${c.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${len.toFixed(1)}"/>`;
      const w = wheel(vn(last.value), 'st');
      return {
        ...base,
        print: 'copy',
        focus: [480, 520],
        body: `<div class="cl">${label(spec.kicker)}<div id="nw" class="nw num">${w.html}</div><div id="un" class="un hand">${esc(spec.unit)}</div>${typed('lb', spec.label, 'lb')}${spec.badge ? `<div class="bdw"><div id="bd" class="stamp">${esc(spec.badge)}</div></div>` : ''}</div>` +
          `<div id="gp" class="gpaper gp"><svg class="cr" width="880" height="563" viewBox="0 0 1000 640">${HATCH(c.text)}` +
          `<line x1="-10" y1="${baseY}" x2="1010" y2="${baseY}" stroke="${c.text}" stroke-width="4" stroke-linecap="round"/>${cols}${line}${dots}</svg><i id="gt0" class="tape" style="left:-40px;top:-18px"></i><i id="gt1" class="tape" style="right:-40px;top:-18px"></i></div>` +
          typed('s', spec.sub, 'cs'),
        css: `.cl{position:absolute;left:170px;width:580px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.nw{display:flex;align-items:flex-end;font-size:230px;margin-top:40px;color:${c.text}}.un{font-size:84px;line-height:1;margin-top:10px;transform:rotate(-4deg)}.lb{font-size:28px;margin-top:22px;max-width:560px}
.bdw{margin-top:40px;font-size:44px}
.gp{left:810px;top:160px;width:960px;height:680px}
.cr{position:absolute;left:40px;top:70px;overflow:visible}.hv{font-family:"${t.fonts.hand ?? t.fonts.body}"}.xl{font-family:"${t.fonts.body}"}
.cs{position:absolute;left:830px;top:880px;width:920px;font-size:26px}`,
        js: [
          RUNTIME,
          'tl.fromTo("#gp", { opacity: 0, y: 60, rotation: -4 }, { opacity: 1, y: 0, rotation: -1.3, duration: 0.7, ease: "power3.out" }, 0.05);',
          tapeIn('#gt0', 0.55, -32),
          tapeIn('#gt1', 0.65, 30),
          labelIn(0.1),
          ...spec.items.flatMap((_, i) => [
            `tl.fromTo("#col${i}", { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.7, ease: "power3.out" }, ${f2(0.3 + i * 0.16)});`,
            `tl.fromTo("#cv${i}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, ${f2(0.65 + i * 0.16)});`,
          ]),
          `tl.fromTo("#trend", { attr: { "stroke-dashoffset": ${len.toFixed(1)} } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.0, ease: "power1.inOut" }, 1.3);`,
          ...xs.map((_, i) => `tl.fromTo("#dt${i}", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, ${f2(1.3 + (i / Math.max(1, xs.length - 1)) * 1.0)});`),
          'tl.fromTo("#nw", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.9);',
          ...w.js(1.2, 1.7),
          writeIn('#un', 2.3, 0.5),
          'hs.boil("#un", 6, 1.3, 0.45, -4);',
          typeIn('lb', 2.55, spec.label),
          ...(spec.badge ? stampIn('#bd', 2.96, -7) : []),
          typeIn('s', 3.4, spec.sub),
        ],
      };
    }

    // Two index cards pinned side by side; a red VS stamp slams between them, the tags fly in on
    // paper slips and each card recoils on impact.
    case 'versus': {
      const fit = (s: string) => Math.min(170, Math.floor(600 / ([...s].length * 0.56)));
      const card = (id: string, side: 'l' | 'r', name: string, color: string, seed: number) =>
        `<div id="${id}" class="card card${side}"><div class="cnm disp" style="font-size:${fit(name)}px"><span id="n${side}">${esc(name)}</span></div><span id="u${side}" class="cul" style="top:${Math.round(271 + fit(name) * 0.56 + 14)}px">${markSvg(UNDERLINE, `um${side}`, 'ulm', color)}</span><span class="cno hand">${side === 'l' ? 'A' : 'B'}</span><i class="pushpin" style="left:${310 + seed}px;top:-16px"></i></div>`;
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 500],
        body: card('cL', 'l', spec.left, c.accent, 4) + card('cR', 'r', spec.right, c.secondary, -8) +
          `<div class="vsw"><div id="vs" class="stamp vs">VS</div></div>` +
          `<div id="t1" class="slip" style="top:760px;border-left-color:${c.accent}">${esc(spec.leftTag)}</div><div id="t2" class="slip" style="top:856px;border-left-color:${c.secondary}">${esc(spec.rightTag)}</div>` +
          `${label(spec.kicker, 'tl-k')}<div class="bc-s">${typed('s', spec.sub)}</div>`,
        css: `.card{position:absolute;top:250px;width:700px;height:430px;background-color:#fbfaf4;background-image:linear-gradient(transparent 0 104px,${alpha(c.accent, 0.55)} 104px 107px,transparent 107px),repeating-linear-gradient(transparent 0 46px,rgba(60,110,180,.2) 46px 48px);background-position:0 0,0 104px;box-shadow:0 22px 44px rgba(52,36,12,.3),0 2px 5px rgba(52,36,12,.22)}
.cardl{left:170px}.cardr{left:1050px;top:266px}
.cnm{position:absolute;left:0;right:0;top:112px;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.05;color:${c.text};text-align:center}
.cul{position:absolute;left:18%;width:64%;height:26px}.ulm{width:100%;height:100%;overflow:visible}
.cno{position:absolute;left:28px;top:22px;font-size:56px;line-height:1}
.vsw{position:absolute;left:960px;top:470px;width:0;height:0;display:flex;align-items:center;justify-content:center;font-size:92px}.vs{padding:.28em .42em .2em;border-radius:50%}
.slip{left:960px}
.bc-s{position:absolute;left:260px;right:260px;bottom:56px;text-align:center}.bc-s .tw{display:inline-block;text-align:left}`,
        js: [
          RUNTIME,
          'tl.fromTo("#cL", { opacity: 0, y: -70, rotation: -8 }, { opacity: 1, y: 0, rotation: -2.4, duration: 0.65, ease: "power3.out" }, 0.05);',
          'tl.fromTo("#cR", { opacity: 0, y: -70, rotation: 8 }, { opacity: 1, y: 0, rotation: 2.2, duration: 0.65, ease: "power3.out" }, 0.18);',
          labelIn(0.15),
          press('#nl', 0.4),
          press('#nr', 0.52),
          'hs.draw("uml", 0.62, 0.45, 1); hs.draw("umr", 0.74, 0.45, 1);',
          'hs.boil(["#ul", "#ur"], 11, 1.1, 0.4, 0);',
          ...stampIn('#vs', 0.62, -10),
          'tl.fromTo("#t1", { xPercent: -50, x: -600, opacity: 0 }, { xPercent: -50, x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, 0.95);',
          'tl.fromTo("#cR", { x: 0 }, { x: 14, duration: 0.06, ease: "sine.inOut", yoyo: true, repeat: 5, immediateRender: false }, 1.35);',
          'tl.fromTo("#t2", { xPercent: -50, x: 600, opacity: 0 }, { xPercent: -50, x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, 1.35);',
          'tl.fromTo("#cL", { x: 0 }, { x: -14, duration: 0.06, ease: "sine.inOut", yoyo: true, repeat: 5, immediateRender: false }, 1.75);',
          typeIn('s', 2.0, spec.sub),
        ],
      };
    }

    // A pie drawn on the page: hatched disc, the share swept in highlighter, an ink loop round it
    // and an arrow from the figure to the wedge.
    case 'ring': {
      const R = 250;
      const cx = 540;
      const cy = 560;
      const C = Math.PI * R; // circumference of the r = R/2 stroke that paints the wedge
      const th = (spec.pct / 100) * Math.PI; // middle of the wedge, clockwise from 12 o'clock
      const tip: [number, number] = [cx + R * 0.72 * Math.sin(th), cy - R * 0.72 * Math.cos(th)];
      const from: [number, number] = [975, 670];
      const ctl: [number, number] = [(from[0] + tip[0]) / 2 + 30, Math.max(from[1], tip[1]) + 90];
      const ang = Math.atan2(tip[1] - ctl[1], tip[0] - ctl[0]);
      const head = (s: number) => `${f2(tip[0] - 34 * Math.cos(ang + s * 0.5))} ${f2(tip[1] - 34 * Math.sin(ang + s * 0.5))}`;
      const loopW = 2 * R + 70;
      const wordsHtml = spec.label.split(/\s+/).filter(Boolean).map((w, i) => `<span id="rl${i}" class="wd">${esc(w)}</span>`).join(' ');
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [760, 540],
        body: `<svg class="full" width="1920" height="1080" viewBox="0 0 1920 1080">${HATCH(c.text)}<circle id="pb" cx="${cx}" cy="${cy}" r="${R}" fill="url(#hatch)"/>` +
          `<circle id="wg" cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="${alpha(c.accentHi, 0.88)}" stroke-width="${R}" stroke-dasharray="${f2(C)} ${f2(C)}" stroke-dashoffset="${f2(C)}" transform="rotate(-90 ${cx} ${cy})"/>` +
          `<line id="rad" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${c.text}" stroke-width="4" stroke-linecap="round"/>` +
          `<g id="lpb"><path id="lp" transform="translate(${cx - loopW / 2} ${cy - loopW / 2})" d="${inkLoop(loopW, loopW, 5)}" fill="none" stroke="${c.text}" stroke-width="6" stroke-linecap="round" opacity="0"/></g>` +
          `<g id="arb"><path id="ar" d="M${f2(from[0])} ${f2(from[1])} Q${f2(ctl[0])} ${f2(ctl[1])} ${f2(tip[0])} ${f2(tip[1])}" fill="none" stroke="${c.accent}" stroke-width="8" stroke-linecap="round" opacity="0"/><path id="ah" d="M${head(1)} L${f2(tip[0])} ${f2(tip[1])} L${head(-1)}" fill="none" stroke="${c.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></g></svg>` +
          `<div class="rc">${label(spec.kicker)}<div class="rn num"><span id="v">0</span><span class="pct">%</span></div><div class="rl disp">${wordsHtml}</div>${typed('s', spec.sub)}</div>`,
        css: `.full{position:absolute;inset:0;overflow:visible}.rc{position:absolute;left:1000px;right:140px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.rn{font-size:230px;line-height:1;margin:34px 0 10px;color:${c.text}}.pct{font-size:120px;color:${c.accent};margin-left:8px}.rl{font-size:66px;line-height:1.12;margin-bottom:36px;color:${c.text}}.wd{display:inline-block}`,
        js: [
          RUNTIME,
          'tl.fromTo("#pb", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.1);',
          'tl.fromTo("#rad", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.3);',
          'hs.draw("lp", 0.1, 0.8, 1); hs.boil("#lpb", 13, 1.4, 0.2, 0);',
          `tl.fromTo("#wg", { attr: { "stroke-dashoffset": ${f2(C)} } }, { attr: { "stroke-dashoffset": ${f2(C * (1 - spec.pct / 100))} }, duration: 1.8, ease: "power2.out" }, 0.4);`,
          countTo('v', 0, spec.pct, decimalsOf(spec.pct), 0.4, 1.8),
          labelIn(0.5),
          ...spec.label.split(/\s+/).filter(Boolean).map((_, i) => press(`#rl${i}`, 0.8 + Math.min(i * 0.08, 0.5))),
          'hs.draw("ar", 2.3, 0.5, 1); hs.draw("ah", 2.75, 0.18, 1); hs.boil("#arb", 17, 1.3, 0.3, 0);',
          typeIn('s', 1.9, spec.sub),
        ],
      };
    }

    // An investigation board: push-pins, red thread sagging between them, paper name tags.
    case 'map': {
      const pinAt = (i: number) => 0.35 + i * 0.3;
      const dxs = spec.points.map((p, i) => spec.links.filter((l) => l.includes(i)).map(([a, b]) => spec.points[a === i ? b : a]!.x - p.x));
      const labelLeft = dxs.map((d) => d.reduce((s, v) => s + v, 0) > 0);
      // Links on both sides: the tag goes above the pin so it can't cover a neighbour.
      const labelUp = dxs.map((d) => d.some((v) => v > 0) && d.some((v) => v < 0));
      const routes = spec.links.map(([a, b], i) => {
        const pa = spec.points[a]!;
        const pb = spec.points[b]!;
        const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        const cx = (pa.x + pb.x) / 2;
        const cy = (pa.y + pb.y) / 2 + len * 0.16; // thread hangs under its own weight
        const P = [[pa.x, pa.y], [pa.x + (2 / 3) * (cx - pa.x), pa.y + (2 / 3) * (cy - pa.y)], [pb.x + (2 / 3) * (cx - pb.x), pb.y + (2 / 3) * (cy - pb.y)], [pb.x, pb.y]];
        const L = polyLength((u) => cubic(P, u));
        return { P, L, start: Math.max(pinAt(a), pinAt(b)) + 0.3 + i * 0.45, i };
      });
      const thread = routes
        .map((r) => `<path id="th${r.i}" d="M${r.P[0]!.join(' ')} C${r.P.slice(1).map((p) => p.join(' ')).join(', ')}" fill="none" stroke="${c.accent}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${f2(r.L)}" stroke-dashoffset="${f2(r.L)}" style="filter:drop-shadow(0 4px 3px rgba(60,30,10,.28))"/>`)
        .join('');
      const pins = spec.points
        .map((p, i) => `<div id="p${i}" class="mpin${p.highlight ? ' hi' : ''}" style="left:${p.x}px;top:${p.y}px"><i class="pushpin"></i></div>`)
        .join('');
      const tags = spec.points
        .map((p, i) => {
          const pos = labelUp[i] ? `left:${p.x}px;bottom:${1080 - p.y + 44}px` : `${labelLeft[i] ? `right:${1920 - p.x + 44}px` : `left:${p.x + 44}px`};top:${p.y - 34}px`;
          return `<div id="pl${i}" class="mtag${p.highlight ? ' hi' : ''}${labelUp[i] ? ' up' : labelLeft[i] ? ' lf' : ''}" style="${pos}"><b>${esc(p.label)}</b>${p.tag ? `<span class="hand">${esc(p.tag)}</span>` : ''}</div>`;
        })
        .join('');
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 520],
        body: `<svg class="full" width="1920" height="1080" viewBox="0 0 1920 1080">${thread}</svg>${tags}${pins}${label(spec.kicker, 'tl-k')}<div class="bl-s">${typed('s', spec.sub)}</div>`,
        css: `.full{position:absolute;inset:0;overflow:visible}.mpin{position:absolute;width:0;height:0}.mpin .pushpin{left:-17px;top:-17px}.mpin.hi .pushpin{left:-24px;top:-24px;width:48px;height:48px}
.mtag{position:absolute;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 22px 12px;background:#fdfcf6;box-shadow:0 8px 18px rgba(52,36,12,.22);white-space:nowrap}.mtag.lf{align-items:flex-end}.mtag.up{align-items:center;translate:-50% 0}
.mtag b{font-family:"${t.fonts.body}";font-weight:700;font-size:34px;line-height:1.15;color:${c.text}}.mtag.hi b{font-family:"${t.fonts.display}";font-weight:400;font-size:50px;text-transform:uppercase}.mtag .hand{font-size:34px;line-height:1}
.bl-s{position:absolute;left:170px;bottom:90px}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          ...spec.points.flatMap((p, i) => [
            `tl.fromTo("#p${i}", { opacity: 0, scale: 1.8, y: -30 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "expo.in" }, ${f2(pinAt(i) - 0.2)});`,
            `tl.fromTo("#pl${i}", { opacity: 0, rotation: ${labelLeft[i] ? 6 : -6}, ${labelUp[i] ? 'y: 20' : `x: ${labelLeft[i] ? 20 : -20}`} }, { opacity: 1, rotation: ${p.highlight ? -1.5 : i % 2 ? 1.2 : -1}, ${labelUp[i] ? 'y: 0' : 'x: 0'}, duration: 0.45, ease: "power3.out" }, ${f2(pinAt(i) + 0.05)});`,
          ]),
          ...routes.map((r) => `tl.fromTo("#th${r.i}", { attr: { "stroke-dashoffset": ${f2(r.L)} } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.9, ease: "power2.inOut" }, ${f2(r.start)});`),
          typeIn('s', 0.6 + spec.points.length * 0.3, spec.sub),
        ],
      };
    }

    // A pile of manila folders: each drops onto the stack with its value sticker; the odd one out
    // gets a highlighter pass and lifts off the pile.
    case 'layers': {
      const tones = spec.items.map((it) => it.tone ?? 'accent');
      const counts = new Map<string, number>();
      tones.forEach((tn) => counts.set(tn, (counts.get(tn) ?? 0) + 1));
      const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const odd = counts.size > 1 ? tones.map((tn, i) => (tn !== majority ? i : -1)).filter((i) => i >= 0) : [];
      const n = spec.items.length;
      const W = hasPrint ? 920 : 1180;
      const rowH = n <= 4 ? 104 : 82;
      const inkOf = (tone?: string) => (tone === 'cyan' ? c.secondary : tone === 'muted' || tone === 'dim' ? c.textLabel : c.accent);
      const rot = (i: number) => f2(hash(i, 31) * 0.8);
      const rows = spec.items
        .map((it, i) => `<div id="ly${i}" class="fo" style="height:${rowH}px"><span class="lyw">${odd.includes(i) ? markSvg(HIGHLIGHT, `lh${i}`, 'hlm', c.accentHi) : ''}<span class="lyl disp">${esc(it.label)}</span></span><span id="lv${i}" class="lv" style="color:${inkOf(it.tone)};border-color:${inkOf(it.tone)}">${esc(it.value)}</span></div>`)
        .join('');
      const end = 0.4 + n * 0.16 + 0.6;
      return {
        ...base,
        focus: [620, 540],
        body: `<div class="col">${label(spec.kicker)}<div class="stack" style="width:${W}px">${rows}</div>${typed('s', spec.sub)}</div>`,
        css: `.stack{display:flex;flex-direction:column;gap:${n <= 4 ? 22 : 16}px;margin:${n <= 4 ? 62 : 50}px 0 44px}
.fo{position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 40px;background:linear-gradient(180deg,#e4cf9e,#d8c08b);box-shadow:0 8px 16px rgba(52,36,12,.24),inset 0 2px 0 rgba(255,255,255,.35)}
.fo::before{content:"";position:absolute;left:28px;top:-18px;width:170px;height:20px;background:#e4cf9e;border-radius:8px 8px 0 0}
.lyw{position:relative;display:inline-block}.lyl{position:relative;z-index:1;font-size:${n <= 4 ? 50 : 40}px;line-height:1;color:${c.text}}.hlm{position:absolute;left:-6%;top:6%;width:112%;height:90%;z-index:0;overflow:visible}
.lv{font-family:"${t.fonts.body}";font-weight:700;font-size:${n <= 4 ? 30 : 24}px;letter-spacing:.14em;text-transform:uppercase;padding:9px 20px 7px;background:#fdfcf6;border:3px solid;line-height:1.1;box-shadow:0 3px 6px rgba(52,36,12,.2)}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          ...spec.items.flatMap((_, i) => [
            `tl.fromTo("#ly${i}", { opacity: 0, y: -70, rotation: ${f2(+rot(i) + (i % 2 ? 3 : -3))} }, { opacity: 1, y: 0, rotation: ${rot(i)}, duration: 0.45, ease: "power3.in" }, ${f2(0.35 + i * 0.16)});`,
            `tl.fromTo("#lv${i}", { opacity: 0, scale: 1.5, rotation: -6 }, { opacity: 1, scale: 1, rotation: 1.5, duration: 0.22, ease: "expo.in" }, ${f2(0.65 + i * 0.16)});`,
          ]),
          ...odd.flatMap((i) => [`hs.draw("lh${i}", ${f2(end)}, 0.5, 0.62);`, `tl.to("#ly${i}", { y: -10, rotation: -1.2, boxShadow: "0 22px 30px rgba(52,36,12,.32)", duration: 0.4, ease: "back.out(2)" }, ${f2(end + 0.1)});`]),
          typeIn('s', end + 0.25, spec.sub),
        ],
      };
    }

    // The value-chain curve drawn in red ink over a hatched area; the ends are ringed by hand and
    // the weak middle gets a highlighter blob and a scribbled loop.
    case 'smile': {
      const P = [[160, 110], [460, 590], [1140, 590], [1440, 110]];
      const L = polyLength((u) => cubic(P, u));
      const [bx, by] = cubic(P, 0.5);
      const d = 'M160 110 C460 590, 1140 590, 1440 110';
      const ring = (id: string, x: number, y: number, seed: number) => `<g id="${id}b"><path id="${id}" transform="translate(${x - 34} ${y - 30})" d="${inkLoop(68, 60, seed)}" fill="none" stroke="${c.text}" stroke-width="5" stroke-linecap="round" opacity="0"/></g>`;
      return {
        ...base,
        layout: 'left',
        print: 'copy',
        focus: [960, 560],
        body: `<div class="col">${label(spec.kicker)}<svg class="sm" width="1560" height="640" viewBox="0 0 1560 640">${HATCH(c.text)}<defs><clipPath id="ac"><rect id="acr" x="0" y="0" width="0" height="640"/></clipPath></defs>` +
          `<path id="axs" d="M80 36 V600 H1520" fill="none" stroke="${c.text}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M66 56 L80 32 L94 56" fill="none" stroke="${c.text}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<text transform="translate(40 330) rotate(-90)" text-anchor="middle" class="ax" font-size="24" letter-spacing="4" fill="${c.textLabel}">GIÁ TRỊ GIA TĂNG</text>` +
          `<path d="${d} L1440 600 L160 600 Z" fill="url(#hatch)" clip-path="url(#ac)"/><circle id="blob" cx="${f2(bx)}" cy="${f2(by)}" r="46" fill="${alpha(c.accentHi, 0.85)}"/>` +
          `<path id="cv" d="${d}" fill="none" stroke="${c.accent}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${f2(L)}" stroke-dashoffset="${f2(L)}"/><circle id="mk" r="9" fill="${c.text}" cx="160" cy="110"/>` +
          `${ring('rL', 160, 110, 2)}${ring('rR', 1440, 110, 4)}<g id="rBb"><path id="rB" transform="translate(${f2(bx - 90)} ${f2(by - 64)})" d="${inkLoop(180, 128, 6)}" fill="none" stroke="${c.accent}" stroke-width="7" stroke-linecap="round" opacity="0"/></g>` +
          `<g id="tL"><text x="210" y="70" class="hw" font-size="50" fill="${c.text}">${esc(spec.left)}</text></g><g id="tR"><text x="1390" y="70" text-anchor="end" class="hw" font-size="50" fill="${c.text}">${esc(spec.right)}</text></g>` +
          `<g id="tB"><text x="${f2(bx)}" y="${f2(by + 110)}" text-anchor="middle" class="hw" font-size="64" fill="${c.accent}">${esc(spec.bottom)}</text></g></svg>${typed('s', spec.sub)}</div>`,
        css: `.sm{overflow:visible;margin:30px 0 24px}.hw{font-family:"${t.fonts.hand ?? t.fonts.body}"}.ax{font-family:"${t.fonts.body}";font-weight:700}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          'hs.draw("rL", 0.35, 0.4, 1); hs.boil("#rLb", 3, 1.2, 0.3, 0);',
          `{ const P = ${JSON.stringify(P)}; const cv = document.getElementById("cv"), mk = document.getElementById("mk"), cr = document.getElementById("acr"); const o = { p: 0 };
tl.fromTo(o, { p: 0 }, { p: 1, duration: 1.8, ease: "power2.inOut", onUpdate: () => { const u = 1 - o.p, w = [u*u*u, 3*u*u*o.p, 3*u*o.p*o.p, o.p*o.p*o.p]; const x = w[0]*P[0][0] + w[1]*P[1][0] + w[2]*P[2][0] + w[3]*P[3][0], y = w[0]*P[0][1] + w[1]*P[1][1] + w[2]*P[2][1] + w[3]*P[3][1]; cv.setAttribute("stroke-dashoffset", ${f2(L)} * (1 - o.p)); mk.setAttribute("cx", x); mk.setAttribute("cy", y); cr.setAttribute("width", x); } }, 0.45); }`,
          'tl.fromTo("#mk", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.45); tl.to("#mk", { opacity: 0, duration: 0.25 }, 2.15);',
          writeIn('#tL', 0.55, 0.5),
          'tl.fromTo("#blob", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.35, ease: "back.out(2)" }, 1.3);',
          writeIn('#tB', 1.4, 0.55),
          'hs.draw("rB", 1.6, 0.6, 1); hs.boil("#rBb", 8, 1.5, 0.35, 0);',
          'hs.draw("rR", 2.2, 0.4, 1); hs.boil("#rRb", 5, 1.2, 0.3, 0);',
          writeIn('#tR', 2.25, 0.5),
          typeIn('s', 2.45, spec.sub),
        ],
      };
    }

    // A chain of paper clips strains, then the middle clip springs open and the chain parts,
    // with red ink strokes marking the break.
    case 'chain': {
      const N = 7;
      const pitch = 190;
      const clipW = 232;
      const x0 = (1560 - (N - 1) * pitch - clipW) / 2;
      const cy = 150;
      const mid = 3;
      const CLIP = 'M34 64 H204 A28 28 0 0 0 204 8 H24 A22 22 0 0 0 24 52 H186 A16 16 0 0 0 186 20 H56';
      const clip = (i: number) => {
        const x = x0 + i * pitch;
        const y = cy - 36 + (i % 2 ? 6 : -6);
        return `<g id="pc${i}" transform="translate(${f2(x)} ${f2(y)}) rotate(${i % 2 ? -2 : 2} 116 36)"><path d="${CLIP}" fill="none" stroke="url(#steel)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="${CLIP}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linecap="round" transform="translate(-1 -2)"/></g>`;
      };
      const bx = x0 + mid * pitch + clipW - 10;
      const marks = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.3;
        const r0 = 34 + (i % 2) * 8;
        const r1 = r0 + 34 + (i % 3) * 10;
        return `<path id="sk${i}" d="M${f2(bx + Math.cos(a) * r0)} ${f2(cy + Math.sin(a) * r0)} L${f2(bx + Math.cos(a) * r1)} ${f2(cy + Math.sin(a) * r1)}" stroke="${c.accent}" stroke-width="7" stroke-linecap="round" opacity="0"/>`;
      }).join('');
      const words = spec.label.split(/\s+/).filter(Boolean);
      const tB = 1.55;
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 470],
        body: `<div class="colc">${label(spec.kicker)}<svg class="ch" width="1560" height="300" viewBox="0 0 1560 300"><defs><linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b6ae"/><stop offset=".5" stop-color="#7c7973"/><stop offset="1" stop-color="#55524d"/></linearGradient></defs>` +
          `<g id="chain" style="filter:drop-shadow(0 6px 4px rgba(52,36,12,.3))"><g id="chL">${Array.from({ length: mid }, (_, i) => clip(i)).join('')}<g id="cm">${clip(mid)}</g></g><g id="chR">${Array.from({ length: N - mid - 1 }, (_, k) => clip(mid + 1 + k)).join('')}</g></g><g id="skb">${marks}</g></svg>` +
          `<div class="cl disp">${words.map((w, i) => `<span id="cw${i}" class="wd">${esc(w)}</span>`).join(' ')}</div>${typed('s', spec.sub)}</div>`,
        css: `.colc{position:absolute;left:180px;right:180px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}.ch{overflow:visible;margin:90px 0 40px}.cl{font-size:76px;line-height:1.1;margin-bottom:30px;color:${c.text}}.wd{display:inline-block}.colc .tw{text-align:left}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          ...Array.from({ length: N }, (_, i) => `tl.fromTo("#pc${i}", { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${f2(0.25 + i * 0.06)});`),
          'tl.fromTo("#chain", { x: -5 }, { x: 5, duration: 0.05, ease: "sine.inOut", yoyo: true, repeat: 7, immediateRender: false }, 1.1);',
          `tl.set("#chain", { x: 0 }, ${f2(tB)});`,
          `tl.fromTo("#cm", { rotation: 0, svgOrigin: "${f2(x0 + mid * pitch + 30)} ${cy}" }, { rotation: 22, svgOrigin: "${f2(x0 + mid * pitch + 30)} ${cy}", duration: 0.5, ease: "back.out(2)" }, ${f2(tB)});`,
          `tl.fromTo("#chL", { x: 0, rotation: 0, svgOrigin: "${f2(bx)} ${cy}" }, { x: -80, rotation: -4, svgOrigin: "${f2(bx)} ${cy}", duration: 0.7, ease: "power3.out" }, ${f2(tB)});`,
          `tl.fromTo("#chR", { x: 0, rotation: 0, svgOrigin: "${f2(bx)} ${cy}" }, { x: 80, rotation: 4, svgOrigin: "${f2(bx)} ${cy}", duration: 0.7, ease: "power3.out" }, ${f2(tB)});`,
          `for (let i = 0; i < 7; i++) hs.draw("sk" + i, ${f2(tB + 0.02)} + i * 0.03, 0.16, 1);`,
          'hs.boil("#skb", 19, 1.6, 0.3, 0);',
          ...words.map((_, i) => press(`#cw${i}`, tB + 0.35 + Math.min(i * 0.08, 0.5))),
          typeIn('s', tB + 0.75, spec.sub),
        ],
      };
    }

    // A dot-matrix printout: the question is typed after the prompt mark, the sheet feeds up on
    // send, then the answer prints word by word behind a block cursor.
    case 'chat': {
      const k = chatTiming(spec, seconds);
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 540],
        body: `<div id="cw" class="feed"><div id="fp" class="fpg"><div class="pq"><b>&gt;</b><span id="cit"></span><i id="crt2" class="caret"></i></div><div class="pa"><span id="crt"></span><i id="ccur" class="ccur"></i></div></div></div>`,
        css: `.feed{position:absolute;left:330px;top:120px;width:1260px;height:840px;overflow:hidden;transform:rotate(-.8deg);background-color:#fbfaf2;background-image:repeating-linear-gradient(180deg,rgba(130,185,140,.18) 0 64px,transparent 64px 128px);box-shadow:0 26px 50px rgba(52,36,12,.3),0 2px 5px rgba(52,36,12,.2)}
.feed::before,.feed::after{content:"";position:absolute;top:0;bottom:0;width:64px;background-image:radial-gradient(circle at 50% 50%,${c.bg} 0 9px,rgba(0,0,0,.18) 10px,transparent 11px);background-size:64px 64px;border-right:2px dashed rgba(0,0,0,.14)}
.feed::before{left:0}.feed::after{right:0;border-right:0;border-left:2px dashed rgba(0,0,0,.14)}
.fpg{position:absolute;left:120px;right:120px;top:84px;font-family:"${t.fonts.body}";color:${c.text}}
.pq{font-weight:700;font-size:46px;line-height:1.35;margin-bottom:54px;white-space:nowrap}.pq b{color:${c.accent};margin-right:24px}
.caret{display:inline-block;width:.55em;height:1em;margin-left:6px;vertical-align:-.12em;background:${c.accent}}
.pa{font-size:40px;line-height:1.55;padding-left:28px;border-left:6px solid ${alpha(c.accent, 0.8)}}.ccur{display:inline-block;width:.55em;height:1em;margin-left:.15em;vertical-align:-.14em;background:${c.text}}`,
        js: [
          'tl.fromTo("#cw", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, 0);',
          'tl.set("#ccur", { opacity: 0 }, 0);',
          `tl.fromTo("#crt2", { opacity: 1 }, { opacity: 0, duration: 0.225, ease: "steps(1)", yoyo: true, repeat: ${Math.max(1, Math.floor((k.send - 0.1) / 0.45)) * 2 - 1} }, 0.1);`,
          `{ const el = document.getElementById("cit"); const s = [...${JSON.stringify(spec.prompt)}]; const o = { n: 0 }; tl.fromTo(o, { n: 0 }, { n: s.length, duration: ${f2(k.type)}, ease: "none", onUpdate: () => { el.textContent = s.slice(0, Math.round(o.n)).join(""); } }, ${f2(k.typeAt)}); }`,
          `tl.set("#crt2", { opacity: 0 }, ${f2(k.send)});`,
          `tl.fromTo("#fp", { y: 0 }, { y: -26, duration: 0.18, ease: "steps(3)" }, ${f2(k.send)});`,
          `tl.set("#ccur", { opacity: 1 }, ${f2(k.streamAt - 0.2)});`,
          `{ const el = document.getElementById("crt"); const w = ${JSON.stringify(k.words)}; const o = { n: 0 }; tl.fromTo(o, { n: 0 }, { n: w.length, duration: ${f2(k.stream)}, ease: "none", onUpdate: () => { el.textContent = w.slice(0, Math.ceil(o.n)).join(" "); } }, ${f2(k.streamAt)}); }`,
          `tl.fromTo("#ccur", { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "steps(1)", yoyo: true, repeat: 7 }, ${f2(k.streamAt + k.stream + 0.1)});`,
        ],
      };
    }

    // Prints dropped one on top of another; each gets its year stamped in red and a handwritten caption.
    case 'montage': {
      const step = spec.step ?? MONTAGE_STEP;
      const n = spec.items.length;
      const prints = spec.items
        .map((it, i) => {
          const x = 330 + hash(i, 41) * 70;
          const y = 90 + hash(i, 43) * 40;
          return `<div id="mo${i}" class="mp" style="left:${f2(x)}px;top:${f2(y)}px"><div class="mpi"><img id="mi${i}" src="m${i}${extOf(it.src)}" alt="" /></div><span class="mpc hand">${esc(it.label)}</span><div class="msw"><div id="ms${i}" class="stamp">${esc(it.year)}</div></div></div>`;
        })
        .join('');
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 540],
        body: prints,
        css: `.mp{position:absolute;width:1260px;height:806px;padding:20px 20px 96px;background:#f8f5ed;box-shadow:0 26px 50px rgba(52,36,12,.34),0 3px 6px rgba(52,36,12,.25);opacity:0}
.mpi{width:100%;height:100%;overflow:hidden;background:#2a2723}.mpi img{width:100%;height:100%;object-fit:cover;filter:sepia(.2) contrast(1.05)}
.mpc{position:absolute;left:30px;bottom:22px;font-size:50px;line-height:1;color:${c.text}}.msw{position:absolute;right:46px;top:44px;font-size:92px}`,
        js: [
          RUNTIME,
          ...spec.items.flatMap((_, i) => {
            const at = i * step;
            const rot = f2(hash(i, 47) * 4.5);
            const hold = i === n - 1 ? Math.max(step, seconds - at) : step + 0.4;
            return [
              `tl.fromTo("#mo${i}", { opacity: 0, scale: 1.14, y: -40, rotation: ${f2(+rot + 5)} }, { opacity: 1, scale: 1, y: 0, rotation: ${rot}, duration: 0.2, ease: "power3.in" }, ${f2(Math.max(0, at - 0.2))});`,
              `tl.fromTo("#mi${i}", { scale: 1.08 }, { scale: 1, duration: ${f2(hold)}, ease: "power2.out" }, ${f2(at)});`,
              `tl.fromTo("#ms${i}", { opacity: 0, scale: 1.7, rotation: -14 }, { opacity: 0.9, scale: 1, rotation: -8, duration: 0.16, ease: "expo.in" }, ${f2(at + 0.08)});`,
            ];
          }),
        ],
      };
    }

    // Two ink lines race along a year axis on taped graph paper; marked years are pencilled in as
    // the lines pass, then the losing line fades.
    case 'duel': {
      const X0 = 200;
      const X1 = 1540;
      const Y0 = 320;
      const Y1 = 800;
      const DRAW = 0.35;
      const DUR = 2.2;
      const xOf = (yr: number) => X0 + ((yr - spec.from) / (spec.to - spec.from)) * (X1 - X0);
      const yOf = (lv: number) => Y1 - Math.min(1, Math.max(0, lv)) * (Y1 - Y0);
      const atX = (x: number) => DRAW + ((x - X0) / (X1 - X0)) * DUR;
      const ends = spec.lines.map((ln) => {
        const [yr, lv] = ln.points.at(-1)!;
        return { x: xOf(yr), y: yOf(lv), col: ln.tone === 'cyan' ? c.secondary : ln.tone === 'muted' || ln.tone === 'dim' ? c.textLabel : c.accent };
      });
      const lines = spec.lines.map((ln, i) => `<path id="dl${i}" d="${smooth(ln.points.map(([yr, lv]) => [xOf(yr), yOf(lv)]))}" pathLength="1" fill="none" stroke="${ends[i]!.col}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/>`).join('');
      const marks = (spec.marks ?? [])
        .map((m, i) => {
          const x = xOf(m.year);
          return `<g id="mk${i}"><line x1="${f2(x)}" y1="${Y0 - 30}" x2="${f2(x)}" y2="${Y1}" stroke="${c.textLabel}" stroke-width="3" stroke-dasharray="12 10"/><text x="${f2(x)}" y="${Y1 + 64}" text-anchor="middle" class="hw" font-size="48" fill="${c.text}">${m.year}</text><text x="${f2(x)}" y="${Y0 - 50}" text-anchor="middle" class="tt" font-size="28" fill="${c.textSub}">${esc(m.label)}</text></g>`;
        })
        .join('');
      const axis = `<line x1="${X0 - 20}" y1="${Y1}" x2="${X1 + 20}" y2="${Y1}" stroke="${c.text}" stroke-width="4" stroke-linecap="round"/><text x="${X0}" y="${Y1 + 64}" class="tt" font-size="32" fill="${c.textLabel}">${spec.from}</text><text x="${X1}" y="${Y1 + 64}" text-anchor="end" class="tt" font-size="32" fill="${c.textLabel}">${spec.to}</text>`;
      const tags = spec.lines.map((ln, i) => `<div id="dt${i}" class="slip" style="left:${f2(Math.min(ends[i]!.x + 34, 1560))}px;top:${f2(ends[i]!.y - 32)}px;border-left-color:${ends[i]!.col}">${esc(ln.label)}</div>`).join('');
      const done = DRAW + DUR;
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 560],
        body: `<div id="gp" class="gpaper dg"><i id="gt0" class="tape" style="left:-40px;top:-18px"></i><i id="gt1" class="tape" style="right:-40px;top:-18px"></i></div><svg class="full" width="1920" height="1080" viewBox="0 0 1920 1080">${axis}${marks}${lines}</svg>${tags}${label(spec.kicker, 'dk')}<div class="ds">${typed('s', spec.sub)}</div>`,
        css: `.full{position:absolute;inset:0;overflow:visible}.dg{left:110px;top:140px;width:1700px;height:820px}.hw{font-family:"${t.fonts.hand ?? t.fonts.body}"}.tt{font-family:"${t.fonts.body}";font-weight:700}
#world .slip{font-size:34px;padding:12px 28px 10px 22px}.dk{position:absolute;left:170px;top:176px}.ds{position:absolute;left:200px;top:900px}`,
        js: [
          RUNTIME,
          'tl.fromTo("#gp", { opacity: 0, y: 50, rotation: -2.5 }, { opacity: 1, y: 0, rotation: -0.5, duration: 0.6, ease: "power3.out" }, 0);',
          tapeIn('#gt0', 0.4, -32),
          tapeIn('#gt1', 0.5, 30),
          labelIn(0.15),
          ...spec.lines.map((_, i) => `tl.fromTo("#dl${i}", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: ${f2(DUR * ((ends[i]!.x - X0) / (X1 - X0)))}, ease: "none" }, ${f2(DRAW)});`),
          ...(spec.marks ?? []).map((m, i) => `tl.fromTo("#mk${i}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${f2(atX(xOf(m.year)) - 0.1)});`),
          ...spec.lines.map((_, i) => `tl.fromTo("#dt${i}", { opacity: 0, x: -30, rotation: -6 }, { opacity: 1, x: 0, rotation: ${i % 2 ? 1.5 : -1.5}, duration: 0.35, ease: "back.out(2)" }, ${f2(atX(ends[i]!.x) + 0.05)});`),
          ...(spec.fade !== undefined ? [`tl.to(["#dl${spec.fade}", "#dt${spec.fade}"], { opacity: 0.28, duration: 0.6, ease: "power2.out" }, ${f2(done + 0.1)});`] : []),
          typeIn('s', done + 0.2, spec.sub),
        ],
      };
    }

    // Words of one sentence cut out and laid in a row; threads arc between them (red to the focus
    // word, pencil otherwise) and the focus word is highlighted and ringed.
    case 'links': {
      const size = spec.words.length <= 6 ? 70 : 58;
      const widths = spec.words.map((w) => [...w].length * size * 0.5 + 60);
      const gapW = 20;
      const total = widths.reduce((a, b) => a + b, 0) + gapW * (spec.words.length - 1);
      const cx: number[] = [];
      let x = (1920 - total) / 2;
      widths.forEach((w) => {
        cx.push(x + w / 2);
        x += w + gapW;
      });
      const rowY = 650;
      const top = rowY - size * 0.9;
      const f = spec.focus;
      const order = spec.links.map((l, i) => ({ l, i, strong: f !== undefined && (l[0] === f || l[1] === f) })).sort((a, b) => Number(a.strong) - Number(b.strong));
      const arcs = order
        .map(({ l: [a, b], i, strong }) => {
          const xa = cx[a]!;
          const xb = cx[b]!;
          const h = 70 + Math.abs(xb - xa) * 0.32;
          return `<path id="ar${i}" d="M${f2(xa)} ${f2(top)} Q${f2((xa + xb) / 2)} ${f2(top - h * 2)} ${f2(xb)} ${f2(top)}" pathLength="1" fill="none" stroke="${strong ? c.accent : c.textLabel}" stroke-width="${strong ? 7 : 4}" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"${strong ? ' style="filter:drop-shadow(0 4px 3px rgba(60,30,10,.25))"' : ''}/>`;
        })
        .join('');
      const slips = spec.words
        .map((w, i) => `<div id="wc${i}" class="ws${i === f ? ' wf' : ''}" style="left:${f2(cx[i]! - widths[i]! / 2)}px;top:${f2(rowY - size * 0.9)}px;width:${f2(widths[i]!)}px;height:${f2(size * 1.8)}px;font-size:${size}px">${esc(w)}</div>`)
        .join('');
      const t0 = 0.3 + spec.words.length * 0.08 + 0.2;
      const stepA = Math.min(0.28, 1.6 / Math.max(1, order.length));
      const fw = f !== undefined ? widths[f]! + 60 : 0;
      const fh = size * 1.8 + 60;
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 520],
        body: `<svg class="full" width="1920" height="1080" viewBox="0 0 1920 1080">${arcs}</svg>${slips}` +
          (f !== undefined ? `<div id="flb" class="ink" style="left:${f2(cx[f]! - fw / 2)}px;top:${f2(rowY - size * 0.9 - 30)}px"><svg width="${f2(fw)}" height="${f2(fh)}" style="overflow:visible"><path id="fl" d="${inkLoop(fw, fh, 9)}" fill="none" stroke="${c.accent}" stroke-width="8" stroke-linecap="round" opacity="0"/></svg></div>` : '') +
          `${label(spec.kicker, 'tl-k')}<div class="bc-s">${typed('s', spec.sub)}</div>`,
        css: `.full{position:absolute;inset:0;overflow:visible}.ws{position:absolute;display:flex;align-items:center;justify-content:center;background:#fdfcf6;box-shadow:0 8px 16px rgba(52,36,12,.22);font-family:"${t.fonts.display}";text-transform:uppercase;line-height:1;color:${c.text}}
#world .wf{background:${c.accentHi}}.bc-s{position:absolute;left:180px;right:180px;bottom:90px;text-align:center}.bc-s .tw{display:inline-block;text-align:left}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          ...spec.words.map((_, i) => `tl.fromTo("#wc${i}", { opacity: 0, y: -50, rotation: ${f2(hash(i, 53) * 8)} }, { opacity: 1, y: 0, rotation: ${f2(hash(i, 59) * 1.8)}, duration: 0.4, ease: "power3.in" }, ${f2(0.3 + i * 0.08)});`),
          ...order.map(({ i }, k) => `tl.fromTo("#ar${i}", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.55, ease: "power2.inOut" }, ${f2(t0 + k * stepA)});`),
          ...(f !== undefined ? [`hs.draw("fl", ${f2(t0 + order.length * stepA)}, 0.55, 1);`, 'hs.boil("#flb", 23, 1.5, 0.3, 0);'] : []),
          typeIn('s', t0 + order.length * stepA + 0.3, spec.sub),
        ],
      };
    }

    default:
      return undefined;
  }
}
