// One chapter as a single HyperFrames composition: every scene's visual on the chapter timeline,
// 0.4s overlapping transitions, Ken Burns on footage/photos, the chapter voice track and SFX
// (transition whoosh, count ticks and pops declared by the graphic templates).
// The voice is never re-timed: each scene still owns exactly [start, start + duration + pause].
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { projectTheme } from './commands/graphics.ts';
import { soundCues, validateSpec, type SoundCue } from './graphics/templates.ts';
import type { Theme } from './graphics/theme.ts';
import { FPS, HEIGHT, probeDuration, WIDTH, type Timing } from './media.ts';
import { readJson, ROOT, slotSeconds, type Project, type Scene } from './project.ts';

const OVERLAP = 0.4; // transition length; each clip gets OVERLAP/2 of handle on both sides
const HANDLE = OVERLAP / 2;
const GRAPHIC = new Set(['animation', 'text_card']);
const SFX_FILE: Record<SoundCue['sfx'], { file: string; gain: number }> = {
  tick: { file: 'click-soft.mp3', gain: 0.55 },
  whoosh: { file: 'whoosh-short.mp3', gain: 0.6 },
  pop: { file: 'pop.mp3', gain: 0.7 },
};
const TRANSITION_WHOOSH = 0.22; // gain of the whoosh on a graphic ↔ footage cut
/** Ken Burns moves, cycled over footage and photo scenes. */
const KEN_BURNS = [
  ['{ scale: 1.0 }', '{ scale: 1.08 }'],
  ['{ scale: 1.08 }', '{ scale: 1.0 }'],
  ['{ scale: 1.07, x: -36 }', '{ scale: 1.07, x: 36 }'],
  ['{ scale: 1.07, x: 36 }', '{ scale: 1.07, x: -36 }'],
] as const;

const CAPTION_IN = 0.5; // caption appears this long after the scene's voice starts
const CAPTION_OUT = 0.35; // … and is gone this long before the scene ends

const f3 = (n: number) => n.toFixed(3);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lower-third fact label (name, years, place) in the project's theme fonts and colours. */
function captionCss(t: Theme): string {
  const c = t.colors;
  const faces = t.fontFaces.map((f) => `@font-face{font-family:"${f.family}";src:url("fonts/${f.file}") format("truetype");font-weight:${f.weight};}`).join('\n');
  return `${faces}
.cap{position:absolute;left:96px;bottom:92px;max-width:1300px;display:flex;flex-direction:column;gap:6px;padding:18px 30px 20px 30px;border-radius:12px;background:${c.panel};box-shadow:inset 6px 0 0 ${c.accent},0 18px 50px rgba(0,0,0,.45);opacity:0;}
.cap b{font-family:"${t.fonts.display}";font-weight:${t.displayWeight};font-size:46px;line-height:1.12;color:${c.text};}
.cap span{font-family:"${t.fonts.body}";font-weight:400;font-size:30px;line-height:1.3;color:${c.textSub};}`;
}
// Root duration sits 1ms under the frame boundary: HyperFrames rounds 77.367s (= 2321 frames) up to 2322.
const snap = (t: number) => Math.round(t * FPS) / FPS;

/** Hard-link (no copy of big stock files) into the composition dir; copy across filesystems. */
function place(src: string, dest: string): void {
  if (existsSync(dest)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  try {
    linkSync(src, dest);
  } catch {
    copyFileSync(src, dest);
  }
}

/**
 * Where a scene's pixels come from. Stock uses the untrimmed download so the transition handles
 * show real footage; older picks without `visual.clip` fall back to the default mid-clip cut.
 */
function sceneSource(p: Project, s: Scene): { file: string; start: number } {
  if (s.visual.type !== 'stock') return { file: s.visual.asset!, start: 0 };
  if (s.visual.clip) return s.visual.clip;
  const src = s.visual.source;
  if (src && typeof src === 'object') {
    const raw = readdirSync(path.join(p.dir, 'stock', 'raw')).find((f) => f.startsWith(`pexels-${src.id}-`));
    const listed = existsSync(path.join(p.dir, 'stock', `${s.id}.json`)) ? readJson<{ videos: { id: number; duration: number }[] }>(path.join(p.dir, 'stock', `${s.id}.json`)).videos.find((v) => v.id === src.id) : undefined;
    if (raw && listed) return { file: path.join('stock', 'raw', raw), start: Math.max(0, (listed.duration - slotSeconds(s)) / 2) };
  }
  return { file: s.visual.asset!, start: 0 };
}

export interface ChapterComposition {
  html: string;
  /** Files to place in the composition dir: published path → absolute source. */
  files: Record<string, string>;
}

/** @param voiceRel path of the chapter voice WAV inside the composition dir */
export function chapterComposition(p: Project, scenes: Scene[], timings: Timing[], total: number, voiceRel: string): ChapterComposition {
  const files: Record<string, string> = {};
  const layers: string[] = [];
  const tweens: string[] = [];
  const cues: { file: string; at: number; gain: number }[] = [];
  const theme = projectTheme(p);
  let kb = 0;

  scenes.forEach((s, i) => {
    const t = timings[i]!;
    const start = snap(t.start);
    const clipStart = i === 0 ? 0 : snap(t.start - HANDLE);
    const clipEnd = i === scenes.length - 1 ? total : snap(t.end + HANDLE);
    const graphic = GRAPHIC.has(s.visual.type);
    const src = sceneSource(p, s);
    const rel = `assets/${s.id}${path.extname(src.file)}`;
    files[rel] = path.join(p.dir, src.file);
    // Graphics start their own timeline HANDLE early (their first frames are background only);
    // footage keeps its cut aligned with the voice and borrows the handle from the source.
    const mediaStart = s.visual.type === 'stock' ? Math.max(0, src.start - (start - clipStart)) : 0;
    const timing = `data-start="${f3(clipStart)}" data-duration="${f3(clipEnd - clipStart)}" data-track-index="${i % 2}"`;
    const media = /\.(png|jpe?g|webp)$/i.test(rel)
      ? `<img id="m${i}" class="clip" src="${rel}" alt="" ${timing} />`
      : `<video id="m${i}" class="clip" src="${rel}" ${timing} data-media-start="${f3(mediaStart)}" muted playsinline></video>`;
    const cap = s.visual.caption;
    const caption = cap?.title ? `<div id="cap${i}" class="cap"><b>${esc(cap.title)}</b>${cap.detail ? `<span>${esc(cap.detail)}</span>` : ''}</div>` : '';
    layers.push(`<div id="tr${i}" class="tr"><div id="kb${i}" class="kb">${media}</div>${caption}</div>`);
    if (caption) {
      const inAt = start + CAPTION_IN;
      const outAt = Math.max(inAt + 1, snap(t.end) - CAPTION_OUT - 0.3);
      tweens.push(`tl.fromTo("#cap${i}", { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, ease: "${theme.ease}" }, ${f3(inAt)});`);
      tweens.push(`tl.to("#cap${i}", { opacity: 0, duration: 0.3, ease: "power1.in" }, ${f3(outAt)});`);
    }

    if (i > 0) {
      const cut = GRAPHIC.has(scenes[i - 1]!.visual.type) !== graphic; // graphic ↔ footage
      tweens.push(`tl.fromTo("#tr${i}", { opacity: 0, scale: ${cut ? 1.06 : 1.02} }, { opacity: 1, scale: 1, duration: ${OVERLAP}, ease: "power2.out" }, ${f3(clipStart)});`);
      if (cut) cues.push({ file: 'whoosh-short.mp3', at: clipStart - 0.05, gain: TRANSITION_WHOOSH });
    }
    if (graphic) {
      if (s.visual.spec) for (const c of soundCues(validateSpec(s.id, s.visual.spec))) cues.push({ file: SFX_FILE[c.sfx].file, at: clipStart + c.at, gain: c.gain * SFX_FILE[c.sfx].gain });
    } else {
      const [from, to] = KEN_BURNS[kb++ % KEN_BURNS.length]!;
      tweens.push(`tl.fromTo("#kb${i}", ${from}, { ...${to}, duration: ${f3(clipEnd - clipStart)}, ease: "none" }, ${f3(clipStart)});`);
    }
  });

  if (layers.some((l) => l.includes('class="cap"'))) {
    for (const f of theme.fontFaces) files[`fonts/${f.file}`] = path.join(ROOT, 'templates', 'animatic', 'fonts', f.file);
  }

  const sfxDir = path.join(ROOT, 'templates', 'sfx');
  const sfx = cues
    .filter((c) => c.at >= 0 && c.at < total - 0.1)
    .map((c, i) => {
      files[`assets/sfx/${c.file}`] = path.join(sfxDir, c.file);
      const d = Math.min(probeDuration(path.join(sfxDir, c.file)), total - c.at);
      // Ticks overlap by design; spread them over four lanes so none is dropped as a duplicate.
      return `<audio id="sfx${i}" src="assets/sfx/${c.file}" data-start="${f3(c.at)}" data-duration="${f3(d)}" data-volume="${c.gain.toFixed(3)}" data-audio-group="sfx" data-track-index="${32 + (i % 4)}"></audio>`;
    });

  const html = `<!doctype html>
<html lang="vi"><head><meta charset="UTF-8" /><meta name="viewport" content="width=${WIDTH}, height=${HEIGHT}" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
body{margin:0;background:#000;}
#root{position:relative;width:100%;height:100%;overflow:hidden;background:#000;}
.tr,.kb{position:absolute;inset:0;}
.kb video,.kb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
${captionCss(theme)}
</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-width="${WIDTH}" data-height="${HEIGHT}" data-duration="${(total - 0.001).toFixed(4)}">
${layers.join('\n')}
<audio id="vo" src="${voiceRel}" data-start="0" data-duration="${f3(total)}" data-volume="1" data-audio-group="voiceover" data-track-index="30"></audio>
${sfx.join('\n')}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${tweens.join('\n')}
window.__timelines["main"] = tl;
</script></body></html>
`;
  return { html, files };
}

/** Write the composition and its files into `dir` (hard links where possible). */
export function writeComposition(dir: string, c: ChapterComposition): void {
  mkdirSync(dir, { recursive: true });
  for (const [rel, src] of Object.entries(c.files)) place(src, path.join(dir, rel));
  writeFileSync(path.join(dir, 'index.html'), c.html);
}
