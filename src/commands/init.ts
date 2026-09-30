import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR, ROOT, setCurrent, writeJsonAtomic, type Manifest } from '../project.ts';

const SUBDIRS = ['tts', 'audio', 'visuals', 'stock', 'renders', 'build'];

export function init(slug: string | undefined): void {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error('Cú pháp: cvm init <slug> (chữ thường, số, gạch ngang)');
  const dir = path.join(PROJECTS_DIR, slug);
  const manifestPath = path.join(dir, 'manifest.json');
  for (const d of SUBDIRS) mkdirSync(path.join(dir, d), { recursive: true });
  if (!existsSync(manifestPath)) {
    const manifest: Manifest = { slug, tts: { voice: null, speed: 1.0, emotion: 'natural' }, scenes: [] };
    writeJsonAtomic(manifestPath, manifest);
    console.log(`Tạo ${path.relative(ROOT, dir)}/`);
  } else {
    console.log(`${path.relative(ROOT, dir)}/ đã có — giữ nguyên manifest`);
  }
  setCurrent(slug);
  console.log(`Project hiện tại: ${slug}`);
}
