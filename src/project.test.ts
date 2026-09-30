// node --test: manifest writes are locked read-modify-writes — parallel cvm processes lose nothing.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { readJson, updateScene, writeJsonAtomic, type Manifest, type Project, type Scene } from './project.ts';

const scene = (id: string): Scene => ({
  id,
  chapter: 1,
  narration: 'x'.repeat(60),
  audio: { path: null, duration: null, pauseAfterMs: 300 },
  visual: { type: 'stock', intent: '', prompt: '', source: null, asset: null, status: 'todo' },
  hash: null,
});

function tempProject(ids: string[]): Project {
  const dir = mkdtempSync(path.join(tmpdir(), 'cvm-lock-'));
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest: Manifest = { slug: 'lock-test', tts: { voice: null, speed: 1, emotion: 'natural' }, scenes: ids.map(scene) };
  writeJsonAtomic(manifestPath, manifest);
  return { slug: 'lock-test', dir, manifestPath, manifest };
}

/** A separate node process doing `n` locked updates: appends its tag to a shared scene and to its own. */
function writer(manifestPath: string, own: string, tag: string, n: number): Promise<void> {
  const mod = pathToFileURL(path.join(import.meta.dirname, 'project.ts')).href;
  const code = `
    import { updateScene } from ${JSON.stringify(mod)};
    const p = { manifestPath: ${JSON.stringify(manifestPath)} };
    for (let i = 0; i < ${n}; i++) {
      updateScene(p, 'ch01_s001', (s) => { s.visual.prompt += ${JSON.stringify(tag)}; });
      updateScene(p, ${JSON.stringify(own)}, (s) => { s.visual.intent += ${JSON.stringify(tag)}; });
    }`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err))));
  });
}

test('parallel processes: every locked update survives', async () => {
  const workers = ['a', 'b', 'c', 'd'];
  const n = 40;
  const p = tempProject(['ch01_s001', ...workers.map((_, i) => `ch01_s00${i + 2}`)]);
  try {
    await Promise.all(workers.map((tag, i) => writer(p.manifestPath, `ch01_s00${i + 2}`, tag, n)));
    const m = readJson<Manifest>(p.manifestPath);
    const shared = m.scenes[0]!.visual.prompt;
    assert.equal(shared.length, workers.length * n, 'lost updates on the shared scene');
    for (const tag of workers) assert.equal([...shared].filter((c) => c === tag).length, n);
    workers.forEach((tag, i) => assert.equal(m.scenes[i + 1]!.visual.intent, tag.repeat(n)));
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test('an edit made on disk after loading is kept (update re-reads under the lock)', () => {
  const p = tempProject(['ch01_s001', 'ch01_s002']);
  try {
    const onDisk = readJson<Manifest>(p.manifestPath);
    onDisk.scenes[1]!.visual.caption = { title: 'sửa tay' };
    writeJsonAtomic(p.manifestPath, onDisk); // e.g. a caption typed in while `cvm graphics` runs
    updateScene(p, 'ch01_s001', (s) => (s.visual.asset = 'visuals/ch01/s001.mp4'));
    const m = readJson<Manifest>(p.manifestPath);
    assert.equal(m.scenes[1]!.visual.caption?.title, 'sửa tay');
    assert.equal(m.scenes[0]!.visual.asset, 'visuals/ch01/s001.mp4');
    assert.equal(p.manifest.scenes[1]!.visual.caption?.title, 'sửa tay', 'in-memory copy refreshed');
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});

test('a lock left by a dead process is taken over', () => {
  const p = tempProject(['ch01_s001']);
  try {
    writeFileSync(`${p.manifestPath}.lock`, '999999'); // no such pid
    updateScene(p, 'ch01_s001', (s) => (s.visual.intent = 'ok'));
    assert.equal(readJson<Manifest>(p.manifestPath).scenes[0]!.visual.intent, 'ok');
    assert.throws(() => readFileSync(`${p.manifestPath}.lock`), /ENOENT/, 'lock released');
  } finally {
    rmSync(p.dir, { recursive: true, force: true });
  }
});
