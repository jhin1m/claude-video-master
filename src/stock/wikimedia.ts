// Wikimedia Commons media search (https://commons.wikimedia.org/w/api.php) for archival stills:
// manuscripts, engravings, historical photos. No key; Wikimedia asks for a descriptive User-Agent.

const API = 'https://commons.wikimedia.org/w/api.php';
export const USER_AGENT = 'claude-video-master/0.1 (local video pipeline; Node fetch)';
const MIN_LONG_SIDE = 800; // smaller scans look mushy at 1080p even with the blurred-fill frame
const THUMB_WIDTH = 1920; // a standard Wikimedia thumb step (non-standard widths/originals get rate-limited); fills the 1920×1080 frame

export interface CommonsImage {
  pageid: number;
  title: string; // "File:Digesting Duck.jpg"
  width: number;
  height: number;
  mime: string;
  downloadUrl: string; // thumb ≤ THUMB_WIDTH wide, JPEG/PNG
  pageUrl: string;
  license: string;
  licenseUrl: string | null;
  author: string;
  attributionRequired: boolean;
}

interface RawPage {
  pageid: number;
  title: string;
  index: number;
  imageinfo?: {
    width: number;
    height: number;
    mime: string;
    url: string;
    thumburl?: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

/** Commons metadata values are HTML fragments ("<a href=…>Name</a>"). */
function plain(html: string | undefined): string {
  return (html ?? '')
    .replace(/<(\w+)[^>]*display:\s*none[^>]*>.*?<\/\1>/gs, '') // hidden duplicates ("Unknown author<span hidden>Unknown author</span>")
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reusable in a monetized video: public domain, CC0, CC BY, CC BY-SA.
 * Commons forbids NC/ND uploads, but the check stays explicit so a mislabelled file cannot slip through.
 */
export function licenseOk(license: string): boolean {
  if (/\b(nc|nd)\b|non-?commercial|no-?deriv/i.test(license)) return false;
  return /public domain|^pd\b|cc0|cc[- ]by/i.test(license);
}

async function api(params: Record<string, string>): Promise<unknown> {
  const q = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const res = await fetch(`${API}?${q}`, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status === 429) throw new Error(`Wikimedia 429: gọi quá nhanh — dừng, chờ ${res.headers.get('retry-after') ?? '60'}s (Retry-After) rồi mới gọi lại.`);
  if (!res.ok) throw new Error(`Wikimedia ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.json();
}

function toImage(p: RawPage): CommonsImage | null {
  const ii = p.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {};
  return {
    pageid: p.pageid,
    title: p.title,
    width: ii.width,
    height: ii.height,
    mime: ii.mime,
    downloadUrl: ii.thumburl ?? ii.url,
    pageUrl: ii.descriptionurl,
    license: plain(meta.LicenseShortName?.value) || plain(meta.UsageTerms?.value) || 'unknown',
    licenseUrl: plain(meta.LicenseUrl?.value) || null,
    author: plain(meta.Artist?.value) || 'Unknown author',
    attributionRequired: meta.AttributionRequired?.value !== 'false',
  };
}

const IMAGE_PROPS = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: String(THUMB_WIDTH),
  iiextmetadatafilter: 'LicenseShortName|LicenseUrl|UsageTerms|Artist|AttributionRequired',
};

/** Still images (no GIF/SVG) in search-rank order; license/size filtering is left to the caller so it can report what was dropped. */
export async function searchImages(query: string, limit = 30): Promise<CommonsImage[]> {
  const data = (await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    ...IMAGE_PROPS,
  })) as { query?: { pages?: RawPage[] } };
  const pages = (data.query?.pages ?? []).sort((a, b) => a.index - b.index);
  return pages.map(toImage).filter((x): x is CommonsImage => x != null && /^image\/(jpeg|png|tiff|webp)$/.test(x.mime));
}

export async function getImage(pageid: number): Promise<CommonsImage> {
  const data = (await api({ action: 'query', pageids: String(pageid), ...IMAGE_PROPS })) as { query?: { pages?: RawPage[] } };
  const img = data.query?.pages?.[0] ? toImage(data.query.pages[0]) : null;
  if (!img) throw new Error(`Wikimedia: không thấy file pageid ${pageid}`);
  return img;
}

export const bigEnough = (img: CommonsImage) => Math.max(img.width, img.height) >= MIN_LONG_SIDE;
