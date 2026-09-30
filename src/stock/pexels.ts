// Pexels Videos API (https://www.pexels.com/api/documentation/#videos).
// Auth: `Authorization: <PEXELS_API_KEY>`. Limits: 200 req/hour, 20k/month by default.

const BASE = 'https://api.pexels.com/videos';

export interface PexelsFile {
  quality: string | null;
  file_type: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: { name: string; url: string };
  video_files: PexelsFile[];
}

function apiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('Thiếu PEXELS_API_KEY trong .env');
  return key;
}

async function get<T>(route: string): Promise<T> {
  const res = await fetch(BASE + route, { headers: { Authorization: apiKey() } });
  if (res.status === 429) throw new Error('Pexels 429: hết hạn mức request (200/giờ). Thử lại sau.');
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return (await res.json()) as T;
}

/** Landscape, at least Full HD ("medium" in Pexels terms). */
export async function searchVideos(query: string, perPage = 15): Promise<PexelsVideo[]> {
  const q = new URLSearchParams({ query, orientation: 'landscape', size: 'medium', per_page: String(perPage) });
  const data = await get<{ videos: PexelsVideo[] }>(`/search?${q}`);
  return data.videos;
}

export async function getVideo(id: number): Promise<PexelsVideo> {
  return get<PexelsVideo>(`/videos/${id}`);
}

/** Smallest MP4 rendition that is still ≥ 1920 wide (avoid pulling 4K for a 1080p edit). */
export function bestFile(v: PexelsVideo): PexelsFile | undefined {
  const mp4 = v.video_files.filter((f) => f.file_type === 'video/mp4' && f.width && f.height && f.width >= f.height);
  const fullHd = mp4.filter((f) => f.width! >= 1920).sort((a, b) => a.width! - b.width!);
  return fullHd[0] ?? mp4.sort((a, b) => b.width! - a.width!)[0];
}
