// SRT built from scene timing: one scene's speech window is split into readable cues,
// time shared out in proportion to characters (no word-level alignment in the MVP).
import type { Timing } from './media.ts';

const MAX_CUE_CHARS = 84; // ~2 lines of 42

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/**
 * Split into ~equal cues of at most MAX_CUE_CHARS, breaking only at spaces (so "126,5"
 * or "15/3/2025" never break) and preferring a break right after punctuation.
 */
function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_CUE_CHARS) return [clean];
  const target = clean.length / Math.ceil(clean.length / MAX_CUE_CHARS);
  const out: string[] = [];
  let cur = '';
  for (const word of clean.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    const atPunct = /[.,;:!?…]$/.test(cur);
    if (cur && (next.length > MAX_CUE_CHARS || cur.length >= target || (atPunct && cur.length >= target * 0.6))) {
      out.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function sceneCues(narration: string, t: Timing, offset = 0): Cue[] {
  const chunks = chunkText(narration);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const span = t.speechEnd - t.start;
  let at = t.start + offset;
  return chunks.map((text) => {
    const start = at;
    at += (span * text.length) / total;
    return { start, end: at, text };
  });
}

function stamp(sec: number): string {
  const ms = Math.round(sec * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');
}
