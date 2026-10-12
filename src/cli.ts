#!/usr/bin/env node
// cvm — mechanical half of the idea → Vietnamese video pipeline. Runs without Claude.
import path from 'node:path';
import { parseArgs } from 'node:util';
import { animatic } from './commands/animatic.ts';
import { archiveFetch, archivePick, archivePickBatch, archiveSearch } from './commands/archive.ts';
import { assetSet } from './commands/asset.ts';
import { init } from './commands/init.ts';
import { iaFetch, iaPick, iaPickBatch, iaSearch, minHeightArg } from './commands/internet-archive.ts';
import { graphics } from './commands/graphics.ts';
import { chapterList, final, render } from './commands/render.ts';
import { status } from './commands/status.ts';
import { stockPick, stockPickBatch, stockSearch } from './commands/stock.ts';
import { tts } from './commands/tts.ts';
import { jobsArg } from './pool.ts';
import { loadProject, ROOT } from './project.ts';
import { vieneu } from './tts/vieneu.ts';

const RENDER_JOBS = 2;

const USAGE = `cvm <lệnh> [--project <slug>]
  init <slug>                         tạo projects/<slug>/ và đặt làm project hiện tại
  tts --chapter N [--yes]             TTS các scene đổi hash (không --yes: chỉ in ước tính)
  animatic --chapter N                renders/chNN_animatic.mp4 (thẻ chữ + audio thật)
  status                              tiến độ project, nhịp đọc đo được + lệnh cần chạy tiếp
  graphics --chapter N [--scene id] [--draft] [--jobs N]  render scene animation/text_card từ visual.spec
                                      (N render song song, mặc định 1; ghi manifest một lần cuối chapter)
  stock search <sceneId> "<query>"    tìm clip Pexels đủ dài cho scene
  stock pick <sceneId> <id> [--start s] [--bg]  tải + cắt clip → visuals/chNN/sNNN.mp4
                                      (--bg: làm nền cho scene đồ hoạ → stock/bg/<sceneId>.mp4 + visual.spec.bg)
  stock pick --batch picks.json       nhiều scene: [{"scene","id","start"?,"bg"?}] — tải 4 luồng, ghi manifest một lần
  archive search <sceneId> "<query>"  tìm ảnh tư liệu Wikimedia Commons (PD/CC0/CC BY/BY-SA)
  archive fetch <pageid|sceneId…> | --batch picks.json   chỉ tải ảnh gốc về archive/raw/ (không ghi manifest)
  archive pick <sceneId> <pageid> [--fit cover|contain]  tải + dựng khung 1920×1080 + ghi credit
  archive pick --batch picks.json     nhiều scene: [{"scene","id","fit"?}] — ghi manifest một lần
                                      (Commons: tải từng ảnh, giãn 5–8 s, 429 → chờ Retry-After)
  ia search <sceneId> "<query>" [--type video|image] [--collection id] [--min-height N]
                                      phim/ảnh tư liệu Internet Archive, chỉ collection danh sách trắng (universal_newsreels,
                                      FedFlix, prelinger, wwIIarchive, nasa); phim ≥ 720p (--min-height 480 khi user cho dùng SD)
  ia pick <sceneId> <identifier> [--file f] [--start s] [--fit cover|contain] [--bg] [--min-height N]
                                      phim: cắt đúng đoạn từ server (không tải cả phim) → 1920×1080; ảnh: dựng khung
  ia pick --batch picks.json          [{"scene","id","file"?,"start"?,"fit"?,"bg"?,"type"?}] — ghi manifest một lần
  ia fetch <identifier|sceneId…> | --batch picks.json   chỉ tải ảnh gốc về ia/raw/
  asset set <sceneId> <path>          ghi nhận visual đã có cho scene
  render --chapter N | --chapters 3-12 | --all [--jobs N]  renders/chNN.mp4 + .srt (N chapter song song, mặc định ${RENDER_JOBS})
  final                               final.mp4 + subs.srt + credits.txt`;

function chapterArg(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error('Thiếu --chapter N');
  return n;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    /* .env optional for commands that do not call an API */
  }
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      project: { type: 'string' },
      chapter: { type: 'string' },
      yes: { type: 'boolean', default: false },
      start: { type: 'string' },
      scene: { type: 'string' },
      draft: { type: 'boolean', default: false },
      fit: { type: 'string' },
      bg: { type: 'boolean', default: false },
      type: { type: 'string' },
      collection: { type: 'string' },
      file: { type: 'string' },
      'min-height': { type: 'string' },
      batch: { type: 'string' },
      jobs: { type: 'string' },
      chapters: { type: 'string' },
      all: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, sub, ...rest] = positionals;
  if (!cmd || values.help) return console.log(USAGE);
  if (cmd === 'init') return init(sub);

  const p = loadProject(values.project);
  switch (cmd) {
    case 'tts':
      return tts(p, vieneu, chapterArg(values.chapter), values.yes);
    case 'status':
      return status(p);
    case 'graphics':
      return graphics(p, chapterArg(values.chapter), values.scene, values.draft, jobsArg(values.jobs, 1));
    case 'animatic':
      return animatic(p, chapterArg(values.chapter));
    case 'render':
      return render(p, chapterList(p, values), jobsArg(values.jobs, RENDER_JOBS));
    case 'final':
      return final(p);
    case 'asset':
      if (sub !== 'set') throw new Error('Cú pháp: cvm asset set <sceneId> <path>');
      return assetSet(p, rest[0], rest[1]);
    case 'stock':
      if (sub === 'search') return stockSearch(p, rest[0], rest[1]);
      if (sub === 'pick') return values.batch ? stockPickBatch(p, values.batch) : stockPick(p, rest[0], rest[1], values.start, values.bg);
      throw new Error('Cú pháp: cvm stock search|pick …');
    case 'archive':
      if (sub === 'search') return archiveSearch(p, rest[0], rest[1]);
      if (sub === 'fetch') return archiveFetch(p, rest, values.batch);
      if (sub === 'pick') return values.batch ? archivePickBatch(p, values.batch) : archivePick(p, rest[0], rest[1], values.fit);
      throw new Error('Cú pháp: cvm archive search|fetch|pick …');
    case 'ia':
      if (sub === 'search') return iaSearch(p, rest[0], rest[1], values.type, values.collection, minHeightArg(values['min-height']));
      if (sub === 'fetch') return iaFetch(p, rest, values.batch);
      if (sub === 'pick') {
        const minHeight = minHeightArg(values['min-height']);
        return values.batch ? iaPickBatch(p, values.batch, minHeight) : iaPick(p, rest[0], rest[1], { file: values.file, start: values.start, fit: values.fit, bg: values.bg, type: values.type, minHeight });
      }
      throw new Error('Cú pháp: cvm ia search|fetch|pick …');
    default:
      throw new Error(`Lệnh không hợp lệ: ${cmd}\n${USAGE}`);
  }
}

main().catch((err: unknown) => {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
