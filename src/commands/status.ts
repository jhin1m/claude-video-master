// cvm status — where a project stands: per chapter audio / visuals / renders, and what to run next.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chapters, chapterScenes, chapterTag, missingCaptions, readJson, sceneHash, type Project, type Scene } from '../project.ts';

type AudioState = 'ok' | 'stale' | 'missing';

function audioState(p: Project, s: Scene): AudioState {
  const { voice, speed, emotion } = p.manifest.tts;
  if (!s.audio.path || s.audio.duration == null || !existsSync(path.join(p.dir, s.audio.path))) return 'missing';
  return voice && s.hash === sceneHash(s.narration, voice, speed, emotion) ? 'ok' : 'stale';
}

const mtime = (f: string) => (existsSync(f) ? statSync(f).mtimeMs : 0);
const chars = (s: Scene) => [...s.narration].length;

/**
 * Projected length from the voice's measured pace: synthesized scenes count as they are, the rest
 * as characters ÷ measured chars/s; every pause counts. Compared with `brief.json` → `targetMinutes`.
 */
function paceReport(p: Project, audio: Map<string, AudioState>): string[] {
  const done = p.manifest.scenes.filter((s) => audio.get(s.id) === 'ok');
  if (done.length === 0) return [];
  const spoken = done.reduce((n, s) => n + s.audio.duration!, 0);
  const rate = done.reduce((n, s) => n + chars(s), 0) / spoken;
  const rest = p.manifest.scenes.filter((s) => audio.get(s.id) !== 'ok');
  const pauses = p.manifest.scenes.reduce((n, s) => n + s.audio.pauseAfterMs / 1000, 0);
  const projected = spoken + rest.reduce((n, s) => n + chars(s), 0) / rate + pauses;
  const lines = [`Nhịp đo được ${rate.toFixed(1)} ký tự/s (${done.length} scene) · ước lượng tổng ${(projected / 60).toFixed(2)} phút (tính cả pause ${pauses.toFixed(0)}s)`];
  const briefFile = path.join(p.dir, 'brief.json');
  const target = existsSync(briefFile) ? readJson<{ targetMinutes?: number }>(briefFile).targetMinutes : undefined;
  if (target) {
    const off = projected / 60 / target - 1;
    lines.push(`  mục tiêu ${target} phút → lệch ${off >= 0 ? '+' : ''}${(off * 100).toFixed(0)}%${Math.abs(off) > 0.15 ? ' ⚠ quá 15% — báo user trước khi TTS tiếp' : ''}`);
  }
  return lines;
}

export function status(p: Project): void {
  const { voice, speed, emotion } = p.manifest.tts;
  console.log(`Project ${p.slug} · voice ${voice ?? '(chưa đặt)'} · speed ${speed} · emotion ${emotion}`);
  let total = 0;
  const next: string[] = [];
  const audioOf = new Map(p.manifest.scenes.map((s) => [s.id, audioState(p, s)]));

  for (const ch of chapters(p)) {
    const tag = chapterTag(ch);
    const scenes = chapterScenes(p, ch);
    const audio = scenes.map((s) => audioOf.get(s.id)!);
    const needAudio = scenes.filter((_, i) => audio[i] !== 'ok').map((s) => s.id);
    const missingVisual = scenes.filter((s) => !s.visual.asset || !existsSync(path.join(p.dir, s.visual.asset)));
    const seconds = scenes.reduce((n, s) => n + (s.audio.duration ?? 0) + s.audio.pauseAfterMs / 1000, 0);
    total += seconds;

    // A render is stale when any input it was built from is newer than it.
    const render = path.join(p.dir, 'renders', `${tag}.mp4`);
    const newestInput = Math.max(...scenes.flatMap((s) => [s.audio.path, s.visual.asset].filter((f): f is string => !!f).map((f) => mtime(path.join(p.dir, f)))));
    const renderState = !existsSync(render) ? 'chưa có' : mtime(render) < newestInput ? 'cũ' : 'ok';
    const animatic = existsSync(path.join(p.dir, 'renders', `${tag}_animatic.mp4`)) ? 'có' : 'chưa có';

    console.log(`\n${tag} · ${scenes.length} scene · ${seconds.toFixed(1)}s`);
    console.log(`  audio    ${audio.filter((a) => a === 'ok').length}/${scenes.length} ok${needAudio.length ? ` — cần TTS: ${needAudio.join(', ')}` : ''}`);
    console.log(`  animatic ${animatic}`);
    console.log(`  visuals  ${scenes.length - missingVisual.length}/${scenes.length} có asset${missingVisual.length ? ` — thiếu: ${missingVisual.map((s) => `${s.id}(${s.visual.type})`).join(', ')}` : ''}`);
    const noCaption = missingCaptions(scenes);
    if (noCaption.length) console.log(`  chú thích thiếu ở ảnh tư liệu: ${noCaption.map((s) => s.id).join(', ')}`);
    console.log(`  render   ${renderState}`);

    if (needAudio.length) next.push(`cvm tts --chapter ${ch} --yes`);
    else if (animatic === 'chưa có') next.push(`cvm animatic --chapter ${ch}`);
    else if (missingVisual.length) next.push(`visuals ${tag}: cvm graphics --chapter ${ch} / cvm stock … / cvm asset set …`);
    else if (noCaption.length) next.push(`ghi visual.caption cho ${noCaption.map((s) => s.id).join(', ')}`);
    else if (renderState !== 'ok') next.push(`cvm render --chapter ${ch}`);
  }

  const finalFile = path.join(p.dir, 'final.mp4');
  const finalState = !existsSync(finalFile) ? 'chưa có' : chapters(p).some((ch) => mtime(path.join(p.dir, 'renders', `${chapterTag(ch)}.mp4`)) > mtime(finalFile)) ? 'cũ' : 'ok';
  if (next.length === 0 && finalState !== 'ok') next.push('cvm final');
  console.log(`\nTổng ${total.toFixed(1)}s (${(total / 60).toFixed(2)} phút) · final.mp4 ${finalState}`);
  for (const line of paceReport(p, audioOf)) console.log(line);
  console.log(next.length ? `Tiếp theo:\n  ${next.join('\n  ')}` : 'Xong — không còn việc máy móc nào.');
}
