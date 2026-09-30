// cvm render --chapter N → renders/chNN.mp4 + .srt + .wav (the WAV is reused by `cvm final`).
//   The chapter is one HyperFrames composition (compose/chNN/): scene visuals with overlapping
//   transitions and Ken Burns, the voice track untouched, and SFX. See src/compose.ts.
// cvm render --chapters 3-12 | --all [--jobs N] → several chapters, N HyperFrames renders at a time.
//   Safe in parallel: rendering only reads manifest.json and writes per-chapter files.
// cvm final             → final.mp4 + subs.srt from every chapter render, + credits.txt for the video description.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chapterComposition, writeComposition } from '../compose.ts';
import { audioToWav, buildChapterAudio, chapterTimings, concatChapters, FPS, probeDuration, runAsync, trimToFrames } from '../media.ts';
import { mapLimit } from '../pool.ts';
import { chapters, chapterScenes, chapterTag, missingCaptions, ROOT, type Project, type Scene } from '../project.ts';
import { sceneCues, toSrt, type Cue } from '../srt.ts';
import { HYPERFRAMES } from './animatic.ts';

async function renderChapter(p: Project, chapter: number): Promise<void> {
  const scenes = chapterScenes(p, chapter);
  const noAudio = scenes.filter((s) => s.audio.duration == null).map((s) => s.id);
  if (noAudio.length) throw new Error(`Chưa có audio: ${noAudio.join(', ')}`);
  const noAsset = scenes.filter((s) => !s.visual.asset || !existsSync(path.join(p.dir, s.visual.asset))).map((s) => `${s.id} (${s.visual.type})`);
  if (noAsset.length) throw new Error(`Chưa có visual:\n  ${noAsset.join('\n  ')}`);
  const noCaption = missingCaptions(scenes).map((s) => s.id);
  if (noCaption.length) throw new Error(`Ảnh tư liệu chưa có chú thích dữ kiện (visual.caption {title, detail}):\n  ${noCaption.join('\n  ')}`);

  const tag = chapterTag(chapter);
  const dir = path.join(p.dir, 'compose', tag);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, 'assets'), { recursive: true });

  const timings = chapterTimings(scenes);
  // Chapter length snapped to a frame boundary, matching the rendered picture exactly.
  const total = Math.round(timings.at(-1)!.end * FPS) / FPS;
  buildChapterAudio(p.dir, scenes, path.join(dir, 'assets', 'voice.wav'), path.join(dir, '.audio-work'), total);
  rmSync(path.join(dir, '.audio-work'), { recursive: true, force: true });
  writeComposition(dir, chapterComposition(p, scenes, timings, total, 'assets/voice.wav'));

  const out = path.join(p.dir, 'renders', `${tag}.mp4`);
  mkdirSync(path.dirname(out), { recursive: true });
  console.log(`HyperFrames render ${tag} (${scenes.length} scene, ${total.toFixed(1)}s) …`);
  const t0 = Date.now();
  await runAsync('npx', [...HYPERFRAMES, 'render', dir, '--quality', 'looks', '--fps', String(FPS), '--output', out], `[${tag}] `);
  trimToFrames(out, Math.round(total * FPS));
  // Mixed chapter audio (voice + SFX) as PCM: `cvm final` joins WAVs, never AAC streams.
  audioToWav(out, path.join(p.dir, 'renders', `${tag}.wav`), total);

  const cues = scenes.flatMap((s, i) => sceneCues(s.narration, timings[i]!));
  writeFileSync(path.join(p.dir, 'renders', `${tag}.srt`), toSrt(cues));

  console.log(`${path.relative(ROOT, out)} + .srt · timeline ${total.toFixed(3)}s | ffprobe ${probeDuration(out).toFixed(3)}s | ${Math.round(total * FPS)} frame | render ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

/** Render chapters `jobs` at a time; one failing chapter does not stop the others. */
export async function render(p: Project, list: number[], jobs: number): Promise<void> {
  const t0 = Date.now();
  const results = await mapLimit(list, jobs, (ch) => renderChapter(p, ch));
  const failed = results.flatMap((r, i) => (r.ok ? [] : [`${chapterTag(list[i]!)}: ${r.error.message}`]));
  if (list.length > 1) console.log(`\n${list.length - failed.length}/${list.length} chapter xong · --jobs ${jobs} · ${((Date.now() - t0) / 60000).toFixed(1)} phút`);
  if (failed.length) throw new Error(`Chapter lỗi:\n  ${failed.join('\n  ')}`);
}

/** `--chapter N` | `--chapters 3-12` / `1,4,7-9` | `--all` → sorted chapter numbers that exist in the manifest. */
export function chapterList(p: Project, opts: { chapter?: string; chapters?: string; all?: boolean }): number[] {
  const have = chapters(p);
  if (opts.all) return have;
  const spec = opts.chapters ?? opts.chapter;
  if (!spec) throw new Error('Thiếu --chapter N | --chapters A-B | --all');
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) throw new Error(`Danh sách chapter không hợp lệ: "${spec}" (ví dụ 3-12 hoặc 1,4,7-9)`);
    const a = Number(m[1]);
    const b = Number(m[2] ?? m[1]);
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) {
      if (!have.includes(n)) throw new Error(`Chapter ${n} không có trong manifest`);
      out.add(n);
    }
  }
  return [...out].sort((x, y) => x - y);
}

export function final(p: Project): void {
  const list = chapters(p);
  const videos: string[] = [];
  const wavs: string[] = [];
  const cues: Cue[] = [];
  let offset = 0;
  for (const ch of list) {
    const tag = chapterTag(ch);
    const video = path.join(p.dir, 'renders', `${tag}.mp4`);
    const wav = path.join(p.dir, 'renders', `${tag}.wav`);
    if (!existsSync(video) || !existsSync(wav)) throw new Error(`Thiếu renders/${tag}.mp4 hoặc .wav — chạy cvm render --chapter ${ch}`);
    videos.push(video);
    wavs.push(wav);
    const scenes = chapterScenes(p, ch);
    const timings = chapterTimings(scenes);
    cues.push(...scenes.flatMap((s, i) => sceneCues(s.narration, timings[i]!, offset)));
    // Chapter boundaries fall on frame boundaries, matching the frame-rounded video segments.
    offset += Math.round(timings.at(-1)!.end * FPS) / FPS;
  }
  const out = path.join(p.dir, 'final.mp4');
  concatChapters(videos, wavs, out, path.join(p.dir, 'build', 'final'));
  writeFileSync(path.join(p.dir, 'subs.srt'), toSrt(cues));
  writeFileSync(path.join(p.dir, 'credits.txt'), credits(p.manifest.scenes));
  console.log(`${path.relative(ROOT, out)} + subs.srt — ${list.length} chapter, ${offset.toFixed(3)}s (ffprobe ${probeDuration(out).toFixed(3)}s)`);
}

/** One line per distinct source, ready to paste into the video description (CC BY/BY-SA require it). */
function credits(scenes: Scene[]): string {
  const lines = new Map<string, string>();
  for (const src of scenes.flatMap((s) => [s.visual.source, ...(s.visual.sources ?? [])])) {
    if (!src || typeof src !== 'object' || lines.has(src.url)) continue;
    lines.set(
      src.url,
      src.provider === 'wikimedia'
        ? `"${src.title.replace(/^File:/, '')}" — ${src.author} — ${src.license}${src.licenseUrl ? ` (${src.licenseUrl})` : ''} — Wikimedia Commons: ${src.url}`
        : `Video: ${src.author} — Pexels: ${src.url}`,
    );
  }
  return lines.size ? `Nguồn hình ảnh:\n${[...lines.values()].join('\n')}\n` : '';
}
