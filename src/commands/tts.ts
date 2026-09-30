import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { download, probeDuration } from '../media.ts';
import { chapterScenes, chapterTag, manifestWarnings, sceneHash, splitSceneId, updateScene, type Project, type Scene } from '../project.ts';
import type { TtsProvider, TtsRequest } from '../tts/provider.ts';
import { renderTtsFile } from '../tts/tts-file.ts';

const EXT_BY_TYPE: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/flac': 'flac', 'audio/aac': 'aac', 'audio/mp4': 'm4a' };

function audioExt(url: string, contentType: string): string {
  const fromPath = path.extname(new URL(url).pathname).slice(1).toLowerCase();
  if (/^(mp3|wav|ogg|flac|aac|m4a|opus)$/.test(fromPath)) return fromPath;
  return EXT_BY_TYPE[contentType.split(';')[0]!.trim()] ?? 'bin';
}

/** Up to date = same hash as the audio on disk, and that file still exists. */
function isCached(p: Project, s: Scene, hash: string): boolean {
  return s.hash === hash && s.audio.path != null && s.audio.duration != null && existsSync(path.join(p.dir, s.audio.path));
}

export async function tts(p: Project, provider: TtsProvider, chapter: number, yes: boolean): Promise<void> {
  const { voice, speed, emotion } = p.manifest.tts;
  if (!voice) throw new Error('manifest.tts.voice chưa đặt (lấy id từ GET /voices?engine=v4)');
  const scenes = chapterScenes(p, chapter);
  const tag = chapterTag(chapter);

  for (const w of manifestWarnings({ ...p.manifest, scenes })) console.warn(`⚠ ${w}`);
  writeFileSync(path.join(p.dir, 'tts', `${tag}.tts`), renderTtsFile(p.manifest.tts, scenes));

  const pending: { scene: Scene; req: TtsRequest }[] = [];
  for (const s of scenes) {
    const hash = sceneHash(s.narration, voice, speed, emotion);
    if (isCached(p, s, hash)) console.log(`cached  ${s.id}`);
    else pending.push({ scene: s, req: { key: hash, text: s.narration, voice, speed, emotion } });
  }
  if (pending.length === 0) {
    console.log(`${tag}: tất cả ${scenes.length} scene đã cached — không gửi request nào.`);
    return;
  }

  const est = await provider.estimate(pending.map((x) => x.req));
  console.log(`\n${tag}: cần TTS ${pending.length}/${scenes.length} scene (${provider.name}, voice "${voice}", speed ${speed}, emotion ${emotion})`);
  console.log(`Ước tính: ${est.formula} ≈ ${est.tokens.toLocaleString('vi-VN')} token`);
  if (!yes) {
    console.log('Chưa gửi. Chạy lại với --yes để thực hiện.');
    return;
  }

  await provider.assertVoice(voice);
  const results = await provider.synthesize(pending.map((x) => x.req), (m) => console.log(m));
  const byKey = new Map(pending.map((x) => [x.req.key, x.scene]));
  const errors: string[] = [];

  for (const r of results) {
    const s = byKey.get(r.key)!;
    if (!r.audioUrl) {
      errors.push(`${s.id}: ${r.error}`);
      continue;
    }
    const { chapter: chDir, scene: sName } = splitSceneId(s.id);
    const dir = path.join(p.dir, 'audio', chDir);
    mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${sName}.download`);
    const { contentType } = await download(r.audioUrl, tmp);
    const file = `${sName}.${audioExt(r.audioUrl, contentType)}`;
    for (const old of readdirSync(dir)) if (old.startsWith(`${sName}.`) && old !== file) rmSync(path.join(dir, old));
    renameSync(tmp, path.join(dir, file));

    const rel = path.join('audio', chDir, file);
    const duration = Number(probeDuration(path.join(p.dir, rel)).toFixed(3));
    // Persist per scene so an interrupted run keeps its progress.
    updateScene(p, s.id, (x) => {
      x.audio.path = rel;
      x.audio.duration = duration;
      x.hash = r.key;
    });
    console.log(`done    ${s.id}  ${duration.toFixed(3)}s  → ${rel}`);
  }
  if (errors.length) throw new Error(`Một số scene lỗi (VieNeu tự hoàn token):\n  ${errors.join('\n  ')}`);
}
