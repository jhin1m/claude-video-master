// Storytelling templates — the formats faceless explainer channels reuse most: top-N countdowns,
// timelines, processes, quotations, press clippings, annotated documents and people.
// Editorial layouts live here; the "Hồ sơ" (dossier) layouts in dossier-story.ts.
//
// Rules taken from the faceless/explainer research (plans/reports/research-261013-…):
// one focus per screen (the rest dims once the point lands), structure first → data → one annotation,
// enter slower than exit, a real document is the main picture and the camera pushes in to the line
// being read. Reveal times come from the *Times() helpers below so both styles land on the same
// beats and the SFX in soundCues() stay valid for either.

import { alpha, esc, f2, kick, kickIn, mask, pop, rise, sub, wheel, type Parts, type SoundCue, type StorySpec } from './templates.ts';
import type { Theme } from './theme.ts';

export const STORY_TEMPLATES = ['rank', 'timeline', 'steps', 'quote', 'headline', 'docmark', 'profile'] as const;
export const isStory = (spec: { template: string }): spec is StorySpec => (STORY_TEMPLATES as readonly string[]).includes(spec.template);

// ── Shared beats (scene-local seconds) ────────────────────────────────────────────────────────────

/** Countdown: the last rank first, one row per step; #1 lands last, then gets its highlight ("crown"). */
export function rankTimes(n: number) {
  const step = Math.min(0.42, 1.7 / n);
  const row = (rank: number) => 0.45 + (n - 1 - rank) * step;
  const crown = row(0) + 0.4;
  return { row, crown, done: crown + 0.5 };
}

/** The axis draws at constant speed for `draw` s; each event appears as the line reaches it. */
export function timelineTimes(n: number) {
  const draw = Math.min(2.0, 0.45 * n + 0.5);
  const ev = (i: number) => 0.3 + (draw * (i + 0.5)) / n;
  const focus = 0.3 + draw + 0.3;
  return { draw, ev, focus, done: focus + 0.45 };
}

/** Steps light up one after another (structure is laid out first, dimmed). */
export function stepsTimes(n: number, active = n - 1) {
  const step = Math.min(0.6, 2.1 / n);
  const lit = (i: number) => 0.95 + i * step;
  return { lit, done: lit(active) + 0.55 };
}

/** Clipping: page lands at 0.1, camera pushes from 1.0, marked words swept from 1.75. */
export const headlineTimes = { pageIn: 0.1, push: 1.0, mark: (k: number) => 1.75 + k * 0.35 };

/** Document: camera push at 0.7 (when zooming), then one mark every 0.5 s. */
export const docmarkTimes = (zoom: boolean) => ({ zoomAt: 0.7, mark: (i: number) => (zoom ? 1.85 : 0.8) + i * 0.5 });

/** Person: life years roll like an odometer, then the dated facts come in one by one. */
export const profileTimes = { roll: { at: 0.75, dur: 1.2 }, fact: (i: number) => 1.5 + i * 0.35 };

/** `*chữ*` → words with the marked groups numbered (group = index of the marked run, -1 = plain). */
export function markedWords(text: string): { word: string; group: number }[] {
  const out: { word: string; group: number }[] = [];
  let g = 0;
  for (const seg of text.split(/(\*[^*]+\*)/)) {
    if (!seg) continue;
    const hl = /^\*[^*]+\*$/.test(seg);
    for (const word of (hl ? seg.slice(1, -1) : seg).split(/\s+/).filter(Boolean)) out.push({ word, group: hl ? g : -1 });
    if (hl) g++;
  }
  return out;
}
export const markCount = (text: string) => (text.match(/\*[^*]+\*/g) ?? []).length;

/** Sound effects of the story templates (same beats in both styles). */
export function storyCues(spec: StorySpec): SoundCue[] {
  const cues: SoundCue[] = [];
  switch (spec.template) {
    case 'rank': {
      const T = rankTimes(spec.items.length);
      spec.items.forEach((_, r) => r > 0 && cues.push({ sfx: 'tick', at: T.row(r), gain: 0.4 }));
      cues.push({ sfx: 'pop', at: T.crown, gain: 0.5 });
      break;
    }
    case 'timeline': {
      const T = timelineTimes(spec.events.length);
      spec.events.forEach((_, i) => cues.push({ sfx: 'tick', at: T.ev(i), gain: 0.35 }));
      if (spec.focus !== undefined) cues.push({ sfx: 'pop', at: T.focus, gain: 0.45 });
      break;
    }
    case 'steps': {
      const T = stepsTimes(spec.steps.length, spec.active);
      for (let i = 0; i <= (spec.active ?? spec.steps.length - 1); i++) cues.push({ sfx: 'tick', at: T.lit(i), gain: 0.4 });
      break;
    }
    case 'headline':
      cues.push({ sfx: 'whoosh', at: headlineTimes.pageIn, gain: 0.35 });
      for (let k = 0; k < markCount(spec.headline); k++) cues.push({ sfx: 'tick', at: headlineTimes.mark(k), gain: 0.35 });
      break;
    case 'docmark': {
      const zoom = spec.zoom !== false;
      const T = docmarkTimes(zoom);
      if (zoom) cues.push({ sfx: 'whoosh', at: T.zoomAt, gain: 0.3 });
      spec.marks.forEach((_, i) => cues.push({ sfx: 'tick', at: T.mark(i), gain: 0.35 }));
      break;
    }
    case 'profile':
      (spec.facts ?? []).forEach((_, i) => cues.push({ sfx: 'tick', at: profileTimes.fact(i), gain: 0.3 }));
      break;
    case 'quote':
      break;
  }
  return cues;
}

/** Structural checks: fail at `cvm graphics` time with the scene id, not as a broken frame. */
export function checkStory(id: string, spec: StorySpec): void {
  const need = (ok: boolean, msg: string) => {
    if (!ok) throw new Error(`${id} (${spec.template}): ${msg}`);
  };
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  switch (spec.template) {
    case 'rank':
      need(Array.isArray(spec.items) && spec.items.length >= 2 && spec.items.length <= 6, 'items cần 2–6 mục (items[0] = hạng 1)');
      need(spec.items.every((it) => str(it.label)), 'mỗi item cần label');
      break;
    case 'timeline':
      need(Array.isArray(spec.events) && spec.events.length >= 2 && spec.events.length <= 6, 'events cần 2–6 mốc');
      need(spec.events.every((e) => str(e.year) && str(e.label)), 'mỗi event cần year + label');
      need(spec.focus === undefined || (Number.isInteger(spec.focus) && spec.focus >= 0 && spec.focus < spec.events.length), 'focus ngoài khoảng');
      break;
    case 'steps':
      need(Array.isArray(spec.steps) && spec.steps.length >= 2 && spec.steps.length <= 5, 'steps cần 2–5 bước');
      need(spec.steps.every((s) => str(s.title)), 'mỗi bước cần title');
      need(spec.active === undefined || (Number.isInteger(spec.active) && spec.active >= 0 && spec.active < spec.steps.length), 'active ngoài khoảng');
      break;
    case 'quote':
      need(str(spec.quote) && str(spec.author), 'cần quote + author');
      break;
    case 'headline':
      need(str(spec.paper) && str(spec.date) && str(spec.headline), 'cần paper + date + headline');
      break;
    case 'docmark':
      need(str(spec.src), 'cần src (ảnh tài liệu trong project)');
      need(Array.isArray(spec.marks) && spec.marks.length >= 1 && spec.marks.length <= 4, 'marks cần 1–4 đánh dấu');
      need(spec.marks.every((m) => m.side === undefined || ['right', 'above', 'below'].includes(m.side)), 'side = right | above | below');
      need(spec.marks.every((m) => Array.isArray(m.box) && m.box.length === 4 && m.box.every((v) => v >= 0 && v <= 1) && m.box[2] > 0 && m.box[3] > 0 && m.box[0] + m.box[2] <= 1.001 && m.box[1] + m.box[3] <= 1.001), 'box = [x, y, w, h] theo tỉ lệ 0–1 của ảnh, nằm trong ảnh');
      break;
    case 'profile':
      need(str(spec.photo) && str(spec.name) && str(spec.years) && str(spec.role), 'cần photo + name + years + role');
      need((spec.facts ?? []).length <= 3, 'facts tối đa 3');
      break;
  }
}

/**
 * Where a mark's note goes (CSS position in frame px, before the camera zoom): right of the mark when
 * it still fits on screen once zoomed in, otherwise above (or below, at the top edge of the page).
 */
export function notePlace(m: { x: number; y: number; w: number; h: number }, D: { top: number; cam: { x: number; k: number } }, chars: number, side?: 'right' | 'above' | 'below'): string {
  const k = D.cam.k;
  const gap = 18 / k;
  const width = (chars * 17 + 60) / k; // ~30 px bold at final size
  const right = `left:${f2(m.x + m.w + gap)}px;top:${f2(m.y + m.h / 2)}px;transform:translateY(-50%)`;
  const above = `left:${f2(m.x)}px;top:${f2(m.y - 14 / k)}px;transform:translateY(-100%)`;
  const below = `left:${f2(m.x)}px;top:${f2(m.y + m.h + 14 / k)}px`;
  if (side) return { right, above, below }[side];
  if (D.cam.x + (m.x + m.w + gap + width) * k < 1880) return right;
  return m.y - 70 / k > D.top ? above : below;
}

/** Document placement shared by both styles: the still fitted in a box, marks in frame pixels. */
export function docLayout(spec: Extract<StorySpec, { template: 'docmark' }>, box: { x: number; y: number; w: number; h: number }, maxZoom = 2.4) {
  if (!spec.size) throw new Error('docmark: thiếu size [w, h] của ảnh (cvm graphics tự điền bằng ffprobe)');
  const [iw, ih] = spec.size;
  const k0 = Math.min(box.w / iw, box.h / ih);
  const dw = iw * k0;
  const dh = ih * k0;
  const left = box.x + (box.w - dw) / 2;
  const top = box.y + (box.h - dh) / 2;
  const marks = spec.marks.map((m) => ({ ...m, x: left + m.box[0] * dw, y: top + m.box[1] * dh, w: m.box[2] * dw, h: m.box[3] * dh }));
  const x0 = Math.min(...marks.map((m) => m.x));
  const y0 = Math.min(...marks.map((m) => m.y));
  const x1 = Math.max(...marks.map((m) => m.x + m.w));
  const y1 = Math.max(...marks.map((m) => m.y + m.h));
  const uw = (x1 - x0) * 1.5 + 80;
  const uh = (y1 - y0) * 1.5 + 160; // room for the notes above/below the marks
  const k = spec.zoom === false ? 1 : Math.max(1, Math.min(maxZoom, 1560 / uw, 800 / uh));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  // Camera transform (origin 0 0) that brings the marks' centre to the frame centre at zoom k.
  const cam = { x: 960 - cx * k, y: 560 - cy * k, k };
  return { left, top, dw, dh, marks, cam };
}

// ── Editorial layouts ─────────────────────────────────────────────────────────────────────────────

export function buildStory(spec: StorySpec, t: Theme, seconds: number): Parts {
  const c = t.colors;
  const ACC = c.accent;
  const flat = '-webkit-text-stroke:0;text-shadow:none'; // text set on light/filled surfaces

  switch (spec.template) {
    // A ranked list, #1 on top. Rows arrive from the bottom (countdown); #1 lands last, a lit bar
    // sweeps behind it, its number punches, and the other rows step back.
    case 'rank': {
      const n = spec.items.length;
      const T = rankTimes(n);
      const rowH = n <= 3 ? 128 : n <= 5 ? 104 : 86;
      const fs = n <= 3 ? 62 : n <= 5 ? 52 : 44;
      const rows = spec.items
        .map((it, i) => `<div id="rr${i}" class="rr"><i class="rb"></i>${i === 0 ? '<i id="rc" class="rc"></i>' : ''}<b id="rn${i}" class="rn num">#${i + 1}</b><span class="rl disp">${esc(it.label)}</span>${it.value ? `<span id="rv${i}" class="rv num">${esc(it.value)}</span>` : ''}</div>`)
        .join('');
      return {
        focus: [760, 420],
        layout: 'left',
        body: `<div class="col">${kick(spec.kicker)}<div class="rk">${rows}</div>${sub(spec.sub)}</div>`,
        css: `.rk{width:1340px;display:flex;flex-direction:column;gap:14px;margin:46px 0 44px}
.rr{position:relative;display:flex;align-items:center;gap:34px;height:${rowH}px;padding-right:34px}
.rb,.rc{position:absolute;left:-24px;right:0;top:0;bottom:0;border-radius:14px;transform-origin:left center}.rb{background:rgba(255,255,255,.05)}
.rc{background:linear-gradient(90deg,${alpha(ACC, 0.42)},${alpha(ACC, 0.06)});box-shadow:inset 8px 0 0 ${ACC},0 0 50px ${c.glow}}
.rn{position:relative;flex:none;width:${Math.round(rowH * 1.3)}px;font-size:${Math.round(rowH * 0.62)}px;line-height:1;color:${c.textLabel};text-align:right;transform-origin:100% 60%}
.rl{position:relative;flex:1;min-width:0;font-size:${fs}px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:.12em 0}
.rv{position:relative;flex:none;font-size:${Math.round(fs * 0.9)}px;color:${c.textSub};white-space:nowrap}`,
        js: [
          ...kickIn(0.1),
          ...spec.items.flatMap((it, i) => {
            const at = T.row(i);
            return [
              `tl.fromTo("#rr${i}", { opacity: 0, x: -70 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, ${f2(at)});`,
              `tl.fromTo("#rn${i}", { scale: 0.5 }, { scale: 1, duration: 0.5, ease: "back.out(2.4)" }, ${f2(at + 0.05)});`,
              ...(it.value ? [`tl.fromTo("#rv${i}", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, ${f2(at + 0.18)});`] : []),
            ];
          }),
          `tl.fromTo("#rc", { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power3.inOut" }, ${f2(T.crown)});`,
          `tl.fromTo("#rn0", { color: "${c.textLabel}" }, { color: "${ACC}", duration: 0.3 }, ${f2(T.crown)});`,
          `tl.to("#rn0", { scale: 1.25, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1 }, ${f2(T.crown + 0.3)});`,
          ...(n > 1 ? [`tl.to([${spec.items.slice(1).map((_, i) => `"#rr${i + 1}"`).join(', ')}], { opacity: 0.5, duration: 0.45, ease: "power2.out" }, ${f2(T.crown + 0.1)});`] : []),
          rise('#s', T.done),
        ],
      };
    }

    // One axis across the frame: the line draws at constant speed with a bright tip, each event
    // (alternately above/below) arrives as the tip passes; the focus event swells, the rest dim.
    case 'timeline': {
      const n = spec.events.length;
      const T = timelineTimes(n);
      const X0 = 180;
      const W = 1560;
      const Y = 590;
      const slot = W / n;
      const xs = spec.events.map((_, i) => X0 + (i + 0.5) * slot);
      const f = spec.focus;
      const ys = n <= 4 ? 76 : 62;
      const ls = n <= 4 ? 38 : 32;
      const evs = spec.events
        .map((e, i) => {
          const up = i % 2 === 0;
          const pos = up ? `bottom:${1080 - Y + 46}px` : `top:${Y + 46}px`;
          return `<div id="ev${i}" class="ev ${up ? 'up' : 'dn'}${i === f ? ' fo' : ''}" style="left:${f2(xs[i]! - slot * 0.92)}px;width:${f2(slot * 1.84)}px;${pos}"><b id="ey${i}" class="ey num">${esc(e.year)}</b><span class="el">${esc(e.label)}</span></div>`;
        })
        .join('');
      const dots = xs
        .map((x, i) => `<g id="ed${i}"><line x1="${f2(x)}" y1="${i % 2 === 0 ? Y - 20 : Y + 20}" x2="${f2(x)}" y2="${i % 2 === 0 ? Y - 44 : Y + 44}" stroke="${c.line}" stroke-width="4" stroke-linecap="round"/><circle id="ec${i}" cx="${f2(x)}" cy="${Y}" r="18" fill="${c.bg}" stroke="${ACC}" stroke-width="7"/></g>`)
        .join('');
      const fx = f !== undefined ? xs[f]! : 960;
      return {
        focus: [fx, Y],
        layout: 'center',
        body: `<svg class="tsv" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><linearGradient id="tg" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${X0 + W}" y2="0"><stop offset="0" stop-color="${c.line}"/><stop offset="1" stop-color="${ACC}"/></linearGradient></defs>` +
          `<line id="ax" x1="${X0}" y1="${Y}" x2="${X0 + W}" y2="${Y}" pathLength="1" stroke="url(#tg)" stroke-width="7" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/>` +
          `${f !== undefined ? `<circle id="fp" cx="${f2(fx)}" cy="${Y}" r="18" fill="none" stroke="${ACC}" stroke-width="4" opacity="0"/>` : ''}${dots}<circle id="tp" cx="${X0}" cy="${Y}" r="11" fill="${c.accentHi}" style="filter:drop-shadow(0 0 14px ${c.accentHi})"/></svg>` +
          `${evs}${kick(spec.kicker, 'tl-k')}${sub(spec.sub, 'bl-s')}`,
        css: `.tsv{position:absolute;inset:0;overflow:visible}.ev{position:absolute;display:flex;align-items:center;text-align:center;gap:12px}.ev.up{flex-direction:column-reverse}.ev.dn{flex-direction:column}
.ey{font-size:${ys}px;line-height:1;color:${c.text};transform-origin:50% 50%}.el{font-size:${ls}px;line-height:1.25;color:${c.textSub};max-width:100%}
.tl-k{position:absolute;left:180px;top:110px}.bl-s{position:absolute;left:180px;right:180px;bottom:84px;max-width:none}`,
        js: [
          ...kickIn(0.1),
          `tl.fromTo("#ax", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: ${f2(T.draw)}, ease: "none" }, 0.3);`,
          `tl.fromTo("#tp", { attr: { cx: ${X0} }, opacity: 1 }, { attr: { cx: ${X0 + W} }, duration: ${f2(T.draw)}, ease: "none" }, 0.3);`,
          `tl.to("#tp", { opacity: 0, duration: 0.25 }, ${f2(0.3 + T.draw)});`,
          ...spec.events.flatMap((_, i) => [
            `tl.fromTo("#ed${i}", { opacity: 0, scale: 0.2, svgOrigin: "${f2(xs[i]!)} ${Y}" }, { opacity: 1, scale: 1, svgOrigin: "${f2(xs[i]!)} ${Y}", duration: 0.45, ease: "back.out(2.6)" }, ${f2(T.ev(i))});`,
            `tl.fromTo("#ev${i}", { opacity: 0, y: ${i % 2 === 0 ? 26 : -26} }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${f2(T.ev(i) + 0.05)});`,
          ]),
          ...(f !== undefined
            ? [
                `tl.to([${spec.events.map((_, i) => i).filter((i) => i !== f).flatMap((i) => [`"#ev${i}"`, `"#ed${i}"`]).join(', ')}], { opacity: 0.42, duration: 0.45, ease: "power2.out" }, ${f2(T.focus)});`,
                `tl.to("#ec${f}", { attr: { fill: "${ACC}" }, scale: 1.5, svgOrigin: "${f2(fx)} ${Y}", duration: 0.4, ease: "back.out(2.4)" }, ${f2(T.focus)});`,
                `tl.to("#ey${f}", { color: "${c.accentHi}", scale: 1.16, duration: 0.4, ease: "back.out(2)" }, ${f2(T.focus)});`,
                ...[0, 0.8].map((d) => `tl.fromTo("#fp", { scale: 1, opacity: 0.9, svgOrigin: "${f2(fx)} ${Y}" }, { scale: 3.2, opacity: 0, svgOrigin: "${f2(fx)} ${Y}", duration: 1.1, ease: "power2.out", immediateRender: false }, ${f2(T.focus + 0.15 + d)});`),
              ]
            : []),
          rise('#s', T.done),
        ],
      };
    }

    // A row of numbered nodes on a track. The whole process is laid out dim first; then each step
    // lights in turn, the track fills up to it and the step before becomes a tick.
    case 'steps': {
      const n = spec.steps.length;
      const active = spec.active ?? n - 1;
      const T = stepsTimes(n, active);
      const X0 = 180;
      const W = 1560;
      const Y = 470;
      const R = 50;
      const slot = W / n;
      const xs = spec.steps.map((_, i) => X0 + (i + 0.5) * slot);
      const ts = n <= 3 ? 60 : n === 4 ? 52 : 44;
      const tracks = xs
        .slice(1)
        .map((x, i) => `<i class="sk" style="left:${f2(xs[i]! + R + 14)}px;width:${f2(x - xs[i]! - 2 * R - 28)}px;top:${Y - 3}px"><i id="sf${i}" class="sf"></i></i>`)
        .join('');
      const nodes = spec.steps
        .map((s, i) => `<div id="sn${i}" class="sn" style="left:${f2(xs[i]! - R)}px;top:${Y - R}px"><span id="sx${i}" class="sx num">${i + 1}</span><svg class="sc" viewBox="0 0 40 40"><path id="sv${i}" d="M9 21 L17 29 L31 12" pathLength="1" fill="none" stroke="${c.onAccent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/></svg></div>` +
          `<div id="st${i}" class="st" style="left:${f2(xs[i]! - slot / 2 + 16)}px;width:${f2(slot - 32)}px;top:${Y + R + 40}px"><b class="disp">${esc(s.title)}</b>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}</div>`)
        .join('');
      const dimText = 0.38;
      return {
        focus: [xs[active]!, Y + 120],
        layout: 'center',
        body: `${tracks}${nodes}${kick(spec.kicker, 'tl-k')}${sub(spec.sub, 'bl-s')}`,
        css: `.sk{position:absolute;height:6px;border-radius:3px;background:${alpha(c.line, 0.55)}}.sf{position:absolute;inset:0;border-radius:3px;background:${ACC};transform-origin:left center;transform:scaleX(0)}
.sn{position:absolute;width:${2 * R}px;height:${2 * R}px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 5px ${c.line};background:${alpha(c.bg, 0.6)}}
#world .sn,#world .sn *{${flat}}.sx{font-size:50px;line-height:1;color:${c.textLabel}}.sc{position:absolute;left:24px;top:24px;width:52px;height:52px;overflow:visible}
.st{position:absolute;display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;opacity:${dimText}}.st b{font-size:${ts}px;line-height:1.1}.st span{font-size:${n <= 3 ? 36 : 31}px;line-height:1.35;color:${c.textSub}}
.tl-k{position:absolute;left:180px;top:110px}.bl-s{position:absolute;left:180px;right:180px;bottom:84px;max-width:none}`,
        js: [
          ...kickIn(0.1),
          ...spec.steps.flatMap((_, i) => [
            `tl.fromTo("#sn${i}", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }, ${f2(0.25 + i * 0.08)});`,
            `tl.fromTo("#st${i}", { opacity: 0, y: 24 }, { opacity: ${dimText}, y: 0, duration: 0.5, ease: "power3.out" }, ${f2(0.35 + i * 0.08)});`,
          ]),
          ...spec.steps.slice(0, active + 1).flatMap((_, i) => {
            const at = T.lit(i);
            return [
              ...(i > 0
                ? [
                    `tl.to("#sf${i - 1}", { scaleX: 1, duration: 0.35, ease: "power2.inOut" }, ${f2(at - 0.35)});`,
                    `tl.to("#sn${i - 1}", { backgroundColor: "${alpha(ACC, 0.55)}", boxShadow: "inset 0 0 0 5px ${alpha(ACC, 0)}, 0 0 0px ${alpha(ACC, 0)}", duration: 0.3 }, ${f2(at)});`,
                    `tl.to("#sx${i - 1}", { opacity: 0, duration: 0.15 }, ${f2(at)});`,
                    `tl.to("#sv${i - 1}", { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "power2.out" }, ${f2(at + 0.05)});`,
                    `tl.to("#st${i - 1}", { opacity: 0.7, duration: 0.3 }, ${f2(at)});`,
                  ]
                : []),
              `tl.fromTo("#sn${i}", { backgroundColor: "${alpha(c.bg, 0.6)}", boxShadow: "inset 0 0 0 5px ${c.line}, 0 0 0px ${alpha(ACC, 0)}" }, { backgroundColor: "${ACC}", boxShadow: "inset 0 0 0 5px ${alpha(ACC, 0)}, 0 0 46px ${c.glow}", duration: 0.3, immediateRender: false }, ${f2(at)});`,
              `tl.to("#sx${i}", { color: "${c.onAccent}", duration: 0.2 }, ${f2(at)});`,
              `tl.to("#sn${i}", { scale: 1.16, duration: 0.15, ease: "power2.out", yoyo: true, repeat: 1 }, ${f2(at)});`,
              `tl.to("#st${i}", { opacity: 1, duration: 0.3 }, ${f2(at)});`,
            ];
          }),
          rise('#s', T.done),
        ],
      };
    }

    // The quotation itself is the picture: a giant quote mark, words rising out of masks, the
    // *marked* phrase on an accent marker, then a rule and the speaker; a ringed portrait if given.
    case 'quote': {
      const words = markedWords(spec.quote);
      const photo = !!spec.photo;
      const L = [...spec.quote.replace(/\*/g, '')].length;
      const size = (photo ? [84, 70, 58, 48] : [104, 86, 70, 58])[L <= 50 ? 0 : L <= 90 ? 1 : L <= 150 ? 2 : 3]!;
      let html = '';
      for (let i = 0; i < words.length; ) {
        const g = words[i]!.group;
        if (g < 0) {
          html += `${html ? ' ' : ''}${mask(`w${i}`, esc(words[i]!.word))}`;
          i++;
          continue;
        }
        const run: string[] = [];
        for (; words[i]?.group === g; i++) run.push(mask(`w${i}`, esc(words[i]!.word)));
        html += `${html ? ' ' : ''}<span class="qh"><i class="qhb"></i>${run.join(' ')}</span>`;
      }
      const step = Math.min(0.05, 1.1 / words.length);
      const done = 0.4 + step * words.length + 0.4;
      const x0 = photo ? 760 : 180;
      const ext = spec.photo ? spec.photo.slice(spec.photo.lastIndexOf('.')).toLowerCase() : '';
      return {
        focus: photo ? [960, 520] : [760, 520],
        layout: photo ? 'center' : 'left',
        body: (photo
          ? `<div id="qp" class="qp"><img src="photo${ext}" alt="" /></div><svg class="qrg" width="560" height="560" viewBox="0 0 560 560"><circle id="qring" cx="280" cy="280" r="252" pathLength="1" fill="none" stroke="${ACC}" stroke-width="8" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-90 280 280)"/></svg>`
          : '') +
          `<div class="qc" style="left:${x0}px"><div id="qm" class="qm disp">“</div><div class="qt disp" style="font-size:${size}px">${html}</div>` +
          `<div class="qa"><i id="qr" class="qr"></i><div class="qai"><b class="disp">${mask('qn', esc(spec.author))}</b>${spec.role ? `<span>${mask('qo', esc(spec.role))}</span>` : ''}</div></div></div>`,
        css: `.qc{position:absolute;right:180px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.qm{font-size:300px;line-height:.62;height:150px;color:${ACC};margin:0 0 10px -12px;transform-origin:30% 60%}
.qt{position:relative;z-index:0;line-height:1.14;letter-spacing:-.01em;margin-bottom:48px}.qh{position:relative;display:inline-block}#world .qh .mi{${flat}}.qhb{position:absolute;left:-.08em;right:-.08em;top:.04em;bottom:-.02em;background:${ACC};border-radius:.06em;z-index:-1;transform-origin:left center;transform:scaleX(0)}
.qa{display:flex;align-items:center;gap:26px}.qr{display:block;width:90px;height:6px;border-radius:3px;background:${ACC};transform-origin:left center}.qai{display:flex;flex-direction:column;gap:6px}.qai b{font-size:46px;line-height:1.1;color:${c.accentHi}}.qai span{font-size:32px;color:${c.textSub}}
.qp{position:absolute;left:200px;top:280px;width:500px;height:500px;border-radius:50%;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5)}.qp img{width:100%;height:100%;object-fit:cover;filter:grayscale(.3) contrast(1.05)}.qrg{position:absolute;left:170px;top:250px;overflow:visible}`,
        js: [
          `tl.fromTo("#qm", { opacity: 0, scale: 0.5, rotation: -12 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.6, ease: "back.out(2)" }, 0.1);`,
          ...(photo
            ? [
                'tl.fromTo("#qp", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power3.out" }, 0.15);',
                `tl.fromTo("#qp img", { scale: 1.15 }, { scale: 1, duration: ${f2(seconds)}, ease: "none" }, 0);`,
                'tl.fromTo("#qring", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 1.1, ease: "power2.inOut" }, 0.3);',
              ]
            : []),
          ...words.map((_, i) => rise(`#w${i}`, 0.4 + i * step, 0.8)),
          ...(words.some((w) => w.group >= 0)
            ? [`tl.fromTo(".qhb", { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: "power3.inOut" }, ${f2(done - 0.15)});`, `tl.fromTo(".qh .mi", { color: "${c.text}" }, { color: "${c.onAccent}", duration: 0.3, immediateRender: false }, ${f2(done)});`]
            : []),
          `tl.fromTo("#qr", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, ${f2(done + 0.15)});`,
          rise('#qn', done + 0.25),
          ...(spec.role ? [rise('#qo', done + 0.4)] : []),
        ],
      };
    }

    // A newspaper page (light paper, ink type) flies up into frame and settles; the camera pushes in
    // to the headline and the marked words are swept with the accent, one after another.
    case 'headline': {
      const words = markedWords(spec.headline);
      const L = [...spec.headline.replace(/\*/g, '')].length;
      const size = L <= 36 ? 104 : L <= 60 ? 86 : L <= 90 ? 72 : 60;
      let html = '';
      for (let i = 0; i < words.length; ) {
        const g = words[i]!.group;
        if (g < 0) {
          html += `${html ? ' ' : ''}${esc(words[i]!.word)}`;
          i++;
          continue;
        }
        const run: string[] = [];
        for (; words[i]?.group === g; i++) run.push(esc(words[i]!.word));
        html += `${html ? ' ' : ''}<span class="hh"><i id="hb${g}" class="hhb"></i>${run.join(' ')}</span>`;
      }
      // Body copy as grey line blocks: the article's shape, never invented words.
      const lines = (col: number) => Array.from({ length: 9 }, (_, i) => `<i style="width:${90 - ((col * 7 + i * 13) % 5) * 6}%"></i>`).join('');
      const ink = c.bg;
      return {
        focus: [960, 430],
        layout: 'center',
        body: `<div id="pw" class="pw"><div id="pg" class="np"><div class="nm disp">${esc(spec.paper)}</div><div class="nd">${esc(spec.date)}</div>` +
          `<div class="nh disp" style="font-size:${size}px">${html}</div>${spec.deck ? `<div class="nk">${esc(spec.deck)}</div>` : ''}` +
          `<div class="nb">${[0, 1, 2].map((k) => `<div>${lines(k)}</div>`).join('')}</div></div></div>` +
          (spec.kicker ? `<div class="hk">${kick(spec.kicker)}</div>` : ''),
        css: `.pw{position:absolute;inset:0;transform-origin:960px 420px}
.np{position:absolute;left:330px;top:120px;width:1260px;height:900px;padding:44px 64px 0;background:${c.text};color:${ink};box-shadow:0 40px 120px rgba(0,0,0,.55);overflow:hidden;-webkit-mask-image:linear-gradient(180deg,#000 72%,transparent 100%);mask-image:linear-gradient(180deg,#000 72%,transparent 100%)}
#world .np,#world .np *{${flat}}
.nm{font-size:76px;line-height:1;text-align:center;letter-spacing:.02em;padding-bottom:16px;border-bottom:6px double ${alpha(ink, 0.8)}}
.nd{font-size:22px;font-weight:700;letter-spacing:4px;text-transform:uppercase;text-align:center;padding:12px 0;border-bottom:2px solid ${alpha(ink, 0.5)};color:${alpha(ink, 0.75)}}
.nh{line-height:1.04;text-align:center;margin:34px 0 22px;letter-spacing:-.01em}.hh{position:relative;display:inline-block;z-index:0}.hhb{position:absolute;left:-.06em;right:-.06em;top:.08em;bottom:.02em;background:${alpha(ACC, 0.85)};z-index:-1;transform-origin:left center;transform:scaleX(0)}
.nk{font-size:32px;line-height:1.35;text-align:center;color:${alpha(ink, 0.72)};padding:0 40px 26px;border-bottom:2px solid ${alpha(ink, 0.3)}}
.nb{display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;padding-top:28px}.nb div{display:flex;flex-direction:column;gap:16px}.nb i{display:block;height:13px;border-radius:7px;background:${alpha(ink, 0.13)}}
.hk{position:absolute;left:120px;top:60px;padding:16px 26px;background:${c.panel};border-radius:10px}`,
        js: [
          `tl.fromTo("#pg", { opacity: 0, y: 460, rotation: -9, scale: 0.86 }, { opacity: 1, y: 0, rotation: -1.6, scale: 1, duration: 0.85, ease: "power3.out" }, ${f2(headlineTimes.pageIn)});`,
          ...(spec.kicker ? kickIn(0.6) : []),
          `tl.fromTo("#pw", { scale: 1 }, { scale: 1.17, duration: 1.3, ease: "sine.inOut" }, ${f2(headlineTimes.push)});`,
          ...Array.from({ length: markCount(spec.headline) }, (_, k) => `tl.to("#hb${k}", { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, ${f2(headlineTimes.mark(k))});`),
        ],
      };
    }

    // A real document fills the frame; the camera pushes in to the marked passage and the marks are
    // drawn one by one (accent highlighter, circle, underline, redaction), each with an optional note.
    case 'docmark': {
      const zoom = spec.zoom !== false;
      const T = docmarkTimes(zoom);
      const D = docLayout(spec, { x: 180, y: 150, w: 1560, h: 820 });
      const k = D.cam.k;
      const ext = spec.src.slice(spec.src.lastIndexOf('.')).toLowerCase();
      const marks = D.marks
        .map((m, i) => {
          const type = m.type ?? 'highlight';
          const box = `left:${f2(m.x)}px;top:${f2(m.y)}px;width:${f2(m.w)}px;height:${f2(m.h)}px`;
          const shape =
            type === 'circle'
              ? `<svg class="mc" style="left:${f2(m.x - 18)}px;top:${f2(m.y - 18)}px" width="${f2(m.w + 36)}" height="${f2(m.h + 36)}"><ellipse id="mk${i}" cx="${f2(m.w / 2 + 18)}" cy="${f2(m.h / 2 + 18)}" rx="${f2(m.w / 2 + 14)}" ry="${f2(m.h / 2 + 14)}" pathLength="1" fill="none" stroke="${ACC}" stroke-width="${f2(6 / k)}" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-8 ${f2(m.w / 2 + 18)} ${f2(m.h / 2 + 18)})"/></svg>`
              : type === 'underline'
                ? `<i id="mk${i}" class="mu" style="left:${f2(m.x)}px;top:${f2(m.y + m.h)}px;width:${f2(m.w)}px;height:${f2(Math.max(3, 7 / k))}px"></i>`
                : `<i id="mk${i}" class="${type === 'redact' ? 'mr' : 'mh'}" style="${box}"></i>`;
          const note = m.note ? `<div id="mn${i}" class="mn" style="${notePlace(type === 'circle' ? { x: m.x - 20, y: m.y - 20, w: m.w + 40, h: m.h + 40 } : m, D, [...m.note].length, m.side)};font-size:${f2(30 / k)}px;padding:${f2(8 / k)}px ${f2(18 / k)}px;border-left-width:${f2(6 / k)}px"><span>${esc(m.note)}</span></div>` : '';
          return shape + note;
        })
        .join('');
      return {
        focus: [960, 560],
        layout: 'center',
        body: `<div id="cam" class="dcam"><div id="dd" class="dd" style="left:${f2(D.left)}px;top:${f2(D.top)}px;width:${f2(D.dw)}px;height:${f2(D.dh)}px"><img src="doc${ext}" alt="" /></div>${marks}</div>` +
          (spec.kicker ? `<div class="dk">${kick(spec.kicker)}</div>` : '') +
          (spec.sub ? `<div class="ds">${sub(spec.sub)}</div>` : ''),
        css: `.dcam{position:absolute;inset:0;transform-origin:0 0}.dd{position:absolute;box-shadow:0 30px 90px rgba(0,0,0,.6)}.dd img{width:100%;height:100%;display:block}
.mh,.mr,.mu{position:absolute;transform-origin:left center;transform:scaleX(0)}.mh{background:${alpha(c.accentHi, 0.6)};mix-blend-mode:multiply;border-radius:3px}.mr{background:${c.bg}}.mu{background:${ACC};border-radius:4px}
.mc{position:absolute;overflow:visible}.mn{position:absolute;white-space:nowrap;background:${c.panel};border-left:solid ${ACC};border-radius:4px;color:${c.text};font-weight:700;line-height:1.2}
#world .mn,#world .mn *{${flat}}.dk{position:absolute;left:120px;top:60px;padding:16px 26px;background:${c.panel};border-radius:10px}.ds{position:absolute;left:120px;bottom:50px;padding:14px 26px;background:${c.panel};border-radius:10px;max-width:1400px}`,
        js: [
          'tl.fromTo("#dd", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0);',
          ...(spec.kicker ? kickIn(0.2) : []),
          ...(zoom ? [`tl.fromTo("#cam", { x: 0, y: 0, scale: 1 }, { x: ${f2(D.cam.x)}, y: ${f2(D.cam.y)}, scale: ${D.cam.k.toFixed(4)}, duration: 1.2, ease: "power2.inOut" }, ${f2(T.zoomAt)});`] : []),
          ...D.marks.flatMap((m, i) => {
            const at = T.mark(i);
            return [
              (m.type ?? 'highlight') === 'circle'
                ? `tl.to("#mk${i}", { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.inOut" }, ${f2(at)});`
                : `tl.to("#mk${i}", { scaleX: 1, duration: 0.45, ease: "power2.inOut" }, ${f2(at)});`,
              ...(m.note ? [`tl.fromTo("#mn${i}", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" }, ${f2(at + 0.3)});`] : []),
            ];
          }),
          ...(spec.sub ? [rise('#s', T.mark(D.marks.length - 1) + 0.6)] : []),
        ],
      };
    }

    // Portrait on the left (wiped up, slow push), the name rising beside it, life years rolling like
    // an odometer, the role, then up to three dated facts on a thin rail.
    case 'profile': {
      const nameL = [...spec.name].length;
      const ns = nameL <= 12 ? 128 : nameL <= 20 ? 104 : nameL <= 28 ? 84 : 68;
      const w = wheel(spec.years, 'py');
      const ext = spec.photo.slice(spec.photo.lastIndexOf('.')).toLowerCase();
      const facts = spec.facts ?? [];
      const nameWords = spec.name.split(/\s+/).filter(Boolean);
      return {
        focus: [700, 540],
        layout: 'left',
        body: `<i id="pfr" class="pfr"></i><div id="pp" class="pp"><img src="photo${ext}" alt="" /></div>` +
          `<div class="pc"><div class="pn disp" style="font-size:${ns}px">${nameWords.map((wd, i) => mask(`pn${i}`, esc(wd))).join(' ')}</div>` +
          `<div id="py" class="pyr num">${w.html}</div><div class="pro">${mask('pr', esc(spec.role))}</div>` +
          (facts.length
            ? `<div class="pfs"><i id="prl" class="prl"></i>${facts.map((fct, i) => `<div id="pf${i}" class="pft"><i></i><b class="num">${esc(fct.year)}</b><span>${esc(fct.text)}</span></div>`).join('')}</div>`
            : '') +
          `</div>`,
        css: `.pp{position:absolute;left:180px;top:170px;width:580px;height:740px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.55)}.pp img{width:100%;height:100%;object-fit:cover;filter:grayscale(.2) contrast(1.05)}
.pfr{position:absolute;left:206px;top:196px;width:580px;height:740px;box-shadow:inset 0 0 0 5px ${ACC}}
.pc{position:absolute;left:860px;right:160px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.pn{line-height:1.02;letter-spacing:-.015em}.pyr{display:flex;align-items:flex-end;font-size:78px;line-height:1;color:${ACC};margin-top:22px}.pro{font-size:38px;line-height:1.3;color:${c.textSub};margin-top:18px}
.pfs{position:relative;display:flex;flex-direction:column;gap:22px;margin-top:46px;padding-left:40px}.prl{position:absolute;left:7px;top:10px;bottom:10px;width:4px;border-radius:2px;background:${c.line};transform-origin:50% 0}
.pft{position:relative;display:flex;align-items:baseline;gap:22px}.pft i{position:absolute;left:-41px;top:.4em;width:18px;height:18px;border-radius:50%;background:${ACC}}.pft b{flex:none;font-size:42px;color:${c.accentHi}}.pft span{font-size:36px;line-height:1.3}`,
        js: [
          `tl.fromTo("#pp", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.85, ease: "power3.out" }, 0.1);`,
          `tl.fromTo("#pp img", { scale: 1.14 }, { scale: 1, duration: ${f2(seconds)}, ease: "none" }, 0);`,
          'tl.fromTo("#pfr", { opacity: 0, x: -26, y: -26 }, { opacity: 1, x: 0, y: 0, duration: 0.6, ease: "power3.out" }, 0.5);',
          ...nameWords.map((_, i) => rise(`#pn${i}`, 0.45 + i * 0.08, 0.8)),
          'tl.fromTo("#py", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.65);',
          ...w.js(profileTimes.roll.at, profileTimes.roll.dur),
          rise('#pr', 1.0),
          ...(facts.length ? [`tl.fromTo("#prl", { scaleY: 0 }, { scaleY: 1, duration: ${f2(0.35 * facts.length + 0.2)}, ease: "power1.inOut" }, ${f2(profileTimes.fact(0) - 0.1)});`] : []),
          ...facts.map((_, i) => `tl.fromTo("#pf${i}", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, ${f2(profileTimes.fact(i))});`),
          ...facts.map((_, i) => pop(`#pf${i} i`, profileTimes.fact(i), 0.2, 'back.out(3)', 0.35)),
        ],
      };
    }
  }
}
