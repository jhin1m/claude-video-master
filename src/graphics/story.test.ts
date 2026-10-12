// node --test: storytelling templates render in every theme, keep their beats, and reject bad specs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docLayout, markedWords, rankTimes, STORY_TEMPLATES } from './story.ts';
import { renderHtml, soundCues, TEMPLATE_VERSIONS, validateSpec, type GraphicSpec, type StorySpec } from './templates.ts';
import { THEMES } from './theme.ts';

const SAMPLES: StorySpec[] = [
  { template: 'rank', kicker: 'Top', items: [{ label: 'Một', value: '1997' }, { label: 'Hai' }, { label: 'Ba', value: '1739' }], sub: 'Nguồn' },
  { template: 'timeline', kicker: 'Mốc', events: [{ year: '1950', label: 'A' }, { year: '1956', label: 'B' }, { year: '1974', label: 'C' }], focus: 2, sub: 'Nguồn' },
  { template: 'steps', kicker: 'Quy trình', steps: [{ title: 'Nhận', detail: 'ảnh' }, { title: 'Đoán' }, { title: 'Sửa' }], active: 1, sub: 'Nguồn' },
  { template: 'quote', quote: 'Ta chỉ thấy *một quãng ngắn* phía trước.', author: 'Alan Turing', role: '1950', photo: 'media/t.jpg' },
  { template: 'headline', kicker: 'Báo', paper: 'The Times', date: '8/7/1958', headline: 'Máy *tự học* bằng *cách làm*', deck: 'Phụ đề' },
  { template: 'docmark', kicker: 'Hồ sơ', src: 'media/doc.jpg', size: [2961, 2097], marks: [{ box: [0.38, 0.73, 0.38, 0.04], note: 'Đề tài' }, { box: [0.43, 0.8, 0.13, 0.03], type: 'circle', side: 'below' }], sub: 'Nguồn' },
  { template: 'profile', photo: 'media/a.jpg', name: 'Ada Lovelace', years: '1815–1852', role: 'Nhà toán học', facts: [{ year: '1843', text: 'Note G' }] },
];

test('every storytelling template has a sample, a version and renders in every theme', () => {
  assert.deepEqual(SAMPLES.map((s) => s.template).sort(), [...STORY_TEMPLATES].sort());
  for (const spec of SAMPLES) {
    assert.ok(TEMPLATE_VERSIONS[spec.template] >= 1, `${spec.template}: no version`);
    for (const theme of Object.values(THEMES)) {
      for (const withBg of [false, true]) {
        const s = { ...spec, ...(withBg ? { bg: { src: 'stock/bg/x.mp4' } } : {}) } as GraphicSpec;
        const html = renderHtml(validateSpec('ch01_s001', s), 6, theme);
        assert.doesNotMatch(html, /undefined|NaN/, `${spec.template} × ${theme.id}${withBg ? ' + bg' : ''}`);
        // `clip` is HyperFrames' timed-element class: a layout class by that name breaks the render.
        assert.doesNotMatch(html.replace(/<(video|section)[^>]*class="clip"/g, ''), /class="clip"|\.clip\{/, `${spec.template} × ${theme.id}: reserved class "clip"`);
      }
    }
  }
});

test('countdown: #1 lands last and its pop sits on the crown beat', () => {
  const T = rankTimes(5);
  assert.ok(T.row(0) > T.row(1) && T.row(1) > T.row(4));
  const cues = soundCues(SAMPLES[0]!);
  assert.equal(cues.filter((c) => c.sfx === 'tick').length, 2);
  assert.ok(cues.some((c) => c.sfx === 'pop' && Math.abs(c.at - rankTimes(3).crown) < 1e-9));
});

test('marked words keep their groups in order', () => {
  assert.deepEqual(
    markedWords('Máy *tự học* bằng *cách làm*').map((w) => w.group),
    [-1, 0, 0, -1, 1, 1],
  );
});

test('docmark camera brings the marks to the frame centre, notes can be placed', () => {
  const spec = SAMPLES[5] as Extract<StorySpec, { template: 'docmark' }>;
  const D = docLayout(spec, { x: 180, y: 150, w: 1560, h: 820 });
  const cx = (Math.min(...D.marks.map((m) => m.x)) + Math.max(...D.marks.map((m) => m.x + m.w))) / 2;
  assert.ok(Math.abs(D.cam.x + cx * D.cam.k - 960) < 1e-6);
  assert.ok(D.cam.k > 1 && D.cam.k <= 2.4);
  assert.equal(docLayout({ ...spec, zoom: false }, { x: 180, y: 150, w: 1560, h: 820 }).cam.k, 1);
});

test('bad specs fail with the scene id', () => {
  assert.throws(() => validateSpec('ch02_s003', { template: 'rank', kicker: '', items: [{ label: 'chỉ một' }], sub: '' }), /ch02_s003 \(rank\)/);
  assert.throws(() => validateSpec('ch02_s003', { ...SAMPLES[5], marks: [{ box: [0.9, 0.1, 0.2, 0.1] }] }), /box/);
  assert.throws(() => validateSpec('ch02_s003', { ...SAMPLES[1], focus: 7 }), /focus/);
});
