// VieNeu Cloud API adapter (async jobs). Contract: docs/vieneu-openapi.json + overview page.
// Never log the API key.
import type { CostEstimate, TtsProvider, TtsRequest, TtsResult } from './provider.ts';

const BASE = 'https://api.vieneu.io/api/v1';
const ENGINE = 'v4';
const MIN_BILLED_CHARS = 50; // VieNeu bills at least 50 characters per request
const POLL_BATCH = 50; // GET /tts?ids= accepts at most 50 ids
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

interface EnginesResponse {
  globalMultiplier: number;
  engines: { key: string; isDefault: boolean; billingMultiplier: number }[];
}
interface VoicesResponse {
  voices: { id: string; name: string; gender: string; region: string | null }[];
}
interface SubmitResponse {
  jobId: string;
  status: 'queued' | 'completed';
  audioUrl?: string;
}
interface StatusEntry {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  audioUrl?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class VieneuApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  constructor(status: number, message: string, code: string | undefined, requestId: string | null) {
    super(`VieNeu ${status}${code ? ` ${code}` : ''}: ${message}${requestId ? ` (X-Request-Id ${requestId})` : ''}`);
    this.status = status;
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env.VIENEU_API_KEY;
  if (!key) throw new Error('Thiếu VIENEU_API_KEY trong .env');
  return key;
}

/**
 * One HTTP call with retries for transient failures. Retrying a POST is only safe
 * because every submit carries an Idempotency-Key.
 */
async function call<T>(method: 'GET' | 'POST', route: string, opts: { body?: unknown; headers?: Record<string, string>; auth?: boolean } = {}): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.auth !== false) headers.Authorization = `Bearer ${apiKey()}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(BASE + route, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) throw err;
      await sleep(1000 * attempt); // connection reset / DNS hiccup
      continue;
    }
    if (res.ok) return { data: (await res.json()) as T, headers: res.headers };

    let payload: { message?: string | string[]; code?: string } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      /* bare edge error page */
    }
    // 429 (rate window), 409 IDEMPOTENCY_IN_FLIGHT, 5xx (edge / no worker) are transient.
    // Quota refusals (GRANT_*) are not: waiting a few seconds will not help.
    const quota = payload.code?.startsWith('GRANT_') ?? false;
    const transient = !quota && (res.status === 429 || res.status === 409 || res.status >= 500);
    if (transient && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * attempt);
      continue;
    }
    const msg = Array.isArray(payload.message) ? payload.message.join('; ') : (payload.message ?? res.statusText);
    throw new VieneuApiError(res.status, msg, payload.code, res.headers.get('x-request-id'));
  }
}

export const vieneu: TtsProvider = {
  name: 'vieneu',

  async estimate(requests: TtsRequest[]): Promise<CostEstimate> {
    const { data } = await call<EnginesResponse>('GET', '/engines', { auth: false });
    const engine = data.engines.find((e) => e.key === ENGINE);
    if (!engine) throw new Error(`Engine ${ENGINE} không còn trong GET /engines`);
    const rate = engine.billingMultiplier * data.globalMultiplier;
    const perRequest = requests.map((r) => Math.max(MIN_BILLED_CHARS, [...r.text].length));
    const billedChars = perRequest.reduce((a, b) => a + b, 0);
    // The server rounds each request up separately (verified: 5 requests, 436 chars → 1702 tokens).
    const tokens = perRequest.reduce((sum, c) => sum + Math.ceil(c * rate), 0);
    return {
      billedChars,
      tokens,
      formula: `${billedChars} ký tự × ${engine.billingMultiplier} (engine ${ENGINE}) × ${data.globalMultiplier} (global)`,
    };
  },

  async assertVoice(voice: string): Promise<void> {
    const { data } = await call<VoicesResponse>('GET', `/voices?engine=${ENGINE}`);
    if (data.voices.some((v) => v.id === voice)) return;
    const needle = voice.toLowerCase();
    const similar = data.voices.filter((v) => v.id.toLowerCase().includes(needle) || v.name.toLowerCase().includes(needle)).slice(0, 8);
    throw new Error(`Giọng "${voice}" không có trong GET /voices?engine=${ENGINE}` + (similar.length ? `. Gần giống: ${similar.map((v) => v.id).join(', ')}` : ''));
  },

  async synthesize(requests: TtsRequest[], log: (msg: string) => void): Promise<TtsResult[]> {
    const jobs = new Map<string, string>(); // jobId → key
    const done: TtsResult[] = [];

    for (const r of requests) {
      const { data, headers } = await call<SubmitResponse>('POST', '/tts', {
        headers: { 'Idempotency-Key': r.key },
        body: { text: r.text, voiceId: r.voice, speed: r.speed, emotion: r.emotion, engine: ENGINE, aiRefine: false },
      });
      const replayed = headers.get('idempotent-replayed') === 'true' ? ' (idempotent replay)' : '';
      log(`  submit ${r.key.slice(0, 10)}… → job ${data.jobId} ${data.status}${replayed}`);
      if (data.status === 'completed' && data.audioUrl) done.push({ key: r.key, audioUrl: data.audioUrl });
      else jobs.set(data.jobId, r.key);
    }

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (jobs.size > 0) {
      if (Date.now() > deadline) throw new Error(`Hết thời gian chờ ${jobs.size} job TTS`);
      await sleep(POLL_INTERVAL_MS);
      const ids = [...jobs.keys()];
      for (let i = 0; i < ids.length; i += POLL_BATCH) {
        const batch = ids.slice(i, i + POLL_BATCH);
        const { data } = await call<{ jobs: StatusEntry[]; missing: string[] }>('GET', `/tts?ids=${batch.map(encodeURIComponent).join(',')}`);
        for (const j of data.jobs) {
          const key = jobs.get(j.jobId)!;
          if (j.status === 'completed' && j.audioUrl) {
            done.push({ key, audioUrl: j.audioUrl });
            jobs.delete(j.jobId);
          } else if (j.status === 'failed') {
            done.push({ key, error: `job ${j.jobId}: ${j.error ?? 'failed'}` });
            jobs.delete(j.jobId);
          }
        }
        for (const id of data.missing) {
          done.push({ key: jobs.get(id)!, error: `job ${id} không tìm thấy (missing)` });
          jobs.delete(id);
        }
      }
    }
    return done;
  },
};
