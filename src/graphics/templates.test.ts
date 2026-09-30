// node --test: the `text` template keeps punctuation that follows a *marked* phrase on the same line.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderHtml, type GraphicSpec } from './templates.ts';
import { getTheme } from './theme.ts';

/** The statement's markup: what sits inside <div class="tx …">…</div>. */
function statement(text: string): string {
  const html = renderHtml({ template: 'text', kicker: 'Thử', text, sub: 'Nguồn' } as GraphicSpec, 5, getTheme());
  const m = /<div class="tx disp[^"]*"[^>]*>(.*?)<\/div>/s.exec(html);
  assert.ok(m, 'no .tx block in output');
  return m[1]!;
}
/**
 * Words in order, "|" where the outer line may break: a space outside any no-wrap run (.nb) and
 * outside a highlight box (.hlw is an inline-block, placed on a line as one piece).
 */
function words(markup: string): string {
  const stack: boolean[] = [];
  let out = '';
  for (const tok of markup.match(/<\/?[a-z][^>]*>|[^<]+/g) ?? []) {
    if (/^<(span|i)\b/.test(tok)) stack.push(/class="(nb|hlw)"/.test(tok));
    else if (/^<\/(span|i)>/.test(tok)) stack.pop();
    else if (!tok.startsWith('<')) out += stack.some(Boolean) ? tok : tok.replace(/ /g, '|');
  }
  return out;
}

test('punctuation right after *…* glues to the phrase (no break before it)', () => {
  const tx = statement('Máy có *nghĩ được*? Không.');
  assert.match(tx, /<span class="nb"><span class="hlw">.*?<\/span><span class="m"><span id="w4" class="mi">\?<\/span><\/span><\/span>/s);
  assert.equal(words(tx), 'Máy|có|nghĩ được?|Không.');
});

test('opening bracket before *…* glues too; a spaced word does not', () => {
  const tx = statement('Gọi là (*AI*) , rồi thôi');
  assert.equal(words(tx), 'Gọi|là|(AI)|,|rồi|thôi');
});

test('unmarked text keeps one breakable unit per word and the underline on the last word', () => {
  const tx = statement('Trí tuệ nhân tạo');
  assert.doesNotMatch(tx, /class="nb"/);
  assert.equal(words(tx), 'Trí|tuệ|nhân|tạo');
  assert.match(tx, /<span class="ulw"><span class="m"><span id="w3" class="mi">tạo<\/span><\/span><i id="ul"/);
});

test('every word still gets its own rising mask, in order', () => {
  const tx = statement('*Hai lần*, AI *chết*.');
  const ids = [...tx.matchAll(/id="(w\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['w0', 'w1', 'w2', 'w3', 'w4', 'w5']);
  assert.equal(words(tx), 'Hai lần,|AI|chết.');
});
