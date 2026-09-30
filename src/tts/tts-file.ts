// tts/chNN.tts — human-readable view of exactly what is sent to the TTS provider.
// Generated from manifest.json on every `cvm tts` run; edit the manifest, not this file.
// Pauses are inserted locally with ffmpeg and never sent to the API.
import type { Manifest, Scene } from '../project.ts';

export function renderTtsFile(tts: Manifest['tts'], scenes: Scene[]): string {
  const lines = [
    '# Sinh tự động từ manifest.json — sửa manifest, không sửa file này.',
    `@voice: ${tts.voice ?? ''}`,
    `@speed: ${tts.speed.toFixed(1)}`,
    `@emotion: ${tts.emotion}`,
  ];
  for (const s of scenes) {
    lines.push(`[${s.id}]`, s.narration);
    if (s.audio.pauseAfterMs > 0) lines.push(`<pause ${s.audio.pauseAfterMs}ms>`);
  }
  return lines.join('\n') + '\n';
}
