// Bounded parallelism for independent jobs (downloads, HyperFrames renders).

/**
 * Run `fn` over `items`, at most `limit` at a time. Every item runs even if some fail;
 * results keep item order as `{ ok, value | error }`.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<({ ok: true; value: R } | { ok: false; error: Error })[]> {
  const out: ({ ok: true; value: R } | { ok: false; error: Error })[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { ok: true, value: await fn(items[i]!, i) };
      } catch (err) {
        out[i] = { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** `--jobs N` → positive integer (default `def`). */
export function jobsArg(v: string | undefined, def: number): number {
  if (v == null) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--jobs phải là số nguyên ≥ 1 (nhận "${v}")`);
  return n;
}
