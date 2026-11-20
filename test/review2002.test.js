// Words and layout left from the reviews of 2026.11.19-13 to 2026.11.20-2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { dots, DOT_ORDER } from '../src/core/reveal.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { foremanLine, keepLine } from '../src/ui/explain.js';
import { priceWord } from '../src/ui/sheets.js';
import { lostAsk } from '../src/ui/capital.js';
import { waveInfo, waveLines, bestTower } from '../src/ui/wave.js';
import { FOE_ART } from '../src/art/foes.js';
import { FOES } from '../src/data/foes.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the foreman and kept-goods lines are short statuses', () => {
  assert.equal(foremanLine('flooded', 'timber'), 'Waiting for timber to sell for more.');
  assert.equal(foremanLine('short', 'timber'), 'Waiting for more timber.');
  assert.equal(keepLine(['copper ore'], 'upgrade'), 'Saving copper ore for this upgrade.');
  for (const t of [foremanLine('slow', 'timber'), keepLine(['copper', 'bricks'], 'path')]) assert.deepEqual(textIssues(t), []);
  assert.equal(oldWavesLabel({ record: 22 }), 'Beaten wave bonus');
});

test('the price bar ends in a word for where the price stands', () => {
  assert.deepEqual([1, .7, .5, .2, .02].map(s => priceWord(s)), ['Full price', 'High price', 'Half price', 'Low price', 'Very low price']);
});

test('Drop and Switch say the goods already sent are lost', () => {
  assert.equal(lostAsk({ got: 16.7 }), 'Lose 16 sent?');
  assert.equal(lostAsk({ got: 0 }), 'Tap again');
});

test('the raiders card has a picture and the best tower for each kind', () => {
  for (const [k, art] of Object.entries(FOE_ART)) {
    assert.ok(FOES[k], k);
    assert.equal(art.length, 12, k); for (const row of art) assert.equal(row.length, 12, k + ' ' + row);
  }
  for (const k of Object.keys(FOES)) assert.ok(FOE_ART[k], 'a picture for ' + k);
  const g = newGame('r2002', 'gulch'), t = g.town;
  assert.equal(bestTower(t, 'runner'), 'crossbow');
  assert.equal(bestTower(t, 'brute'), 'still');
  assert.equal(bestTower(t, 'raider'), null);
  assert.equal(bestTower(t, 'wagon'), 'still', 'the Mortar is not open yet');
  t.flags['open:mortar'] = true;
  assert.equal(bestTower(t, 'wagon'), 'mortar');
  t.wave = 10;
  const info = waveInfo(t);
  assert.ok(info.kinds.some(k => k.kind === 'wagon'), 'a boss wave lists its boss');
  assert.ok(waveLines(t).some(l => l === 'Can bring Bandits, Horsemen and Brutes.'));
  Object.assign(t.waves, { phase: 'wave', queue: ['raider', 'raider'], foes: [] });
  assert.deepEqual(waveInfo(t), { lines: ['2 Bandits left.'], kinds: [{ kind: 'raider', n: null }] });
});

test('only one side button has a dot at a time', () => {
  const g = newGame('r2002b', 'gulch'), t = g.town;
  t.buildings.camp = 3; t.buildings.mine = 2; t.flags['open:research'] = true; t.coins = 1e6;
  const d = dots(g, t);
  assert.ok(DOT_ORDER.filter(k => d[k]).length <= 1, JSON.stringify(d));
});

test('the price on a card sits over Upgrade alone', () => {
  const play = read('src/ui/play.js');
  assert.match(play, /card\.append\(sr\); bar\.append\(row\); card\.append\(bar\)/); // the tower's Sell leaves the pinned bar
  assert.match(play, /kr\.append\(sell\)/); // the building's Sell switch sits under it, beside Keep for towers
  assert.match(play, /'Each path costs'/);
  assert.match(read('src/render/scene.js'), /sky\.position\.set\(cam\.position\.x, 0, cam\.position\.z\)/);
});
