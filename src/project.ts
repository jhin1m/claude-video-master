// Project layout, manifest types and atomic manifest I/O.
// manifest.json is the single source of truth for every scene. Every write is a locked
// read-modify-write (updateManifest), so parallel cvm commands and hand edits made while a
// command runs are never overwritten by a stale in-memory copy.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { withFileLock } from './lock.ts';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const PROJECTS_DIR = path.join(ROOT, 'projects');
const CURRENT_FILE = path.join(PROJECTS_DIR, '.current');

export const VISUAL_TYPES = ['animation', 'ai_image', 'ai_video', 'stock', 'archive', 'text_card'] as const;
export type VisualType = (typeof VISUAL_TYPES)[number];

export interface StockSource {
  provider: 'pexels';
  id: number;
  url: string;
  author: string;
  authorUrl: string;
}

/** Wikimedia Commons still: license + author are what the credits need (CC BY/BY-SA require attribution). */
export interface ArchiveSource {
  provider: 'wikimedia';
  id: number; // Commons pageid
  title: string;
  url: string; // file description page
  author: string;
  license: string;
  licenseUrl: string | null;
}

export interface Scene {
  id: string; // ch02_s004
  chapter: number;
  narration: string;
  audio: { path: string | null; duration: number | null; pauseAfterMs: number };
  visual: {
    type: VisualType;
    intent: string;
    prompt: string;
    source: StockSource | ArchiveSource | string | null;
    /** Extra credited sources when one scene shows several works (e.g. a montage of Commons stills). */
    sources?: (StockSource | ArchiveSource)[];
    asset: string | null; // path relative to the project dir
    /** Stock only: the untrimmed download and where the scene's cut starts in it (lets render add transition handles). */
    clip?: { file: string; start: number };
    status: 'todo' | 'ready';
    spec?: unknown; // graphic template data for animation/text_card (see src/graphics/templates.ts)
    /**
     * Fact label drawn over the picture (lower third): who/what it is, with years and place.
     * Required for `archive` stills so viewers know what the document shows.
     */
    caption?: { title: string; detail?: string };
  };
  hash: string | null; // hash of the audio currently on disk; null = never synthesized
}

/** Archive stills must name what they show (user rule 2026-09-30); returns the scenes still missing a caption. */
export function missingCaptions(scenes: Scene[]): Scene[] {
  return scenes.filter((s) => s.visual.type === 'archive' && !s.visual.caption?.title?.trim());
}

export interface Manifest {
  slug: string;
  tts: { voice: string | null; speed: number; emotion: string };
  scenes: Scene[];
}

export interface Project {
  slug: string;
  dir: string;
  manifestPath: string;
  manifest: Manifest;
}

/** Scene hash: re-synthesize only when one of these inputs changes. */
export function sceneHash(narration: string, voice: string, speed: number, emotion: string): string {
  return createHash('sha256').update(JSON.stringify([narration, voice, speed, emotion])).digest('hex');
}

export function chapterTag(chapter: number): string {
  return `ch${String(chapter).padStart(2, '0')}`;
}

/** ch02_s004 → { chapter: "ch02", scene: "s004" } */
export function splitSceneId(id: string): { chapter: string; scene: string } {
  const m = /^(ch\d{2})_(s\d{3})$/.exec(id);
  if (!m) throw new Error(`Scene id sai định dạng (cần chNN_sNNN): ${id}`);
  return { chapter: m[1]!, scene: m[2]! };
}

/** Seconds a scene occupies on the timeline: speech + trailing pause. */
export function slotSeconds(scene: Scene): number {
  if (scene.audio.duration == null) throw new Error(`${scene.id} chưa có audio — chạy cvm tts trước`);
  return scene.audio.duration + scene.audio.pauseAfterMs / 1000;
}

export function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, file);
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function setCurrent(slug: string): void {
  mkdirSync(PROJECTS_DIR, { recursive: true });
  writeFileSync(CURRENT_FILE, slug + '\n');
}

export function loadProject(slugArg?: string): Project {
  const slug = slugArg ?? (existsSync(CURRENT_FILE) ? readFileSync(CURRENT_FILE, 'utf8').trim() : '');
  if (!slug) throw new Error('Chưa chọn project: chạy `cvm init <slug>` hoặc truyền --project <slug>');
  const dir = path.join(PROJECTS_DIR, slug);
  const manifestPath = path.join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`Không thấy ${path.relative(ROOT, manifestPath)}`);
  const manifest = readJson<Manifest>(manifestPath);
  validateManifest(manifest);
  return { slug, dir, manifestPath, manifest };
}

/**
 * Locked read-modify-write: re-read manifest.json from disk, apply `mutate` to that fresh copy,
 * validate, write atomically. `p.manifest` becomes the written copy (older Scene references go stale).
 */
export function updateManifest(p: Project, mutate: (m: Manifest) => void): void {
  withFileLock(p.manifestPath, () => {
    const fresh = readJson<Manifest>(p.manifestPath);
    mutate(fresh);
    validateManifest(fresh);
    writeJsonAtomic(p.manifestPath, fresh);
    p.manifest = fresh;
  });
}

/** Scene id → change to apply; all applied in one locked write. */
export type SceneEdits = Map<string, (s: Scene) => void>;

export function updateScenes(p: Project, edits: SceneEdits): void {
  if (edits.size === 0) return;
  updateManifest(p, (m) => {
    for (const [id, edit] of edits) {
      const s = m.scenes.find((x) => x.id === id);
      if (!s) throw new Error(`${id} không còn trong manifest.json (bị xoá trong lúc lệnh chạy?)`);
      edit(s);
    }
  });
}

export function updateScene(p: Project, id: string, edit: (s: Scene) => void): void {
  updateScenes(p, new Map([[id, edit]]));
}

export function chapterScenes(p: Project, chapter: number): Scene[] {
  const scenes = p.manifest.scenes.filter((s) => s.chapter === chapter);
  if (scenes.length === 0) throw new Error(`Chapter ${chapter} không có scene nào trong manifest`);
  return scenes;
}

export function chapters(p: Project): number[] {
  return [...new Set(p.manifest.scenes.map((s) => s.chapter))].sort((a, b) => a - b);
}

/** Structural rules from the pipeline contract; fail loudly before spending anything. */
function validateManifest(m: Manifest): void {
  const ids = new Set<string>();
  for (const s of m.scenes) {
    const { chapter } = splitSceneId(s.id);
    if (chapter !== chapterTag(s.chapter)) throw new Error(`${s.id}: chapter=${s.chapter} không khớp id`);
    if (ids.has(s.id)) throw new Error(`Scene id trùng: ${s.id}`);
    ids.add(s.id);
    if (!VISUAL_TYPES.includes(s.visual.type)) throw new Error(`${s.id}: visual.type không hợp lệ: ${s.visual.type}`);
  }
}

/** Soft rules (warnings): narration length and ai_video share. */
export function manifestWarnings(m: Manifest): string[] {
  const out: string[] = [];
  for (const s of m.scenes) {
    if ([...s.narration].length < 60) out.push(`${s.id}: narration < 60 ký tự (VieNeu tính tối thiểu 50/request)`);
  }
  const aiVideo = m.scenes.filter((s) => s.visual.type === 'ai_video').length;
  if (m.scenes.length > 0 && aiVideo / m.scenes.length > 0.15) {
    out.push(`ai_video = ${aiVideo}/${m.scenes.length} scene (> 15%)`);
  }
  return out;
}
