// Clarity fixes 8e and 8f (PLAN.md M6a): the text items from the fresh-eyes reads of 2026.11.25-4 and -5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { priceNote } from '../src/ui/format.js';
import { boomWords } from '../src/ui/sheets.js';
import { waveInfo, waveLines } from '../src/ui/wave.js';
import { lostLine } from '../src/ui/lost.js';
import { badgeRates, coinsStat } from '../src/ui/map.js';
import { dots, DOT_ORDER, heldAfterLoss } from '../src/core/reveal.js';
import { setHold, fall, atWall } from '../src/core/defense.js';
import { textIssues } from '../tools/audit.js';
import { hitsLeftWords } from '../src/ui/explain.js';
import { HITS_LEFT } from '../src/ui/format.js';
import fs from 'node:fs';

test('8e (1): a boom on a low price says why it is low, and a bust does not say the price comes back twice', () => {
  const low = .00005;
  assert.equal(boomWords(1.6, '1:11'), 'Price up for 1:11 more');
  assert.equal(boomWords(.6, '0:47'), 'Price down for 0:47 more');
  const inBoom = priceNote({ have: 50, price: low, boom: true }), inBust = priceNote({ have: 50, price: low, bust: true });
  assert.equal(inBoom, null, 'in a boom the rows say it, no sentence under Price up (8h, read of 2026.11.25-8)');
  assert.equal(inBust, null, 'in a bust its demand row says the drop and its time left, no sentence over it (8r)');
  assert.ok(!/comes back/.test(priceNote({ have: 50, price: low })));
});

test('8e (4) and 8h (4): the card leads with one line in every case, never a count a row says', () => {
  const t = newGame('c8e4', 'gulch').town;
  Object.assign(t.waves, { phase: 'wave', queue: ['raider', 'raider'], foes: [] });
  assert.deepEqual(waveInfo(t), { lines: ['2 still to come, none on the road yet.'], kinds: [{ kind: 'raider', n: 2 }] });
  assert.deepEqual(waveLines(t), ['2 still to come, none on the road yet.', '2 Bandits']);
  Object.assign(t.waves, { queue: ['raider', 'runner'], foes: [{ kind: 'raider' }] });
  assert.deepEqual(waveLines(t), ['1 on the road, 2 still to come.', '2 Bandits', '1 Horseman'], 'with more kinds the same lead line');
  Object.assign(t.waves, { queue: [], foes: [{ kind: 'raider' }] });
  assert.deepEqual(waveLines(t), ['1 on the road. No more to come.', '1 Bandit']);
});

test('8f (3): at its wall the map line says back once and leaves Play to its button', () => {
  const g = newGame('c8f3', 'gulch');
  g.addTown('ridge'); g.go('ridge');
  const t = g.towns.gulch, lose = () => { t.wave = 31; t.bestWave = Math.max(t.bestWave || 0, 31); fall(g, t, 'vault'); };
  lose(); setHold(g, t, false); lose();
  assert.equal(atWall(t), true);
  const line = lostLine(t);
  assert.deepEqual(textIssues(line), [], line);
  assert.doesNotMatch(line, /again/);
  assert.doesNotMatch(line, /Tap Play/, 'the Play button under it names the town');
});

test('8f (4): while the town is held after a loss no side button has a dot', () => {
  const g = newGame('c8f4', 'gulch'), t = g.town;
  t.buildings.camp = 3; t.buildings.mine = 2; t.flags['open:research'] = true; t.coins = 1e6; g.shared.purse.coins = 1e6;
  const before = dots(g, t);
  assert.ok(DOT_ORDER.some(k => before[k]), 'a dot before the hold: ' + JSON.stringify(before));
  setHold(g, t, true);
  assert.ok(DOT_ORDER.some(k => dots(g, t)[k]), 'a hold the player chose keeps its dots');
  t.waves.autoHold = true;
  const held = dots(g, t);
  assert.equal(heldAfterLoss(t), true, 'the Perks glow reads the same state');
  assert.ok(!DOT_ORDER.some(k => held[k]), JSON.stringify(held));
  setHold(g, t, false);
  assert.ok(DOT_ORDER.some(k => dots(g, t)[k]), 'back once resumed');
});

test('8f (5): a town card says its coins the way its map label does', () => {
  const infos = { gulch: { income: 14 }, ridge: { income: 2.5 }, drycreek: { income: .02 } };
  const r = badgeRates(16.52, infos);
  for (const id of ['gulch', 'ridge', 'drycreek']) assert.equal(coinsStat(r, id), r.words[id], id);
});

test('8e (3): a full vault with bonuses says Full under Can take, so the number is said once', () => {
  const rows = [{ label: 'Vault', base: 20 }, { label: 'War Office', mul: 1.25 }];
  assert.equal(hitsLeftWords({ rows, value: 25, left: 25 }), 'Full');
  assert.notEqual(hitsLeftWords({ rows, value: 25, left: 12 }), 'Full');
  assert.match(hitsLeftWords({ rows: rows.slice(0, 1), value: 20, left: 20 }), /20/, 'with no Can take row the number shows');
});

test('8f (2): the map card and the Vault sheet name the hits left the same way, and Can take only means the most', () => {
  const read = f => fs.readFileSync(new URL('../src/ui/' + f, import.meta.url), 'utf8');
  assert.equal(HITS_LEFT, 'Hits left');
  assert.ok(read('map.js').includes('stat(HITS_LEFT, vaultHits(t)'), 'the map card row with the heart is Hits left');
  assert.ok(!read('map.js').includes('stat(CAN_TAKE'), 'not Can take, the sheet name for the most');
  assert.ok(read('explain.js').includes("el('span', null, HITS_LEFT)"));
});

test('8f (4): the Perks glow waits while the town is held after a loss', () => {
  const play = fs.readFileSync(new URL('../src/ui/play.js', import.meta.url), 'utf8');
  assert.ok(play.includes("perksBtn.classList.toggle('on', !heldAfterLoss(town) &&"), 'one state with the dots');
});
