// Review of 2026.11.19-10: research, perks and deeds show in the breakdowns once they really apply, the old-waves row
// names its wave, institutions name the outposts, and the Perks card never sets "get 2 more deeds" beside "You have 2".
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { applyResearch } from '../src/core/research.js';
import { pickPerk, signCharter } from '../src/core/charter.js';
import { OLD_LABEL } from '../src/core/defense.js';
import { explainOutput, explainTower, explainIncome, oldWavesLabel } from '../src/core/explain.js';
import { INSTITUTION } from '../src/data/institutions.js';
import fs from 'node:fs';

const rich = g => { const t = g.town; t.coins = 1e9; for (const k of Object.keys(t.goods)) { t.goods[k] = 1e6; t.sell[k] = false; } return t; };

test('a research level shows on the tower breakdown under its own name', () => {
  const g = newGame('r1', 'gulch'), t = rich(g);
  t.towers.push({ spot: 3, kind: 'cannon', level: 1, path: null, cd: 0, spent: 0, pulses: 0 });
  t.research.gunsmith = 2; applyResearch(t);
  const row = explainTower(t, t.towers[0]).dmg.rows.find(r => r.label === 'Gunsmith research');
  assert.ok(row); assert.ok(Math.abs(row.mul - 1.3) < 1e-9);
});

test('a picked perk and the deeds show in the output and income breakdowns', () => {
  const g = newGame('r2', 'gulch'), t = rich(g);
  t.buildings.camp = 3;
  g.shared.charter.deeds = 2;
  assert.ok(pickPerk(g, 'trade', 'a'));
  const out = explainOutput(t, 'camp').rows.find(r => r.label === 'Boomtown perk');
  assert.ok(out, 'Boomtown is on the Lumber Camp output'); assert.equal(out.mul, 1.2);
  const deeds = explainIncome(t, {}, {}, 1).bonuses.find(r => r.label === 'Deeds');
  assert.ok(deeds, 'the deeds are on the Income sheet'); assert.equal(deeds.mul, 1.5);
});

test('the old-waves damage row says up to which wave', () => {
  const g = newGame('r3', 'gulch'), t = g.town;
  t.bestWave = 57; t.lifetime = 1e6;
  assert.ok(signCharter(g, t) > 0);
  rich(g); g.step(.25);
  t.towers.push({ spot: 3, kind: 'crossbow', level: 1, path: null, cd: 0, spent: 0, pulses: 0 });
  const rows = explainTower(t, t.towers[0]).dmg.rows;
  assert.ok(!rows.some(r => r.label === OLD_LABEL));
  const row = rows.find(r => r.label === oldWavesLabel(t));
  // short beside × 3, drawn as the wave bar's gold number (the words are pinned in test/words.test.js)
  assert.ok(row.old && row.label.length <= 20);
  assert.equal(row.mul, 3);
});

test('institutions name the outposts they help', () => {
  assert.match(INSTITUTION.transport.about, /outpost/);
  assert.doesNotMatch(INSTITUTION.transport.about, /Your outposts/);
});

test('the Perks card says what signing pays, not "more" beside the deeds held', () => {
  const src = fs.readFileSync(new URL('../src/ui/sheets.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /' more ' \+ \(p\.total/);
  assert.match(src, /'After signing'/);
  assert.doesNotMatch(src, /More deeds let you pick more perks/); // the pairs already say what each needs
});

test('no red how-to on the Capital when no contract runs', () => {
  const src = fs.readFileSync(new URL('../src/ui/capital.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /'warn', 'Take a contract/);
});

test('a camp that needs nothing is never short, even while its rate catches up with a new bonus', async () => {
  const { explainMade } = await import('../src/core/explain.js');
  const g = newGame('r4', 'gulch'), t = g.town;
  t.buildings.camp = 10; t.ran = { camp: 1 };
  const ex = explainMade(t, 'camp');
  assert.equal(ex.lacking, false);
  assert.ok(!ex.rows.some(r => /Not enough/.test(r.label)));
});
