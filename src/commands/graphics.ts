// cvm graphics --chapter N [--scene id] [--draft] [--jobs N]
// Renders every animation/text_card scene that has `visual.spec` into visuals/chNN/sNNN.mp4,
// up to N HyperFrames renders side by side; the manifest is written once at the end of the chapter.
// Skips a scene when spec + slot length + template version are unchanged and the asset exists.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FPS, probeSize, runAsync } from '../media.ts';
import { mapLimit } from '../pool.ts';
import { chapterScenes, readJson, ROOT, slotSeconds, splitSceneId, updateScenes, type Project, type Scene, type SceneEdits } from '../project.ts';
import { renderHtml, specFiles, TEMPLATE_VERSIONS, validateSpec, type GraphicSpec } from '../graphics/templates.ts';
import { getTheme, type Theme } from '../graphics/theme.ts';
import { HYPERFRAMES } from './animatic.ts';

export const GRAPHIC_TYPES = new Set(['animation', 'text_card']);
export const TAIL_S = 0.5; // render longer than the slot: covers transition overlap; `cvm render` trims to exact frames

/** Files the spec pulls in (background, montage stills): absolute path → name next to index.html. */
function inputFiles(p: Project, spec: GraphicSpec): { file: string; name: string }[] {
  return specFiles(spec).map(({ src, name }) => {
    const file = path.join(p.dir, src);
    if (!existsSync(file)) throw new Error(`File trong visual.spec không tồn tại: ${src}`);
    return { file, name };
  });
}

function specHash(s: Scene, spec: GraphicSpec, seconds: number, files: { file: string }[], theme: Theme): string {
  const stamps = files.map(({ file }) => `${statSync(file).size}:${statSync(file).mtimeMs}`);
  return createHash('sha256').update(JSON.stringify([TEMPLATE_VERSIONS[spec.template], s.visual.spec, seconds.toFixed(3), stamps.length ? stamps : null, theme])).digest('hex');
}

/** `"theme"` in brief.json picks the graphic theme; otherwise the default one. */
export function projectTheme(p: Project): Theme {
  const briefFile = path.join(p.dir, 'brief.json');
  const id = existsSync(briefFile) ? readJson<{ theme?: string }>(briefFile).theme : undefined;
  return getTheme(id);
}

export async function graphics(p: Project, chapter: number, onlyScene: string | undefined, draft: boolean, jobs: number): Promise<void> {
  const scenes = chapterScenes(p, chapter).filter((s) => GRAPHIC_TYPES.has(s.visual.type) && (!onlyScene || s.id === onlyScene));
  if (onlyScene && scenes.length === 0) throw new Error(`${onlyScene} không phải scene animation/text_card của chapter ${chapter}`);
  const theme = projectTheme(p);
  const noSpec = scenes.filter((s) => !s.visual.spec).map((s) => s.id);
  if (noSpec.length) console.warn(`⚠ Chưa có visual.spec (bỏ qua): ${noSpec.join(', ')}`);

  const edits: SceneEdits = new Map();
  const attach = (s: Scene, rel: string) => {
    if (s.visual.asset !== rel || s.visual.status !== 'ready') {
      edits.set(s.id, (x) => {
        x.visual.asset = rel;
        x.visual.status = 'ready';
      });
    }
  };
  const todo: { s: Scene; spec: GraphicSpec; dir: string; out: string; rel: string; hash: string }[] = [];
  for (const s of scenes.filter((x) => x.visual.spec)) {
    let spec = validateSpec(s.id, s.visual.spec);
    const seconds = slotSeconds(s) + TAIL_S;
    const dir = path.join(p.dir, 'graphics', s.id);
    const files = inputFiles(p, spec);
    // Marks are placed in image fractions; the layout needs the still's real aspect ratio.
    if (spec.template === 'docmark' && !spec.size) spec = { ...spec, size: probeSize(path.join(p.dir, spec.src)) };
    const hash = specHash(s, spec, seconds, files, theme);
    const { chapter: ch, scene } = splitSceneId(s.id);
    const rel = path.join('visuals', ch, `${scene}.mp4`);
    const out = path.join(p.dir, rel);
    const hashFile = path.join(dir, '.spec-hash');

    if (existsSync(out) && existsSync(hashFile) && readFileSync(hashFile, 'utf8') === hash) {
      console.log(`cached  ${s.id}`);
      attach(s, rel); // a run interrupted before its manifest write left the asset unregistered
      continue;
    }
    mkdirSync(dir, { recursive: true });
    cpSync(path.join(ROOT, 'templates', 'animatic', 'fonts'), path.join(dir, 'fonts'), { recursive: true });
    for (const f of files) cpSync(f.file, path.join(dir, f.name));
    writeFileSync(path.join(dir, 'index.html'), renderHtml(spec, seconds, theme));
    mkdirSync(path.dirname(out), { recursive: true });
    todo.push({ s, spec, dir, out, rel, hash });
  }

  const results = await mapLimit(todo, jobs, async ({ s, spec, dir, out, rel, hash }) => {
    await runAsync('npx', [...HYPERFRAMES, 'render', dir, '--quality', draft ? 'draft' : 'looks', '--fps', String(FPS), '--output', out], `[${s.id}] `);
    writeFileSync(path.join(dir, '.spec-hash'), hash);
    attach(s, rel);
    console.log(`render  ${s.id}  ${spec.template}  → ${rel}`);
  });
  updateScenes(p, edits); // one locked write for the chapter
  const failed = results.flatMap((r, i) => (r.ok ? [] : [`${todo[i]!.s.id}: ${r.error.message}`]));
  if (failed.length) throw new Error(`${failed.length} scene render lỗi (các scene khác đã ghi):\n  ${failed.join('\n  ')}`);
}
