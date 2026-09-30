// ffmpeg / ffprobe helpers and downloads. Local ffmpeg has no drawtext/libass,
// so text never gets drawn here — only audio/video stitching.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { withFileLock } from './lock.ts';
import { PROJECTS_DIR, readJson, slotSeconds, writeJsonAtomic, type Scene } from './project.ts';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
const SAMPLE_RATE = 48000;

export function run(cmd: string, args: string[], opts: { cwd?: string; inherit?: boolean } = {}): string {
  const res = spawnSync(cmd, args, { cwd: opts.cwd, encoding: 'utf8', stdio: opts.inherit ? 'inherit' : 'pipe', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const tail = (res.stderr ?? '').split('\n').slice(-15).join('\n');
    throw new Error(`${cmd} thoát với mã ${res.status}\n${tail}`);
  }
  return res.stdout ?? '';
}

/** Async `run` for long jobs that run side by side (HyperFrames renders); output lines get `prefix`. */
export function runAsync(cmd: string, args: string[], prefix = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(out);
      const tail = err.split('\n').slice(-15).map((l) => prefix + l).join('\n');
      reject(new Error(`${prefix}${cmd} thoát với mã ${code}\n${tail}`));
    });
  });
}

const ffmpeg = (args: string[]) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

export function probeDuration(file: string): number {
  const out = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).trim();
  const d = Number(out);
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe không đọc được duration: ${file}`);
  return d;
}

/**
 * Hosts that block bursts: one download every gap + random jitter, shared by every cvm process
 * (Wikimedia answered a burst of 40 files with 429 and `retry-after: 600`).
 */
const POLITE_HOSTS: Record<string, { gapMs: number; jitterMs: number }> = {
  'upload.wikimedia.org': { gapMs: 5000, jitterMs: 3000 },
};
const MAX_WAIT_MS = 15 * 60_000; // a longer Retry-After stops the command instead of sleeping silently
const MAX_429 = 2;

interface HostState {
  next: number; // earliest start of the next download (ms epoch)
  blockedUntil?: number; // set on 429: every process waits until then
}
const hostStateFile = (host: string) => path.join(PROJECTS_DIR, '.throttle', `${host}.json`);

function readHost(file: string): HostState {
  return existsSync(file) ? readJson<HostState>(file) : { next: 0 };
}

/** Reserve the next download slot for `host`; returns how long to wait before starting it. */
function reserveSlot(host: string, rule: { gapMs: number; jitterMs: number }): number {
  const file = hostStateFile(host);
  mkdirSync(path.dirname(file), { recursive: true });
  return withFileLock(file, () => {
    const st = readHost(file);
    const now = Date.now();
    const at = Math.max(now, st.next, st.blockedUntil ?? 0);
    if (at - now > MAX_WAIT_MS) throw new Error(`${host} đang chặn tải đến ${new Date(at).toLocaleTimeString('vi-VN')} (429) — thử lại sau`);
    writeJsonAtomic(file, { ...st, next: at + rule.gapMs + Math.random() * rule.jitterMs });
    return at - now;
  });
}

function blockHost(host: string, until: number): void {
  const file = hostStateFile(host);
  withFileLock(file, () => {
    const st = readHost(file);
    writeJsonAtomic(file, { ...st, blockedUntil: Math.max(st.blockedUntil ?? 0, until) });
  });
}

/** Retry-After: seconds or an HTTP date; missing → 60 s. */
function retryAfterMs(v: string | null): number {
  if (!v) return 60_000;
  const sec = Number(v);
  if (Number.isFinite(sec)) return Math.max(0, sec * 1000);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 60_000;
}

/**
 * Download to `dest` (via `dest.part`, so an interrupted transfer never looks finished).
 * Polite hosts are spaced out; 429 waits for Retry-After, then tries once more — never a retry burst.
 */
export async function download(url: string, dest: string, headers: Record<string, string> = {}): Promise<{ contentType: string }> {
  const { host, pathname } = new URL(url);
  const rule = POLITE_HOSTS[host];
  for (let hits = 0; ; ) {
    if (rule) {
      const wait = reserveSlot(host, rule);
      if (wait > 0) await sleep(wait);
    }
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      await res.body?.cancel();
      const wait = retryAfterMs(res.headers.get('retry-after'));
      if (rule) blockHost(host, Date.now() + wait);
      if (++hits > MAX_429 || wait > MAX_WAIT_MS) throw new Error(`${host} 429 (Retry-After ${Math.round(wait / 1000)}s) — dừng tải, thử lại sau`);
      console.warn(`⚠ ${host} 429 — dừng tải, chờ ${Math.round(wait / 1000)}s theo Retry-After …`);
      if (!rule) await sleep(wait); // polite hosts wait in reserveSlot (blockedUntil)
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`Tải thất bại ${res.status}: ${host}${pathname}`);
    mkdirSync(path.dirname(dest), { recursive: true });
    const part = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(part));
    renameSync(part, dest);
    return { contentType: res.headers.get('content-type') ?? '' };
  }
}

export interface Timing {
  id: string;
  start: number; // slot start on the chapter timeline
  speechEnd: number; // start + audio.duration
  end: number; // start + audio.duration + pause
}

export function chapterTimings(scenes: Scene[]): Timing[] {
  let t = 0;
  return scenes.map((s) => {
    const start = t;
    t += slotSeconds(s);
    return { id: s.id, start, speechEnd: start + s.audio.duration!, end: t };
  });
}

/**
 * Chapter voice track: each scene padded with silence and trimmed to exactly its slot,
 * then PCM-concatenated so the track length is exactly Σ(duration + pause).
 */
export function buildChapterAudio(projectDir: string, scenes: Scene[], outWav: string, workDir: string, exactSeconds?: number): void {
  mkdirSync(workDir, { recursive: true });
  const list: string[] = [];
  scenes.forEach((s, i) => {
    const seg = path.join(workDir, `a${String(i).padStart(3, '0')}.wav`);
    ffmpeg(['-i', path.join(projectDir, s.audio.path!), '-af', `apad,atrim=end=${slotSeconds(s).toFixed(6)}`, '-ar', String(SAMPLE_RATE), '-ac', '2', '-c:a', 'pcm_s16le', seg]);
    list.push(`file '${seg}'`);
  });
  const listFile = path.join(workDir, 'audio-list.txt');
  writeFileSync(listFile, list.join('\n') + '\n');
  if (exactSeconds == null) {
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outWav]);
  } else {
    // Snap the track to a frame boundary so it matches the frame-rounded picture exactly.
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-af', `apad,atrim=end=${exactSeconds.toFixed(6)}`, '-c:a', 'pcm_s16le', outWav]);
  }
}

const VIDEO_NORMALIZE = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},fps=${FPS},format=yuv420p,setsar=1`;
const X264 = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p'];

/** Cut a clip to exactly `frames` at 1920×1080/30fps, no audio. Short clips hold their last frame. */
export function normalizeClip(input: string, output: string, frames: number, startAt = 0): void {
  mkdirSync(path.dirname(output), { recursive: true });
  const isImage = /\.(png|jpe?g|webp)$/i.test(input);
  const inputArgs = isImage ? ['-loop', '1', '-i', input] : ['-ss', startAt.toFixed(3), '-i', input];
  const vf = isImage ? VIDEO_NORMALIZE : `${VIDEO_NORMALIZE},tpad=stop_mode=clone:stop_duration=${Math.ceil(frames / FPS) + 1}`;
  ffmpeg([...inputArgs, '-vf', vf, '-frames:v', String(frames), '-an', ...X264, output]);
}

/**
 * Archival still → 1920×1080 JPEG. Near-16:9 images are cropped to fill (`cover`); portrait pages,
 * engravings and strips are fitted whole over a blurred, darkened copy of themselves (`contain`),
 * so nothing important is cropped away and Ken Burns never reveals black bars.
 */
export function frameStill(input: string, output: string, fit: 'cover' | 'contain'): void {
  mkdirSync(path.dirname(output), { recursive: true });
  const fill = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`;
  const graph =
    fit === 'cover'
      ? `[0:v]${fill},format=yuvj420p[v]`
      : `[0:v]split[a][b];[a]${fill},gblur=sigma=40,eq=brightness=-0.22:saturation=0.55[bg];` +
        `[b]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuvj420p[v]`;
  ffmpeg(['-i', input, '-filter_complex', graph, '-map', '[v]', '-frames:v', '1', '-q:v', '2', output]);
}

export function extractFrame(input: string, output: string, atSeconds: number): void {
  ffmpeg(['-ss', atSeconds.toFixed(3), '-i', input, '-frames:v', '1', '-q:v', '3', output]);
}

/** Drop trailing frames beyond `frames` without re-encoding (a renderer may round the length up). */
export function trimToFrames(file: string, frames: number): void {
  const count = Number(run('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file]).trim());
  if (count <= frames) return;
  const tmp = file.replace(/\.mp4$/, '.trim.mp4');
  ffmpeg(['-i', file, '-map', '0', '-frames:v', String(frames), '-c', 'copy', tmp]);
  renameSync(tmp, file);
}

/** Decode a rendered chapter's mixed audio to PCM WAV of exactly `seconds` (what `cvm final` concatenates). */
export function audioToWav(input: string, outWav: string, seconds: number): void {
  ffmpeg(['-i', input, '-vn', '-af', `apad,atrim=end=${seconds.toFixed(6)}`, '-ar', String(SAMPLE_RATE), '-ac', '2', '-c:a', 'pcm_s16le', outWav]);
}

/**
 * Join chapters: video streams are stream-copied, audio is rebuilt from the chapter WAVs
 * (concatenating AAC would insert encoder-priming gaps at every chapter boundary).
 */
export function concatChapters(videos: string[], wavs: string[], output: string, workDir: string): void {
  mkdirSync(workDir, { recursive: true });
  const vList = path.join(workDir, 'final-video-list.txt');
  const aList = path.join(workDir, 'final-audio-list.txt');
  writeFileSync(vList, videos.map((f) => `file '${f}'`).join('\n') + '\n');
  writeFileSync(aList, wavs.map((f) => `file '${f}'`).join('\n') + '\n');
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', vList, '-f', 'concat', '-safe', '0', '-i', aList, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
}
