// Cross-process file lock (Node built-ins only): `<file>.lock` created with O_EXCL holds the owner's pid.
// Critical sections are short and synchronous (read JSON → change → atomic write), so waiters just spin-sleep.
import { closeSync, openSync, readFileSync, rmSync, statSync, writeSync } from 'node:fs';

const STALE_MS = 30_000; // no critical section takes this long; an older lock is left over from a crash
const TIMEOUT_MS = 60_000;

export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'; // exists, owned by someone else
  }
}

/** Owner pid, or null when the lock is gone (released between our attempts). */
function owner(lock: string): { pid: number; ageMs: number } | null {
  try {
    const pid = Number(readFileSync(lock, 'utf8').trim());
    return { pid, ageMs: Date.now() - statSync(lock).mtimeMs };
  } catch {
    return null;
  }
}

/**
 * Run `fn` while holding `<file>.lock`. A lock whose owner process is dead (or older than 30 s)
 * is taken over. `fn` must be synchronous: the lock is released as soon as it returns.
 */
export function withFileLock<T>(file: string, fn: () => T): T {
  const lock = `${file}.lock`;
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    try {
      const fd = openSync(lock, 'wx');
      writeSync(fd, String(process.pid));
      closeSync(fd);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
    const o = owner(lock);
    if (o && (!Number.isInteger(o.pid) || !alive(o.pid) || o.ageMs > STALE_MS)) {
      rmSync(lock, { force: true });
      continue;
    }
    if (Date.now() > deadline) throw new Error(`${lock} bị giữ quá ${TIMEOUT_MS / 1000}s (pid ${o?.pid}) — nếu không còn lệnh cvm nào chạy thì xoá file này`);
    sleepSync(20 + Math.random() * 30);
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { force: true });
  }
}
