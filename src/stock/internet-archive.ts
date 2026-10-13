// Internet Archive (archive.org): archival film and stills, only from a whitelist of collections whose
// public-domain status is documented (US federal works, donated newsreels, the Prelinger Archives…),
// verified in plans/reports/researcher-261013-internet-archive-report.md. Community uploads are never
// accepted: on archive.org anyone can upload anything with any label (a NASA 4K re-upload carries
// CC BY-NC-ND, an "Apollo 11" item says Public Domain Mark *and* "Fair Use Notice"), so an item must be
// a member of a whitelisted collection, outside every blacklisted one, and pass the licence/rights checks.
//
// Search: Advanced Search API (no key) → per item the Metadata API picks the best file. Every request,
// including file servers (dnNNN.*.archive.org), goes through the shared polite queue in media.ts.

import { politeBlock, politeTurn } from '../media.ts';

export const USER_AGENT = 'claude-video-master/0.1 (local video pipeline; +https://github.com/jhin1m/claude-video-master)';
const SEARCH = 'https://archive.org/advancedsearch.php';
const META = 'https://archive.org/metadata/';
/**
 * Archival film floor is 480p (user 2026-10-13: almost all pre-1970 film on IA is 480p 4:3; Pexels stays ≥ 1080p).
 * Film below SD_BELOW is framed whole over a blurred fill and rendered without Ken Burns (zooming softens it).
 */
export const MIN_VIDEO_HEIGHT = 480;
export const SD_BELOW = 720;
export const MIN_IMAGE_SIDE = 1200;
export const MAX_RESULTS = 10;
const META_CALLS = 20; // per search: metadata look-ups before giving up on more results

export type IAKind = 'video' | 'image';

/**
 * Collections searched, with the status every item inherits. An item's own `licenseurl`, when set,
 * must still be PD/CC0/CC BY/CC BY-SA (it can only narrow, never widen).
 */
export interface Collection {
  id: string; // case-sensitive (FedFlix ≠ fedflix)
  name: string;
  kinds: IAKind[];
  license: string;
  /** Items must carry their own PD/CC licenseurl (the collection mixes cleared and uncleared films). */
  needLicense: boolean;
  why: string;
}

export const COLLECTIONS: Collection[] = [
  { id: 'universal_newsreels', name: 'Universal Newsreels (NARA)', kinds: ['video'], license: 'Public Domain', needLicense: true, why: 'Bản tin 1929–1967; Universal tặng công chúng, NARA nhận "không hạn chế bản quyền" (1974); 595/611 item có licenseurl PD' },
  { id: 'FedFlix', name: 'FedFlix (US Government films)', kinds: ['video'], license: 'Public Domain (US Government work)', needLicense: true, why: 'Phim cơ quan chính phủ Mỹ qua NTIS + Public.Resource.Org; item có licenseurl PD/CC0' },
  { id: 'prelinger', name: 'Prelinger Archives', kinds: ['video'], license: 'Public Domain', needLicense: true, why: 'Prelinger FAQ: "nhiều phim KHÔNG phải public domain" → chỉ nhận item có CC PD dedication (~18%)' },
  { id: 'wwIIarchive', name: 'WWII Archive', kinds: ['video'], license: 'Public Domain', needLicense: true, why: 'Phim Thế chiến II (OWI, United News…) do thủ thư tuyển; người tuyển là user nên vẫn bắt buộc licenseurl' },
  { id: 'nasa', name: 'NASA', kinds: ['video', 'image'], license: 'Public Domain (US Government work)', needLicense: false, why: 'Tác phẩm cơ quan liên bang Mỹ (17 U.S.C. §105); ~95% item không có licenseurl; trừ logo NASA, người nhận diện được trong bối cảnh thương mại' },
];

/** User-upload sets: an item listed in any of these is rejected even if it is also in a whitelisted one. */
const BLACKLIST = ['opensource_movies', 'opensource', 'community', 'ourmedia', 'opensource_media', 'feature_films', 'classic_tv', 'classic_tv_commercials', 'commercials-from-50s', 'flickrcommons'];

export interface IAFile {
  name: string;
  format: string;
  width?: number;
  height?: number;
  length?: number; // seconds (video)
  size?: number;
}

export interface IACandidate {
  id: string;
  kind: IAKind;
  title: string;
  author: string;
  year: string;
  collection: string; // whitelisted collection id
  collectionName: string;
  license: string;
  licenseUrl: string | null;
  downloads: number;
  url: string; // item page
  file: IAFile;
  fileUrl: string;
}

/** Item licence on top of the collection's status: absent → inherit; PD mark/CC0/CC BY/CC BY-SA → ok; anything else → reject. */
export function licenseFromUrl(licenseurl: string | undefined): { ok: boolean; label?: string } {
  if (!licenseurl) return { ok: true };
  const u = licenseurl.toLowerCase();
  if (/by-nc|by-nd|\/nc\b|\/nd\b/.test(u)) return { ok: false };
  if (/creativecommons\.org\/publicdomain\/mark/.test(u)) return { ok: true, label: 'Public Domain Mark 1.0' };
  if (/creativecommons\.org\/(licenses\/)?publicdomain\/zero/.test(u)) return { ok: true, label: 'CC0 1.0' };
  // Retired CC Public Domain Dedication (2002–2010), what most Prelinger items still carry.
  if (/creativecommons\.org\/licenses\/publicdomain\/?$/.test(u)) return { ok: true, label: 'Public Domain (CC PD Dedication)' };
  const m = /creativecommons\.org\/licenses\/(by|by-sa)\/(\d\.\d)/.exec(u);
  if (m) return { ok: true, label: `CC ${m[1]!.toUpperCase()} ${m[2]}` };
  return { ok: false };
}

/** Rights/description text that contradicts a public-domain status. */
export const redFlag = (text: string) => /fair use|copyright(ed)?\s+(\d{4}|by|©)|©|all rights reserved|in copyright|permission required|licensed from|getty/i.test(text);

/**
 * First whitelisted collection of an item, unless it is also in a user-upload set. Lists also hold
 * thousands of `fav-<user>` bookmark sets, which say nothing about rights and are ignored.
 */
export function whitelisted(collections: string[] | string | undefined, kind: IAKind): Collection | undefined {
  const list = Array.isArray(collections) ? collections : collections ? [collections] : [];
  if (list.some((c) => BLACKLIST.includes(c) || c.startsWith('folkscanomy'))) return undefined;
  return COLLECTIONS.find((c) => c.kinds.includes(kind) && list.includes(c.id));
}

/** Best MP4 at least `minHeight` tall and long enough; originals preferred at equal height. */
export function pickVideoFile(files: IAFile[], minHeight: number, minLength: number): IAFile | undefined {
  return files
    .filter((f) => /\.mp4$/i.test(f.name) && (f.height ?? 0) >= minHeight && (f.length ?? 0) >= minLength)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || Number(/^h\.264$|^MPEG4$/i.test(b.format)) - Number(/^h\.264$|^MPEG4$/i.test(a.format)))[0];
}

/** Largest original JPEG/PNG; unknown size is kept (checked after download). */
export function pickImageFile(files: IAFile[]): IAFile | undefined {
  const imgs = files.filter((f) => /^(JPEG|PNG)$/i.test(f.format) && !/thumb|__ia_/i.test(f.name) && /\.(jpe?g|png)$/i.test(f.name));
  const side = (f: IAFile) => Math.max(f.width ?? 0, f.height ?? 0);
  const known = imgs.filter((f) => side(f) > 0);
  if (known.length) return known.filter((f) => side(f) >= MIN_IMAGE_SIDE).sort((a, b) => side(b) - side(a))[0];
  return imgs.sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
}

const BUSY_RETRIES_S = [6, 15, 40]; // archive.org overload shows as 502 HTML or 200 + {"error": "BACKEND_ERROR"} for minutes

async function api(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    await politeTurn(url);
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 429 || res.status === 503) {
      await res.body?.cancel();
      const wait = politeBlock(url, res.headers.get('retry-after'));
      throw new Error(`Internet Archive ${res.status}: gọi quá nhanh — dừng, chờ ${Math.round(wait / 1000)}s (Retry-After) rồi mới gọi lại.`);
    }
    const body = res.ok ? ((await res.json().catch(() => ({ error: 'non-JSON' }))) as { error?: string }) : (await res.body?.cancel(), undefined);
    const busy = res.status === 502 || res.status === 504 || (body && typeof body.error === 'string');
    if (!busy && res.ok) return body;
    if (!busy) throw new Error(`Internet Archive ${res.status}: ${url}`);
    if (attempt >= BUSY_RETRIES_S.length) throw new Error(`archive.org đang quá tải (${res.ok ? body?.error : res.status}) — thử lại sau vài phút`);
    console.warn(`⚠ archive.org bận (${res.ok ? body?.error : res.status}) — thử lại sau ${BUSY_RETRIES_S[attempt]}s …`);
    await new Promise((r) => setTimeout(r, BUSY_RETRIES_S[attempt]! * 1000));
  }
}

const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));
/** `length` comes as seconds ("152.3") or as "mm:ss" / "h:mm:ss". */
const seconds = (v: unknown) => {
  if (v == null || v === '') return undefined;
  const parts = String(v).split(':').map(Number);
  return parts.some((x) => !Number.isFinite(x)) ? undefined : parts.reduce((a, b) => a * 60 + b, 0);
};
const text = (v: unknown) => (Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();

interface RawMeta {
  metadata?: Record<string, unknown>;
  files?: { name: string; format?: string; width?: string; height?: string; length?: string; size?: string }[];
}

async function metadata(id: string): Promise<RawMeta> {
  const m = (await api(`${META}${encodeURIComponent(id)}`)) as RawMeta;
  if (!m.metadata || Object.keys(m.metadata).length === 0) throw new Error(`Internet Archive: không có item "${id}" (hoặc bị chặn theo vùng)`);
  return m;
}

/**
 * Turn an item's metadata into a candidate, or say why not. `file` forces a file name (pick).
 * The collection, licence and rights checks run on the authoritative metadata, not the search hit.
 */
export function toCandidate(id: string, m: RawMeta, kind: IAKind, opts: { minHeight: number; minLength: number; file?: string; downloads?: number }): IACandidate | string {
  const md = m.metadata ?? {};
  const col = whitelisted(md.collection as string[] | string | undefined, kind);
  if (!col) return 'không thuộc collection trong danh sách trắng';
  const lic = licenseFromUrl(text(md.licenseurl) || undefined);
  if (!lic.ok) return `giấy phép riêng "${text(md.licenseurl)}" không cho dùng lại`;
  if (col.needLicense && !lic.label) return `${col.id}: item không có licenseurl PD/CC (collection này bắt buộc)`;
  if (redFlag(text(md.rights))) return `rights: "${text(md.rights).slice(0, 80)}"`;
  if (/getty|licensed from/i.test(text(md.description))) return 'mô tả nhắc tư liệu có bản quyền bên thứ ba';
  if (md.geo_restricted != null && text(md.geo_restricted) !== 'false') return 'bị giới hạn theo vùng';
  const files: IAFile[] = (m.files ?? []).map((f) => ({ name: f.name, format: f.format ?? '', width: num(f.width), height: num(f.height), length: seconds(f.length), size: num(f.size) }));
  const file = opts.file
    ? files.find((f) => f.name === opts.file)
    : kind === 'video'
      ? pickVideoFile(files, opts.minHeight, opts.minLength)
      : pickImageFile(files);
  if (!file) return opts.file ? `không có file "${opts.file}"` : kind === 'video' ? `không có MP4 ≥ ${opts.minHeight}p đủ dài` : `không có ảnh JPEG/PNG ≥ ${MIN_IMAGE_SIDE}px`;
  return {
    id,
    kind,
    title: text(md.title) || id,
    author: text(md.creator) || col.name,
    year: /\d{4}/.exec(text(md.year))?.[0] ?? /\d{4}/.exec(text(md.date))?.[0] ?? '',
    collection: col.id,
    collectionName: col.name,
    license: lic.label ?? col.license,
    licenseUrl: lic.label ? text(md.licenseurl) : null,
    downloads: opts.downloads ?? 0,
    url: `https://archive.org/details/${id}`,
    file,
    fileUrl: `https://archive.org/download/${encodeURIComponent(id)}/${file.name.split('/').map(encodeURIComponent).join('/')}`,
  };
}

export interface SearchResult {
  candidates: IACandidate[];
  rejected: { id: string; why: string }[];
  hits: number;
}

/** Search the whitelisted collections, most-downloaded first; at most MAX_RESULTS that pass every check. */
export async function search(query: string, kind: IAKind, opts: { minHeight: number; minLength: number; collection?: string }): Promise<SearchResult> {
  const cols = COLLECTIONS.filter((c) => c.kinds.includes(kind) && (!opts.collection || c.id === opts.collection));
  if (cols.length === 0) throw new Error(`Collection "${opts.collection}" không nằm trong danh sách trắng cho ${kind}: ${COLLECTIONS.filter((c) => c.kinds.includes(kind)).map((c) => c.id).join(', ')}`);
  const q = `(${query}) AND mediatype:(${kind === 'video' ? 'movies' : 'image'}) AND collection:(${cols.map((c) => c.id).join(' OR ')})`;
  const params = new URLSearchParams({ q, rows: '50', output: 'json' });
  for (const f of ['identifier', 'downloads', 'licenseurl']) params.append('fl[]', f);
  params.append('sort[]', 'downloads desc');
  const data = (await api(`${SEARCH}?${params}`)) as { response?: { numFound: number; docs: { identifier: string; downloads?: number; licenseurl?: string }[] } };
  const docs = data.response?.docs ?? [];
  const candidates: IACandidate[] = [];
  const rejected: { id: string; why: string }[] = [];
  let calls = 0;
  const seen = new Set<string>();
  for (const d of docs) {
    if (candidates.length >= MAX_RESULTS || calls >= META_CALLS) break;
    if (!licenseFromUrl(d.licenseurl).ok) {
      rejected.push({ id: d.identifier, why: `giấy phép "${d.licenseurl}"` });
      continue;
    }
    calls++;
    const c = toCandidate(d.identifier, await metadata(d.identifier), kind, { ...opts, downloads: d.downloads });
    if (typeof c === 'string') rejected.push({ id: d.identifier, why: c });
    else if (seen.has(`${c.title.toLowerCase()}|${c.year}`)) rejected.push({ id: d.identifier, why: 'bản trùng (cùng tên + năm)' });
    else {
      seen.add(`${c.title.toLowerCase()}|${c.year}`);
      candidates.push(c);
    }
  }
  return { candidates, rejected, hits: data.response?.numFound ?? 0 };
}

/** One item for `pick`: re-checked from its metadata (search results may be stale or hand-typed ids). */
export async function getCandidate(id: string, kind: IAKind, opts: { minHeight: number; minLength: number; file?: string }): Promise<IACandidate> {
  const c = toCandidate(id, await metadata(id), kind, opts);
  if (typeof c === 'string') throw new Error(`Internet Archive ${id}: ${c}`);
  return c;
}

/**
 * archive.org/download/… redirects to a file server; ffmpeg seeking over HTTP needs that final URL
 * (it re-requests byte ranges, and a redirect on every range request fails mid-stream).
 */
export async function resolveFileUrl(url: string): Promise<string> {
  await politeTurn(url);
  const res = await fetch(url, { method: 'HEAD', redirect: 'manual', headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 429 || res.status === 503) {
    const wait = politeBlock(url, res.headers.get('retry-after'));
    throw new Error(`Internet Archive ${res.status} — chờ ${Math.round(wait / 1000)}s rồi thử lại`);
  }
  const loc = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && loc) return new URL(loc, url).toString();
  if (res.ok) return url;
  throw new Error(`Internet Archive ${res.status}: ${url}`);
}
