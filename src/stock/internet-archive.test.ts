// node --test: Internet Archive items are accepted only from whitelisted collections with a clean licence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { licenseFromUrl, pickVideoFile, toCandidate, whitelisted } from './internet-archive.ts';

const opts = { minHeight: 720, minLength: 8 };
const film = (h: number, length = '120.5') => ({ name: `f${h}.mp4`, format: 'h.264', width: String(Math.round((h * 16) / 9)), height: String(h), length });
const item = (metadata: Record<string, unknown>, files = [film(1080)]) => ({ metadata, files });

test('licence URLs: PD dedication / mark / CC0 / CC BY(-SA) pass, NC/ND and unknown fail', () => {
  assert.deepEqual(licenseFromUrl(undefined), { ok: true });
  assert.equal(licenseFromUrl('http://creativecommons.org/licenses/publicdomain/').label, 'Public Domain (CC PD Dedication)');
  assert.equal(licenseFromUrl('https://creativecommons.org/publicdomain/mark/1.0/').label, 'Public Domain Mark 1.0');
  assert.equal(licenseFromUrl('http://creativecommons.org/licenses/publicdomain/zero/1.0/').label, 'CC0 1.0');
  assert.equal(licenseFromUrl('https://creativecommons.org/licenses/by-sa/4.0/').label, 'CC BY-SA 4.0');
  for (const bad of ['https://creativecommons.org/licenses/by-nc-nd/4.0/', 'https://creativecommons.org/licenses/by-nc/3.0/', 'http://rightsstatements.org/vocab/InC/1.0/']) assert.equal(licenseFromUrl(bad).ok, false, bad);
});

test('collections: whitelist by exact id, user-upload sets win, bookmark sets ignored', () => {
  assert.equal(whitelisted(['nasa', 'fav-someone'], 'video')?.id, 'nasa');
  assert.equal(whitelisted(['nasa', 'opensource_movies'], 'video'), undefined);
  assert.equal(whitelisted(['fedflix'], 'video'), undefined, 'ids are case-sensitive (FedFlix)');
  assert.equal(whitelisted(['FedFlix'], 'video')?.id, 'FedFlix');
  assert.equal(whitelisted(['prelinger'], 'image'), undefined, 'prelinger is film only');
  assert.equal(whitelisted('community', 'video'), undefined);
});

test('items: licence required where the collection mixes cleared and uncleared films', () => {
  assert.match(String(toCandidate('a', item({ collection: ['prelinger'], title: 'A' }), 'video', opts)), /bắt buộc/);
  const ok = toCandidate('b', item({ collection: ['prelinger'], title: 'B', year: 'ca. 1954', licenseurl: 'http://creativecommons.org/licenses/publicdomain/' }), 'video', opts);
  assert.equal(typeof ok, 'object');
  assert.equal((ok as { year: string }).year, '1954');
  const nasa = toCandidate('c', item({ collection: 'nasa', title: 'C', creator: ['NASA', 'JSC'] }), 'video', opts);
  assert.equal(typeof nasa === 'object' && nasa.license, 'Public Domain (US Government work)');
  assert.equal(typeof nasa === 'object' && nasa.author, 'NASA; JSC');
});

test('items: red flags in rights/description and NC licences are rejected even in a whitelisted collection', () => {
  assert.match(String(toCandidate('d', item({ collection: 'nasa', rights: 'Fair Use Notice: …' }), 'video', opts)), /rights/);
  assert.match(String(toCandidate('e', item({ collection: 'nasa', licenseurl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' }), 'video', opts)), /giấy phép/);
  assert.match(String(toCandidate('f', item({ collection: 'nasa', description: 'Footage licensed from Getty Images' }), 'video', opts)), /bên thứ ba/);
  assert.match(String(toCandidate('g', item({ collection: 'community' }), 'video', opts)), /danh sách trắng/);
});

test('film files: below the height floor or too short are dropped; mm:ss lengths parse', () => {
  assert.match(String(toCandidate('h', item({ collection: 'nasa' }, [film(480)]), 'video', opts)), /720p/);
  assert.equal(typeof toCandidate('i', item({ collection: 'nasa' }, [film(480)]), 'video', { ...opts, minHeight: 480 }), 'object');
  assert.match(String(toCandidate('j', item({ collection: 'nasa' }, [film(1080, '0:05')]), 'video', opts)), /đủ dài/);
  assert.equal(typeof toCandidate('k', item({ collection: 'nasa' }, [film(1080, '2:10')]), 'video', opts), 'object');
  assert.equal(pickVideoFile([{ name: 'a.mp4', format: 'h.264', height: 720, length: 30 }, { name: 'b.mp4', format: '512Kb MPEG4', height: 1080, length: 30 }], 720, 10)?.name, 'b.mp4');
});
