// Animatic = real voice track + one text card per scene (intent + narration), rendered by HyperFrames.
// Must be approved before any credit is spent on visuals.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildChapterAudio, chapterTimings, FPS, HEIGHT, probeDuration, run, WIDTH, type Timing } from '../media.ts';
import { chapterScenes, chapterTag, ROOT, type Project, type Scene } from '../project.ts';

export const HYPERFRAMES = ['--yes', 'hyperframes@0.8.83'];

const TYPE_COLOR: Record<string, string> = { animation: '#4cc9f0', ai_image: '#f72585', ai_video: '#ff9e00', stock: '#80ed99', archive: '#c9a227', text_card: '#e9ecef' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function card(s: Scene, t: Timing, i: number): string {
  const color = TYPE_COLOR[s.visual.type] ?? '#fff';
  return `
      <section id="c${i}" class="clip card" data-start="${t.start.toFixed(3)}" data-duration="${(t.end - t.start).toFixed(3)}" data-track-index="0">
        <div id="c${i}-in" class="inner">
          <div class="meta"><span class="badge" style="background:${color}">${esc(s.visual.type)}</span><span>${esc(s.id)}</span><span>${t.start.toFixed(1)}s → ${t.end.toFixed(1)}s</span></div>
          <h1 class="intent">${esc(s.visual.intent || '(chưa có intent)')}</h1>
          <p class="narration">${esc(s.narration)}</p>
        </div>
      </section>`;
}

function indexHtml(scenes: Scene[], timings: Timing[], total: number): string {
  const tweens = timings.map((t, i) => `tl.fromTo("#c${i}-in", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, ${t.start.toFixed(3)});`).join('\n      ');
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${WIDTH}, height=${HEIGHT}" />
    <title>Animatic</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Barlow"; src: url("fonts/Barlow-Regular.ttf") format("truetype"); font-weight: 400; }
      @font-face { font-family: "Barlow"; src: url("fonts/Barlow-Bold.ttf") format("truetype"); font-weight: 700; }
      body { margin: 0; background: #101418; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #101418; color: #f1f3f5; font-family: "Barlow", sans-serif; }
      .card { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .inner { width: 1600px; display: flex; flex-direction: column; gap: 36px; }
      .meta { display: flex; gap: 28px; align-items: center; font-size: 30px; color: #adb5bd; }
      .badge { color: #101418; font-weight: 700; padding: 6px 18px; border-radius: 8px; text-transform: uppercase; }
      .intent { margin: 0; font-size: 68px; font-weight: 700; line-height: 1.15; }
      .narration { margin: 0; font-size: 34px; line-height: 1.4; color: #ced4da; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="${WIDTH}" data-height="${HEIGHT}" data-duration="${total.toFixed(3)}">${scenes.map((s, i) => card(s, timings[i]!, i)).join('')}
      <audio id="vo" src="audio.wav" data-start="0" data-duration="${total.toFixed(3)}" data-track-index="10" data-volume="1"></audio>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${tweens}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

export function animatic(p: Project, chapter: number): void {
  const scenes = chapterScenes(p, chapter);
  const missing = scenes.filter((s) => s.audio.path == null || s.audio.duration == null).map((s) => s.id);
  if (missing.length) throw new Error(`Chưa có audio: ${missing.join(', ')} — chạy cvm tts --chapter ${chapter} --yes`);

  const tag = chapterTag(chapter);
  const buildDir = path.join(p.dir, 'build', `${tag}_animatic`);
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  cpSync(path.join(ROOT, 'templates', 'animatic', 'fonts'), path.join(buildDir, 'fonts'), { recursive: true });

  const timings = chapterTimings(scenes);
  const total = timings.at(-1)!.end;
  buildChapterAudio(p.dir, scenes, path.join(buildDir, 'audio.wav'), path.join(p.dir, 'build', `${tag}_audio_work`));
  writeFileSync(path.join(buildDir, 'index.html'), indexHtml(scenes, timings, total));

  const out = path.join(p.dir, 'renders', `${tag}_animatic.mp4`);
  mkdirSync(path.dirname(out), { recursive: true });
  console.log(`Render animatic ${tag}: ${scenes.length} scene, ${total.toFixed(3)}s …`);
  run('npx', [...HYPERFRAMES, 'render', buildDir, '--quality', 'draft', '--fps', String(FPS), '--output', out], { inherit: true });

  const actual = probeDuration(out);
  const speech = scenes.reduce((n, s) => n + s.audio.duration!, 0);
  const pause = scenes.reduce((n, s) => n + s.audio.pauseAfterMs / 1000, 0);
  console.log(`\n${path.relative(ROOT, out)}`);
  console.log(`  audio ${speech.toFixed(3)}s + pause ${pause.toFixed(3)}s = ${total.toFixed(3)}s | ffprobe ${actual.toFixed(3)}s | lệch ${(actual - total).toFixed(3)}s`);
  if (Math.abs(actual - total) > 1 / FPS + 0.05) console.warn('⚠ Độ dài animatic lệch hơn 1 frame so với tổng audio + pause');
}
