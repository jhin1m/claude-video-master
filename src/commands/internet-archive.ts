// cvm ia search <sceneId> "<query>" [--type video|image] [--collection id] [--min-height N]
//      — archival film/stills from the whitelisted Internet Archive collections → ia/<sceneId>.json
// cvm ia pick <sceneId> <identifier> [--file name] [--start s] [--fit cover|contain] [--bg] [--min-height N]
//      — film: cut just the needed span straight from the server (no full download), 1920×1080/30fps
//        (non-16:9 film framed whole over a blurred fill), 1 s handle each side for transitions;
//        still: download, frame to 1920×1080. Credit in visual.source.
// --min-height: default 720 (user rule); lower only when the user accepts SD archival film for the video.
// cvm ia pick --batch picks.json  — [{ "scene", "id", "file"?, "start"?, "fit"?, "bg"?, "type"? }], one manifest write
// cvm ia fetch <identifier|sceneId…> | --batch picks.json — download still originals only (no manifest write)
// Requests are spaced through the shared archive.org queue (media.ts); 429/503 → stop and wait Retry-After.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { blackSeconds, cutRemote, download, extractFrame, FPS, frameStill, HEIGHT, normalizeClip, probeSize, WIDTH } from '../media.ts';
import { readJson, slotSeconds, splitSceneId, updateScenes, writeJsonAtomic, type IASource, type Project, type SceneEdits } from '../project.ts';
import { getCandidate, MIN_IMAGE_SIDE, MIN_VIDEO_HEIGHT, resolveFileUrl, search, USER_AGENT, type IACandidate, type IAKind } from '../stock/internet-archive.ts';
import { checkPicks, findScene } from './asset.ts';
import { GRAPHIC_TYPES, TAIL_S } from './graphics.ts';

const MARGIN_S = 1; // a film must run at least slot + margin + handles
const HANDLE_S = 1; // extra footage kept before/after the cut for the 0.4 s transitions

export interface IAPick {
  scene: string;
  id: string; // archive.org identifier
  file?: string;
  start?: number;
  fit?: 'cover' | 'contain';
  bg?: boolean;
  type?: IAKind;
}

const candidatesPath = (p: Project, sceneId: string) => path.join(p.dir, 'ia', `${sceneId}.json`);
const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');

function readIAPicks(file: string): IAPick[] {
  const list = readJson<unknown>(path.resolve(file));
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${file}: cần mảng [{ "scene": "ch01_s001", "id": "<identifier>", … }]`);
  return list.map((x, i) => {
    const e = x as IAPick;
    if (typeof e?.scene !== 'string' || typeof e.id !== 'string' || !e.id) throw new Error(`${file}[${i}]: thiếu "scene" hoặc "id" (identifier dạng chuỗi)`);
    if (e.fit != null && e.fit !== 'cover' && e.fit !== 'contain') throw new Error(`${file}[${i}]: fit phải là cover hoặc contain`);
    if (e.type != null && e.type !== 'video' && e.type !== 'image') throw new Error(`${file}[${i}]: type phải là video hoặc image`);
    if (e.start != null && !Number.isFinite(e.start)) throw new Error(`${file}[${i}]: start không hợp lệ`);
    return e;
  });
}

const slotOr = (p: Project, sceneId: string, fallback = 6) => {
  const s = findScene(p, sceneId);
  return s.audio.duration != null ? slotSeconds(s) : fallback;
};

export function minHeightArg(v: string | undefined): number {
  if (v == null) return MIN_VIDEO_HEIGHT;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 240) throw new Error('--min-height phải là số nguyên ≥ 240');
  return n;
}

export async function iaSearch(p: Project, sceneId: string | undefined, query: string | undefined, typeArg: string | undefined, collection: string | undefined, minHeight = MIN_VIDEO_HEIGHT): Promise<void> {
  const s = findScene(p, sceneId);
  if (!query) throw new Error('Cú pháp: cvm ia search <sceneId> "<query tiếng Anh>" [--type video|image] [--collection id]');
  const kind = (typeArg ?? 'video') as IAKind;
  if (kind !== 'video' && kind !== 'image') throw new Error('--type phải là video hoặc image');
  const need = slotOr(p, s.id) + MARGIN_S + 2 * HANDLE_S;
  const r = await search(query, kind, { minHeight, minLength: need, collection });
  mkdirSync(path.dirname(candidatesPath(p, s.id)), { recursive: true });
  writeJsonAtomic(candidatesPath(p, s.id), { query, kind, need, minHeight, fetchedAt: new Date().toISOString(), items: r.candidates, rejected: r.rejected });

  const rule = kind === 'video' ? `MP4 ≥ ${minHeight}p, ≥ ${need.toFixed(1)}s` : `ảnh ≥ ${MIN_IMAGE_SIDE}px`;
  console.log(`${s.id} — "${query}" (${kind}): ${r.candidates.length} dùng được · ${r.hits} kết quả trong collection danh sách trắng · ${r.rejected.length} loại (${rule}, giấy phép)`);
  for (const c of r.candidates) {
    const dims = c.file.width && c.file.height ? `${c.file.width}x${c.file.height}` : '?x?';
    const len = c.kind === 'video' ? `${Math.round(c.file.length ?? 0)}s` : '';
    console.log(`  ${c.id.slice(0, 38).padEnd(38)} ${dims.padEnd(10)} ${len.padStart(6)}  ${c.year.padEnd(5)} ${c.collection.padEnd(20)} ${String(c.downloads).padStart(7)}↓  ${c.title.slice(0, 50)}`);
  }
  const reasons = new Map<string, number>();
  for (const x of r.rejected) reasons.set(x.why.replace(/"[^"]*"/g, '"…"'), (reasons.get(x.why.replace(/"[^"]*"/g, '"…"')) ?? 0) + 1);
  for (const [why, n] of reasons) console.log(`  (loại ${n}: ${why})`);
  if (r.candidates.length === 0) console.log('  (không có — thử query khác, --type image, hoặc nguồn khác: Commons/Pexels)');
}

/** Candidate for a pick: the scene's own search results first, then any other scene's, then the API (re-checked). */
async function candidateFor(p: Project, e: IAPick, minHeight = MIN_VIDEO_HEIGHT): Promise<IACandidate> {
  const dir = path.join(p.dir, 'ia');
  const own = `${e.scene}.json`;
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  for (const f of [...files.filter((x) => x === own), ...files.filter((x) => x !== own)]) {
    const hit = readJson<{ items?: IACandidate[] }>(path.join(dir, f)).items?.find((x) => x.id === e.id && (!e.type || x.kind === e.type) && (!e.file || x.file.name === e.file));
    if (hit) return hit;
  }
  return getCandidate(e.id, e.type ?? 'video', { minHeight, minLength: 0, file: e.file });
}

const rawImagePath = (p: Project, c: IACandidate) => path.join(p.dir, 'ia', 'raw', `ia-${safe(c.id)}-${safe(path.basename(c.file.name))}`);

async function fetchImage(p: Project, c: IACandidate): Promise<string> {
  const raw = rawImagePath(p, c);
  if (!existsSync(raw)) {
    console.log(`Tải Internet Archive ${c.id}/${c.file.name} …`);
    await download(c.fileUrl, raw, { 'User-Agent': USER_AGENT });
  }
  const [w, h] = probeSize(raw);
  if (Math.max(w, h) < MIN_IMAGE_SIDE) throw new Error(`${c.id}: ảnh ${w}x${h} nhỏ hơn ${MIN_IMAGE_SIDE}px — chọn ảnh khác`);
  return raw;
}

const autoFit = (w: number, h: number): 'cover' | 'contain' => {
  const r = w / h / (WIDTH / HEIGHT);
  return r > 0.87 && r < 1.15 ? 'cover' : 'contain';
};

export async function iaPick(p: Project, sceneId: string | undefined, id: string | undefined, opts: { file?: string; start?: string; fit?: string; bg?: boolean; type?: string; minHeight?: number }): Promise<void> {
  if (!sceneId || !id) throw new Error('Cú pháp: cvm ia pick <sceneId> <identifier> [--type video|image] [--file name] [--start s] [--fit cover|contain] [--bg] | --batch picks.json');
  if (opts.fit != null && opts.fit !== 'cover' && opts.fit !== 'contain') throw new Error('--fit phải là cover hoặc contain');
  if (opts.type != null && opts.type !== 'video' && opts.type !== 'image') throw new Error('--type phải là video hoặc image');
  const start = opts.start != null ? Number(opts.start) : undefined;
  if (start != null && !Number.isFinite(start)) throw new Error('--start không hợp lệ');
  return pickMany(p, [{ scene: sceneId, id, file: opts.file, start, fit: opts.fit as IAPick['fit'], bg: opts.bg, type: opts.type as IAKind | undefined }], opts.minHeight);
}

export async function iaPickBatch(p: Project, file: string, minHeight?: number): Promise<void> {
  return pickMany(p, readIAPicks(file), minHeight);
}

async function pickMany(p: Project, picks: IAPick[], minHeight = MIN_VIDEO_HEIGHT): Promise<void> {
  checkPicks(p, picks);
  for (const e of picks) {
    const s = findScene(p, e.scene);
    if (e.bg && !(GRAPHIC_TYPES.has(s.visual.type) && s.visual.spec)) throw new Error(`${s.id}: --bg chỉ dùng cho scene animation/text_card đã có visual.spec`);
  }
  const edits: SceneEdits = new Map();
  const notes: string[] = [];
  const failed: string[] = [];
  for (const e of picks) {
    try {
      const s = findScene(p, e.scene);
      const c = await candidateFor(p, e, minHeight);
      if (c.kind === 'video' && (c.file.height ?? 0) < minHeight) throw new Error(`${c.id}: ${c.file.height ?? '?'}p thấp hơn ${minHeight}p — chọn bản khác (--file) hoặc nguồn khác`);
      const source: IASource = { provider: 'internet_archive', id: c.id, file: c.file.name, title: c.title, url: c.url, author: c.author, collection: c.collectionName, license: c.license, licenseUrl: c.licenseUrl };
      const { chapter, scene } = splitSceneId(e.scene);

      if (c.kind === 'image') {
        const raw = await fetchImage(p, c);
        const [w, h] = probeSize(raw);
        const fit = e.fit ?? autoFit(w, h);
        const rel = e.bg ? path.join('ia', 'bg', `${e.scene}.jpg`) : path.join('visuals', chapter, `${scene}.jpg`);
        frameStill(raw, path.join(p.dir, rel), e.bg ? 'cover' : fit);
        edits.set(e.scene, (x) => {
          if (e.bg) {
            const spec = x.visual.spec as { bg?: Record<string, unknown> };
            spec.bg = { ...spec.bg, src: rel };
          } else {
            x.visual.asset = rel;
            x.visual.status = 'ready';
          }
          x.visual.source = source;
        });
        notes.push(`${e.scene} ${e.bg ? 'nền ' : ''}← ${rel} (${e.bg ? 'cover' : fit}; ${c.license}; ${c.collectionName}) · xem ảnh này trước khi chấp nhận`);
      } else {
        const slot = slotOr(p, e.scene) + (e.bg ? TAIL_S : 0);
        const len = c.file.length ?? 0;
        if (len && len < slot) throw new Error(`${c.id}: phim ${len.toFixed(1)}s ngắn hơn slot ${slot.toFixed(2)}s`);
        // Default: the middle of the film (archival reels open on titles and leader).
        const start = Math.max(0, Math.min(e.start ?? (len - slot) / 2, Math.max(0, len - slot)));
        const pre = Math.min(HANDLE_S, start);
        const rawRel = path.join('ia', 'raw', `ia-${safe(c.id)}-${safe(path.basename(c.file.name, '.mp4'))}-${start.toFixed(1)}s.mp4`);
        const raw = path.join(p.dir, rawRel);
        if (!existsSync(raw)) {
          console.log(`Cắt Internet Archive ${c.id} từ ${start.toFixed(1)}s (${(pre + slot + HANDLE_S).toFixed(1)}s, không tải cả phim) …`);
          cutRemote(await resolveFileUrl(c.fileUrl), raw, start - pre, pre + slot + HANDLE_S, USER_AGENT);
        }
        const rel = e.bg ? path.join('ia', 'bg', `${e.scene}.mp4`) : path.join('visuals', chapter, `${scene}.mp4`);
        const fit = e.bg ? 'cover' : (e.fit ?? (c.file.width && c.file.height ? autoFit(c.file.width, c.file.height) : 'contain'));
        // The whole cut (with handles) framed to 1920×1080 once: render plays it as the scene source,
        // so the transition handles keep the same framing (a 4:3 film is never cropped to fill).
        const framedRel = rawRel.replace(/\.mp4$/, `-${fit}.mp4`);
        if (!existsSync(path.join(p.dir, framedRel))) normalizeClip(raw, path.join(p.dir, framedRel), Math.round((pre + slot + HANDLE_S) * FPS), 0, fit);
        normalizeClip(path.join(p.dir, framedRel), path.join(p.dir, rel), Math.round(slot * FPS), pre);
        const black = blackSeconds(path.join(p.dir, rel));
        const preview = path.join(p.dir, rel.replace(/\.mp4$/, '.jpg'));
        extractFrame(path.join(p.dir, rel), preview, slot / 2);
        edits.set(e.scene, (x) => {
          if (e.bg) {
            const spec = x.visual.spec as { bg?: Record<string, unknown> };
            spec.bg = { ...spec.bg, src: rel, start: 0 };
          } else {
            x.visual.asset = rel;
            x.visual.clip = { file: framedRel, start: pre };
            x.visual.status = 'ready';
          }
          x.visual.source = source;
        });
        notes.push(`${e.scene} ${e.bg ? 'nền ' : ''}← ${rel} (${c.file.width}x${c.file.height} ${fit}, từ ${start.toFixed(1)}s; ${c.license}; ${c.collectionName}) · xem ${path.relative(p.dir, preview)}`);
        if (black > 0.3) notes.push(`  ⚠ ${e.scene}: ${black.toFixed(1)}s khung đen (chuyển cảnh/đầu cuộn trong phim) — thử --start khác`);
      }
      if (/commercial|advertis/i.test(c.title)) notes.push(`  ${e.scene}: phim quảng cáo — có nhãn hiệu thật trên hình; chỉ dùng minh hoạ đúng thời kỳ, không gán cho thương hiệu khác`);
      if (c.collection === 'nasa') notes.push(`  ${e.scene}: NASA — soát frame: không logo NASA, không người nhận diện được trong ngữ cảnh quảng cáo`);
      if (!e.bg && s.visual.type !== 'archive') notes.push(`  ${e.scene}: đặt visual.type = "archive" (tư liệu → bắt buộc chú thích dữ kiện)`);
      if (!e.bg && !s.visual.caption?.title) notes.push(`  cần ghi visual.caption {title, detail}: tên + năm + nơi (xem ${c.url})`);
    } catch (err) {
      failed.push(`${e.scene}: ${err instanceof Error ? err.message : String(err)}`);
      if (/\b(429|503)\b/.test(String(err))) break; // blocked: stop instead of hammering the next items
    }
  }
  updateScenes(p, edits); // one locked write for the whole batch
  for (const n of notes) console.log(n);
  if (failed.length) throw new Error(`${failed.length} scene lỗi (các scene khác đã ghi):\n  ${failed.join('\n  ')}`);
}

/** Download still originals only (film is cut at pick time). Args: identifiers or scene ids with an IA source. */
export async function iaFetch(p: Project, args: string[], batchFile: string | undefined): Promise<void> {
  const picks: IAPick[] = batchFile
    ? readIAPicks(batchFile)
    : args.map((a) => {
        if (/^ch\d{2}_s\d{3}$/.test(a)) {
          const src = findScene(p, a).visual.source;
          if (typeof src === 'object' && src?.provider === 'internet_archive') return { scene: a, id: src.id, file: src.file, type: 'image' as const };
          throw new Error(`${a} chưa có nguồn Internet Archive — truyền identifier`);
        }
        return { scene: '', id: a, type: 'image' as const };
      });
  if (picks.length === 0) throw new Error('Cú pháp: cvm ia fetch <identifier|sceneId…> | --batch picks.json');
  const failed: string[] = [];
  for (const e of picks) {
    try {
      const c = await candidateFor(p, { ...e, type: e.type ?? 'image' });
      if (c.kind !== 'image') {
        console.log(`bỏ qua ${e.id}: phim được cắt lúc pick, không tải trước`);
        continue;
      }
      console.log(`ok      ${e.id} → ${path.relative(p.dir, await fetchImage(p, c))}`);
    } catch (err) {
      failed.push(`${e.id}: ${err instanceof Error ? err.message : String(err)}`);
      if (/\b(429|503)\b/.test(String(err))) break;
    }
  }
  if (failed.length) throw new Error(`Không tải được:\n  ${failed.join('\n  ')}`);
}
