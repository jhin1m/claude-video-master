// Provider-neutral TTS contract so VieNeu can be swapped later.

export interface TtsRequest {
  key: string; // stable per-scene key (scene hash) — used for idempotent retries
  text: string;
  voice: string;
  speed: number;
  emotion: string;
}

/** Either a download URL or an error for that key (failed jobs are refunded by VieNeu). */
export interface TtsResult {
  key: string;
  audioUrl?: string;
  error?: string;
}

export interface CostEstimate {
  billedChars: number;
  tokens: number;
  formula: string;
}

export interface TtsProvider {
  name: string;
  /** Cost preview computed from live pricing; must not bill anything. */
  estimate(requests: TtsRequest[]): Promise<CostEstimate>;
  /** Throws with a helpful message when the voice does not exist. */
  assertVoice(voice: string): Promise<void>;
  /** Submit + wait for every request; one result (URL or error) per key. */
  synthesize(requests: TtsRequest[], log: (msg: string) => void): Promise<TtsResult[]>;
}
