// cvm asset set <sceneId> <path> — register a finished visual (HyperFrames render, Higgsfield download…).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { probeDuration } from '../media.ts';
import { readJson, slotSeconds, updateScene, type Project, type Scene } from '../project.ts';

export function findScene(p: Project, id: string | undefined): Scene {
  const s = p.manifest.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Không có scene ${id ?? '(thiếu sceneId)'} trong manifest`);
  return s;
}

/** One entry of a `--batch picks.json` file (`stock pick` / `archive pick` / `archive fetch`). */
export interface PickEntry {
  scene: string;
  id: number; // Pexels video id | Commons pageid
  start?: number; // stock: seconds into the clip
  bg?: boolean; // stock: background of a graphic scene
  fit?: 'cover' | 'contain'; // archive
}

export function readPicks(file: string): PickEntry[] {
  const list = readJson<unknown>(path.resolve(file));
  if (!Array.isArray(list) || list.length === 0) throw new Error(`${file}: cần mảng [{ "scene": "ch01_s001", "id": 123, … }]`);
  return list.map((x, i) => {
    const e = x as PickEntry;
    if (typeof e?.scene !== 'string' || !Number.isInteger(e.id)) throw new Error(`${file}[${i}]: thiếu "scene" hoặc "id" (số nguyên)`);
    return e;
  });
}

/** Up-front check for a batch: every scene exists and appears once (so nothing is half-applied later). */
export function checkPicks(p: Project, picks: PickEntry[]): void {
  const seen = new Set<string>();
  for (const e of picks) {
    findScene(p, e.scene);
    if (seen.has(e.scene)) throw new Error(`${e.scene} xuất hiện hai lần trong batch`);
    seen.add(e.scene);
  }
}

export function assetSet(p: Project, sceneId: string | undefined, file: string | undefined): void {
  const s = findScene(p, sceneId);
  if (!file) throw new Error('Cú pháp: cvm asset set <sceneId> <path>');
  const abs = path.resolve(file);
  if (!existsSync(abs)) throw new Error(`Không thấy file: ${file}`);
  const rel = path.relative(p.dir, abs);
  if (rel.startsWith('..')) throw new Error(`Asset phải nằm trong ${p.dir} (ví dụ visuals/chNN/)`);

  if (/\.(mp4|mov|webm|mkv)$/i.test(abs) && s.audio.duration != null) {
    const d = probeDuration(abs);
    const slot = slotSeconds(s);
    if (d + 0.01 < slot) console.warn(`⚠ ${s.id}: clip ${d.toFixed(2)}s ngắn hơn slot ${slot.toFixed(2)}s — render sẽ giữ frame cuối`);
  }
  updateScene(p, s.id, (x) => {
    x.visual.asset = rel;
    x.visual.status = 'ready';
  });
  console.log(`${s.id} ← ${rel}`);
}
