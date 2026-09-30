// cvm archive search <sceneId> "<query>"          — list reusable Wikimedia Commons stills for the scene.
// cvm archive fetch <pageid|sceneId…> | --batch f — only download originals to archive/raw/ (no manifest write;
//                                                   safe to run in the background right after choosing).
// cvm archive pick <sceneId> <pageid> [--fit cover|contain] — download, frame to 1920×1080, register with credit.
// cvm archive pick --batch picks.json             — many scenes, one manifest write.
// Commons downloads go one at a time, spaced 5–8 s, honouring Retry-After (see download() in media.ts).
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { download, frameStill, WIDTH, HEIGHT } from '../media.ts';
import { readJson, splitSceneId, updateScenes, writeJsonAtomic, type Project, type SceneEdits } from '../project.ts';
import { bigEnough, getImage, licenseOk, searchImages, USER_AGENT, type CommonsImage } from '../stock/wikimedia.ts';
import { checkPicks, findScene, readPicks, type PickEntry } from './asset.ts';

const candidatesPath = (p: Project, sceneId: string) => path.join(p.dir, 'archive', `${sceneId}.json`);

/** Within ~15% of 16:9 a crop loses little; anything else is fitted whole over a blurred fill. */
function autoFit(img: CommonsImage): 'cover' | 'contain' {
  const r = img.width / img.height / (WIDTH / HEIGHT);
  return r > 0.87 && r < 1.15 ? 'cover' : 'contain';
}

export async function archiveSearch(p: Project, sceneId: string | undefined, query: string | undefined): Promise<void> {
  const s = findScene(p, sceneId);
  if (!query) throw new Error('Cú pháp: cvm archive search <sceneId> "<query tiếng Anh>"');

  const all = await searchImages(query);
  const ok = all.filter((img) => licenseOk(img.license) && bigEnough(img));
  mkdirSync(path.dirname(candidatesPath(p, s.id)), { recursive: true });
  writeJsonAtomic(candidatesPath(p, s.id), { query, fetchedAt: new Date().toISOString(), images: ok });

  console.log(`${s.id} — "${query}": ${ok.length}/${all.length} ảnh dùng được (PD/CC0/CC BY/CC BY-SA, cạnh dài ≥ 800px)`);
  for (const img of ok) {
    const dims = `${img.width}x${img.height}`.padEnd(11);
    console.log(`  ${String(img.pageid).padEnd(10)} ${dims} ${autoFit(img).padEnd(7)} ${img.license.slice(0, 16).padEnd(16)} ${img.author.slice(0, 22).padEnd(22)} ${img.title.replace(/^File:/, '').slice(0, 60)}`);
  }
  if (ok.length === 0) console.log('  (không có ảnh phù hợp — thử query khác: tên tiếng Anh/gốc, thêm "engraving", "manuscript", "photograph")');
}

/** Metadata for a Commons file: the scene's own search results, then any other scene's, then the API. */
async function imageInfo(p: Project, id: number, sceneId?: string): Promise<CommonsImage> {
  const dir = path.join(p.dir, 'archive');
  const own = `${sceneId}.json`;
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  for (const f of [...files.filter((x) => x === own), ...files.filter((x) => x !== own)]) {
    const hit = readJson<{ images?: CommonsImage[] }>(path.join(dir, f)).images?.find((x) => x.pageid === id);
    if (hit) return hit;
  }
  return getImage(id);
}

const rawPath = (p: Project, img: CommonsImage) =>
  path.join(p.dir, 'archive', 'raw', `commons-${img.pageid}${img.mime === 'image/png' ? '.png' : '.jpg'}`); // Commons serves TIFF/WebP thumbs as JPEG

async function fetchRaw(p: Project, img: CommonsImage): Promise<string> {
  const raw = rawPath(p, img);
  if (!existsSync(raw)) {
    console.log(`Tải Commons ${img.pageid} (${img.width}x${img.height}) …`);
    await download(img.downloadUrl, raw, { 'User-Agent': USER_AGENT });
  }
  return raw;
}

/** Download originals only. Args: pageids, or scene ids that already have a Commons source. */
export async function archiveFetch(p: Project, args: string[], batchFile: string | undefined): Promise<void> {
  const ids = batchFile
    ? readPicks(batchFile).map((e) => e.id)
    : args.map((a) => {
        if (/^\d+$/.test(a)) return Number(a);
        const src = findScene(p, a).visual.source;
        if (typeof src === 'object' && src?.provider === 'wikimedia') return src.id;
        throw new Error(`${a} chưa có nguồn Commons — truyền pageid`);
      });
  if (ids.length === 0) throw new Error('Cú pháp: cvm archive fetch <pageid|sceneId…> | --batch picks.json');
  const failed: string[] = [];
  for (const id of new Set(ids)) {
    try {
      const img = await imageInfo(p, id);
      if (!licenseOk(img.license)) throw new Error(`giấy phép "${img.license}" không cho dùng lại`);
      console.log(`ok      ${id} → ${path.relative(p.dir, await fetchRaw(p, img))}`);
    } catch (err) {
      failed.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      if (/429/.test(String(err))) break; // blocked: stop instead of hammering the next files
    }
  }
  if (failed.length) throw new Error(`Không tải được:\n  ${failed.join('\n  ')}`);
}

export async function archivePick(p: Project, sceneId: string | undefined, idArg: string | undefined, fitArg: string | undefined): Promise<void> {
  const id = Number(idArg);
  if (!sceneId || !Number.isInteger(id)) throw new Error('Cú pháp: cvm archive pick <sceneId> <pageid> [--fit cover|contain] | --batch picks.json');
  return archivePickMany(p, [{ scene: sceneId, id, fit: fitArg as PickEntry['fit'] }]);
}

export async function archivePickBatch(p: Project, file: string): Promise<void> {
  return archivePickMany(p, readPicks(file));
}

async function archivePickMany(p: Project, picks: PickEntry[]): Promise<void> {
  checkPicks(p, picks);
  for (const e of picks) if (e.fit != null && e.fit !== 'cover' && e.fit !== 'contain') throw new Error(`${e.scene}: fit phải là cover hoặc contain`);

  const edits: SceneEdits = new Map();
  const notes: string[] = [];
  const failed: string[] = [];
  for (const e of picks) {
    try {
      const img = await imageInfo(p, e.id, e.scene);
      if (!licenseOk(img.license)) throw new Error(`${img.title}: giấy phép "${img.license}" không cho dùng lại — chọn ảnh khác`);
      const raw = await fetchRaw(p, img);
      const fit = e.fit ?? autoFit(img);
      const { chapter, scene } = splitSceneId(e.scene);
      const rel = path.join('visuals', chapter, `${scene}.jpg`);
      frameStill(raw, path.join(p.dir, rel), fit);
      edits.set(e.scene, (s) => {
        s.visual.asset = rel;
        s.visual.source = { provider: 'wikimedia', id: e.id, title: img.title, url: img.pageUrl, author: img.author, license: img.license, licenseUrl: img.licenseUrl };
        s.visual.status = 'ready';
      });
      notes.push(`${e.scene} ← ${rel} (${fit}; ${img.license}; ${img.author}) · xem ảnh này trước khi chấp nhận`);
      if (!findScene(p, e.scene).visual.caption?.title) notes.push(`  cần ghi visual.caption {title, detail}: tên + năm sinh–mất / năm + nơi (xem ${img.pageUrl})`);
    } catch (err) {
      failed.push(`${e.scene}: ${err instanceof Error ? err.message : String(err)}`);
      if (/429/.test(String(err))) break;
    }
  }
  updateScenes(p, edits); // one locked write for the whole batch
  for (const n of notes) console.log(n);
  if (failed.length) throw new Error(`${failed.length} ảnh lỗi (các ảnh khác đã ghi):\n  ${failed.join('\n  ')}`);
}
