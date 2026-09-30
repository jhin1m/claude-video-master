// cvm stock search <sceneId> "<query>"  — list Pexels candidates long enough for the scene slot.
// cvm stock pick <sceneId> <id> [--start s] — download, cut to the slot, register as the scene asset.
// cvm stock pick <sceneId> <id> --bg        — same clip, but as the footage behind a graphic scene
//                                             (visual.spec.bg); `cvm graphics` then renders over it.
// cvm stock pick --batch picks.json         — many scenes: downloads 4 at a time, one manifest write.
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { download, extractFrame, normalizeClip, FPS } from '../media.ts';
import { mapLimit } from '../pool.ts';
import { readJson, slotSeconds, splitSceneId, updateScenes, writeJsonAtomic, type Project, type SceneEdits } from '../project.ts';
import { bestFile, getVideo, searchVideos, type PexelsVideo } from '../stock/pexels.ts';
import { checkPicks, findScene, readPicks, type PickEntry } from './asset.ts';
import { GRAPHIC_TYPES, TAIL_S } from './graphics.ts';

const MARGIN_S = 1; // clip must be at least slot + 1s so the cut can avoid the first/last second
const DOWNLOAD_JOBS = 4;

const candidatesPath = (p: Project, sceneId: string) => path.join(p.dir, 'stock', `${sceneId}.json`);

export async function stockSearch(p: Project, sceneId: string | undefined, query: string | undefined): Promise<void> {
  const s = findScene(p, sceneId);
  if (!query) throw new Error('Cú pháp: cvm stock search <sceneId> "<query tiếng Anh>"');
  const need = s.audio.duration != null ? slotSeconds(s) + MARGIN_S : 5 + MARGIN_S;

  const videos = await searchVideos(query);
  const ok = videos.filter((v) => v.duration >= need && bestFile(v));
  writeJsonAtomic(candidatesPath(p, s.id), { query, need, fetchedAt: new Date().toISOString(), videos: ok });

  console.log(`${s.id} — "${query}": ${ok.length}/${videos.length} clip ≥ ${need.toFixed(1)}s, ≥1080p ngang`);
  for (const v of ok) {
    const f = bestFile(v)!;
    console.log(`  ${String(v.id).padEnd(10)} ${String(v.duration).padStart(3)}s  ${f.width}x${f.height}  ${v.user.name.slice(0, 24).padEnd(24)}  ${v.url}`);
  }
  if (ok.length === 0) console.log('  (không có clip phù hợp — đổi query, hoặc đổi visual.type)');
}

export async function stockPick(p: Project, sceneId: string | undefined, idArg: string | undefined, startArg: string | undefined, asBg = false): Promise<void> {
  const id = Number(idArg);
  if (!sceneId || !Number.isInteger(id)) throw new Error('Cú pháp: cvm stock pick <sceneId> <pexelsId> [--start s] [--bg] | --batch picks.json');
  return stockPickMany(p, [{ scene: sceneId, id, start: startArg != null ? Number(startArg) : undefined, bg: asBg }]);
}

export async function stockPickBatch(p: Project, file: string): Promise<void> {
  return stockPickMany(p, readPicks(file));
}

interface Prepared {
  e: PickEntry;
  video: PexelsVideo;
  link: string;
  raw: string;
  slot: number;
}

async function stockPickMany(p: Project, picks: PickEntry[]): Promise<void> {
  checkPicks(p, picks);
  const prepared: Prepared[] = [];
  for (const e of picks) {
    const s = findScene(p, e.scene);
    if (e.bg && !(GRAPHIC_TYPES.has(s.visual.type) && s.visual.spec)) throw new Error(`${s.id}: --bg chỉ dùng cho scene animation/text_card đã có visual.spec`);
    if (e.start != null && !Number.isFinite(e.start)) throw new Error(`${s.id}: start không hợp lệ`);
    // A background must also cover the graphic's render tail (transition overlap).
    const slot = slotSeconds(s) + (e.bg ? TAIL_S : 0);
    const cached = existsSync(candidatesPath(p, s.id)) ? readJson<{ videos: PexelsVideo[] }>(candidatesPath(p, s.id)).videos.find((v) => v.id === e.id) : undefined;
    const video = cached ?? (await getVideo(e.id));
    const file = bestFile(video);
    if (!file) throw new Error(`Pexels ${e.id}: không có bản MP4 ngang`);
    if (video.duration < slot) console.warn(`⚠ ${s.id}: clip ${video.duration}s ngắn hơn slot ${slot.toFixed(2)}s — sẽ giữ frame cuối`);
    prepared.push({ e, video, link: file.link, raw: path.join(p.dir, 'stock', 'raw', `pexels-${e.id}-${file.width}.mp4`), slot });
  }

  // Each distinct source file downloads once, DOWNLOAD_JOBS at a time.
  const toFetch = [...new Map(prepared.filter((x) => !existsSync(x.raw)).map((x) => [x.raw, x])).values()];
  const fetched = await mapLimit(toFetch, DOWNLOAD_JOBS, async (x) => {
    console.log(`Tải Pexels ${x.e.id} …`);
    await download(x.link, x.raw);
  });
  const failed = fetched.flatMap((r, i) => (r.ok ? [] : [`Pexels ${toFetch[i]!.e.id}: ${r.error.message}`]));

  const edits: SceneEdits = new Map();
  const notes: string[] = [];
  const cut = (x: Prepared) => {
    const { e, video, raw, slot } = x;
    // Default: take the middle of the clip (stock clips often start/end on a shaky frame).
    const start = e.start ?? Math.max(0, (video.duration - slot) / 2);
    const source = { provider: 'pexels' as const, id: e.id, url: video.url, author: video.user.name, authorUrl: video.user.url };
    if (e.bg) {
      const rel = path.join('stock', 'bg', `${e.scene}.mp4`);
      normalizeClip(raw, path.join(p.dir, rel), Math.round(slot * FPS), start);
      const preview = path.join(p.dir, 'stock', 'bg', `${e.scene}.jpg`);
      extractFrame(path.join(p.dir, rel), preview, slot / 2);
      edits.set(e.scene, (s) => {
        const spec = s.visual.spec as { bg?: Record<string, unknown> };
        spec.bg = { ...spec.bg, src: rel, start: 0 };
        s.visual.source = source;
      });
      notes.push(`${e.scene} nền ← ${rel} (từ ${start.toFixed(1)}s) · xem ${path.relative(p.dir, preview)} · chạy lại cvm graphics`);
      return;
    }
    const { chapter, scene } = splitSceneId(e.scene);
    const rel = path.join('visuals', chapter, `${scene}.mp4`);
    const out = path.join(p.dir, rel);
    mkdirSync(path.dirname(out), { recursive: true });
    normalizeClip(raw, out, Math.round(slot * FPS), start);
    // Review frame for Claude/user: look at it before accepting the pick.
    const preview = path.join(p.dir, 'visuals', chapter, `${scene}.jpg`);
    extractFrame(out, preview, slot / 2);
    edits.set(e.scene, (s) => {
      s.visual.asset = rel;
      s.visual.clip = { file: path.relative(p.dir, raw), start };
      s.visual.source = source;
      s.visual.status = 'ready';
    });
    notes.push(`${e.scene} ← ${rel} (từ ${start.toFixed(1)}s, ${slot.toFixed(2)}s) · xem ${path.relative(p.dir, preview)}`);
  };
  for (const x of prepared) {
    if (!existsSync(x.raw)) continue; // its download failed (reported above)
    try {
      cut(x);
    } catch (err) {
      failed.push(`${x.e.scene}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  updateScenes(p, edits); // one locked write for the whole batch
  for (const n of notes) console.log(n);
  if (failed.length) throw new Error(`${failed.length} scene lỗi (các scene khác đã ghi):\n  ${failed.join('\n  ')}`);
}
