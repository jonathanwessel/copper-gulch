// Every number explains itself (owner rule): output, prices, tower damage, shots and reach, the vault and income each
// break down into rows whose product (or sum) is exactly the number on screen, and every bonus source on the stat has
// its own row, so nothing stacks out of sight.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { explainOutput, explainPrice, explainTower, explainVault, explainIncome, paysEach, modRows } from '../src/core/explain.js';
import { output } from '../src/core/economy.js';
import { quote, sell } from '../src/core/market.js';
import { towerStats, vaultMax, callEarly, canCall, buildTower } from '../src/core/defense.js';
import { startResearch } from '../src/core/research.js';
import { pickPerk, applyAll } from '../src/core/charter.js';
import { encode, decode } from '../src/core/save.js';
import { loadGame } from '../src/core/setup.js';

const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
const product = ex => ex.rows.reduce((v, r) => (r.base !== undefined ? r.base : v * r.mul), 1);
/* A Gulch with research done, a perk picked and deeds held, so bonuses stack on every stat. */
function busy(seed = 'x') {
  const g = newGame(seed, 'gulch'), t = g.town;
  Object.assign(t.waves, { hold: true, timer: 0 });
  t.buildings.camp = 25; t.buildings.saw = 12; t.buildings.mine = 10; g.step(.25);
  t.coins = 1e12;
  for (const id of ['saws', 'gunsmith', 'walls', 'stalls', 'posters', 'saws']) { assert.ok(startResearch(g, t, id)); run(g, t.lab.left + .5); }
  g.shared.charter.deeds = 3; pickPerk(g, 'trade', 'b'); pickPerk(g, 'books', 'b'); g.step(.25);
  return { g, t };
}

test('a building\'s output is its level, milestones and every bonus, multiplied', () => {
  const { g, t } = busy();
  pickPerk(g, 'trade', 'a'); // already picked b: stays b
  for (const id of ['camp', 'saw', 'mine']) {
    const ex = explainOutput(t, id);
    assert.ok(near(product(ex), output(t, id)) && near(ex.value, output(t, id)), id);
    assert.equal(ex.unit, 'rate');
  }
  const camp = explainOutput(t, 'camp');
  assert.equal(camp.rows[0].label, 'Base at level 25');
  assert.ok(camp.rows.some(r => r.label === 'Level 10 and 25 bonuses' && r.mul === 4));
  assert.ok(explainOutput(t, 'saw').rows.some(r => r.label === 'Level 10 bonus' && r.mul === 2));
  assert.ok(camp.rows.some(r => r.label === 'Sharp Saws research' && near(r.mul, 1.5)));
});

test('a price is its base, the market and every bonus, and it is what a small sale pays', () => {
  const { g, t } = busy();
  run(g, 20); // timber floods the market
  const ex = explainPrice(g, t, 'timber');
  assert.ok(near(product(ex), ex.value));
  assert.ok(ex.rows.some(r => r.label === 'Sold a lot lately' && r.mul < 1), JSON.stringify(ex.rows));
  for (const s of ['Market Stalls research', 'Hard Bargain perk', 'Deeds']) assert.ok(ex.rows.some(r => r.label === s), s);
  assert.ok(Math.abs(quote(g, t, 'timber', 1e-6) / 1e-6 - paysEach(g, t, 'timber')) < 1e-6 * ex.value);
  const fresh = newGame('y', 'gulch');
  assert.deepEqual(explainPrice(fresh, fresh.town, 'planks').rows.map(r => r.label), ['Base price']);
});

test('tower damage, shots and reach come from the kind, its level, its path and the town\'s bonuses', () => {
  const { t } = busy();
  const towers = [
    { kind: 'crossbow', level: 1 }, { kind: 'crossbow', level: 7, path: 'b' }, { kind: 'cannon', level: 6, path: 'a' },
    { kind: 'still', level: 5, path: 'a' }, { kind: 'mortar', level: 3 }, { kind: 'frost', level: 9, path: 'b' },
  ];
  for (const tw of towers) {
    const ex = explainTower(t, tw), st = towerStats(t, tw);
    for (const k of ['dmg', 'rate', 'range']) assert.ok(near(product(ex[k]), st[k]) && near(ex[k].value, st[k]), tw.kind + ' ' + k);
    if (st.poison) assert.ok(near(product(ex.poison), st.poison), 'poison');
  }
  const lb = explainTower(t, { kind: 'crossbow', level: 7, path: 'b' });
  assert.deepEqual(lb.dmg.rows.map(r => r.label), ['Base damage', 'Level 7', 'Longbow path', 'Fort Town perk', 'Gunsmith research']);
  assert.deepEqual(lb.range.rows.map(r => r.label), ['Base range', 'Level 7', 'Longbow path']);
  assert.deepEqual(explainTower(t, { kind: 'crossbow', level: 1 }).rate.rows.map(r => r.label), ['Base shots']);
});

test('the vault: its strength in hits, each bonus, hits left and what each raider takes', () => {
  const { g, t } = busy();
  pickPerk(g, 'law', 'b'); // needs 5 deeds: not yet
  g.shared.charter.deeds = 5; assert.ok(pickPerk(g, 'law', 'b')); g.step(.25);
  const ex = explainVault(t);
  assert.equal(ex.value, vaultMax(t));
  assert.ok(Math.abs(product(ex) - ex.value) <= .5);
  assert.deepEqual(ex.rows.map(r => r.label), ['Full vault', 'Stone Walls perk', 'Thick Walls research']);
  assert.equal(ex.left, Math.ceil(t.vault.hp));
  assert.deepEqual(ex.raiders.map(r => r.label), ['Bandit', 'Rider', 'Brute', 'War wagon']);
  const dc = newGame('d').town;
  assert.equal(explainVault(dc).rows[0].label, 'Full stockpile');
  assert.ok(explainVault(dc).raiders.some(r => r.label === 'Bandit wagon'));
});

test('income: every coin is filed by where it came from, and the parts add up to the coins earned', () => {
  const g = newGame('i', 'gulch'), t = g.town;
  t.buildings.camp = 10; t.coins = 1e6; t.goods.timber = 200;
  for (const s of [0, 1, 2, 3]) assert.ok(buildTower(g, t, s, 'crossbow'));
  const before = { ...t.tally }, l0 = t.lifetime;
  run(g, 90); // sales, and the first waves' bounties
  let sec = 90;
  while (!(canCall(t) && t.waves.timer > 3)) { g.step(.25); sec += .25; }
  assert.ok(callEarly(g, t) > 0);
  const ex = explainIncome(t, before, t.tally, sec);
  assert.ok(near(ex.value * sec, t.lifetime - l0), ex.value * sec + ' vs ' + (t.lifetime - l0));
  const keys = ex.rows.map(r => r.key);
  for (const k of ['sale:timber', 'bounty', 'call']) assert.ok(keys.includes(k), k + ' in ' + keys);
  assert.ok(!keys.includes('other'));
  assert.equal(ex.rows.find(r => r.key === 'sale:timber').label, 'Selling timber');
  for (let i = 1; i < ex.rows.length; i++) assert.ok(ex.rows[i - 1].value >= ex.rows[i].value, 'biggest first');
  // the tally is not saved
  assert.equal(decode(encode(g, 0)).game.towns.gulch.tally, undefined);
  assert.deepEqual(loadGame(decode(encode(g, 0)).game).town.tally, {});
});

test('an outpost\'s sales show as its own line in the town in play, with the bonuses listed', () => {
  const g = newGame('o'), dc = g.towns.drycreek;
  dc.won = true; g.addTown('gulch'); g.go('gulch');
  const t = g.town; g.shared.charter.deeds = 2; applyAll(g);
  dc.goods.stone = 50; sell(g, dc, 'stone', 10, 0, t);
  const ex = explainIncome(t, {}, t.tally, 1);
  assert.equal(ex.rows[0].label, 'Dry Creek goods');
  assert.deepEqual(ex.bonuses.map(b => [b.label, b.on]), [['Deeds', 'all']]);
});

test('a capped stat shows the cap as its own row', () => {
  const g = newGame('c', 'gulch'), t = g.town;
  t.mods.set('towerRange', 'Test', { mul: 5 });
  const rows = modRows(t.mods, 'towerRange');
  assert.deepEqual(rows.map(r => r.label), ['Test', 'Top limit']);
  const ex = explainTower(t, { kind: 'crossbow', level: 1 });
  assert.ok(near(product(ex.range), towerStats(t, { kind: 'crossbow', level: 1 }).range));
});
