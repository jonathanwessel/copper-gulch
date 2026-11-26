// Words and layout from the review of 2026.11.20-3.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { goodsLine } from '../src/ui/format.js';
import { vaultHits } from '../src/ui/map.js';
import { sentWords } from '../src/ui/capital.js';
import { bestLine } from '../src/ui/wave.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('a good the towers keep all of says the extra is sold, so it agrees with Sell On', () => {
  const t = goodsLine({ have: 84, kept: 84, selling: true, price: 2 });
  assert.equal(t, '84 in stock · 84 for towers · 0 spare');
  assert.ok(!/none to sell/.test(t));
});

test('the map card says Full or the hits left, and the contract names its good', () => {
  assert.equal(vaultHits({ vault: { hp: 20, max: 20 } }), '20');
  assert.equal(vaultHits({ vault: { hp: 1, max: 20 } }), '1');
  assert.equal(sentWords({ got: 108.7, need: 270, good: 'timber' }), 'Sent 108 of 270 timber');
  assert.ok(!/'A town that makes/.test(read('src/ui/map.js').split('\n').find(l => l.startsWith('const whatIs'))));
});

test('the old-waves row says what it is in a few words', () => {
  const s = oldWavesLabel({ record: 22 });
  assert.match(s, /^[A-Z][a-z ]{2,19}$/); // short beside × 3 (the words are pinned in test/words.test.js)
  assert.deepEqual(textIssues(s), []);
});

test('a raider no tower beats has no best tower row', () => {
  const g = newGame(1), t = g.towns.gulch || g.town;
  assert.equal(bestLine(t, 'raider'), ''); // review of 2026.11.23-7: the row shows only when one tower is best
});

test('switches light a small box, not the whole button, and say what they do', () => {
  const play = read('src/ui/play.js'), css = read('index.html');
  assert.ok(play.includes("'Foreman upgrades'"));
  assert.ok(!/'Foreman · On'/.test(play));
  assert.ok(/\.btn\.switch\.on \{[^}]*background: var\(--panel-2\)/.test(css));
  assert.ok(!/Enough for ' \+/.test(read('src/ui/sheets.js')));
});

test('the more box sits in the strip, never floating over it', () => {
  assert.ok(!/morechip\.tab|' tab'/.test(read('src/ui/play.js') + read('index.html')));
});
