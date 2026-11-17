// Town research: it opens with the Sawmill, costs coins and takes time, runs one item at a time, and each level puts
// a named bonus on a stat (so the explain view lists it). Hot Furnaces is faster but burns more timber.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { startResearch, researchCost, researchTime, researchBlock, researchLevel, researchOpen, itemsOf } from '../src/core/research.js';
import { output, explainOutput, demand, build, uses } from '../src/core/economy.js';
import { towerStats, buildTower, vaultMax } from '../src/core/defense.js';
import { price } from '../src/core/market.js';
import { RESEARCH, GROWTH, TIME, TIME_GROWTH } from '../src/data/research.js';
import { WAVE } from '../src/data/foes.js';
import { migrate, SAVE_VERSION, encode, decode } from '../src/core/save.js';

const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
/* A town with research open, waves held so nothing breaks it, and plenty of coins. */
function ready(seed = 'r') {
  const g = newGame(seed, 'gulch'), t = g.town;
  Object.assign(t.waves, { hold: true, timer: 0 });
  t.buildings.camp = 10; t.buildings.saw = 1; g.step(.25);
  t.coins = 1e9;
  return { g, t };
}
/* Run one item to its next level. */
const finish = (g, t, id) => { assert.ok(startResearch(g, t, id), 'started ' + id); run(g, t.lab.left + .5); };

test('research opens when the Sawmill is built, and not before', () => {
  const g = newGame('r0', 'gulch'), t = g.town, ev = g.bus.record();
  Object.assign(t.waves, { hold: true, timer: 0 }); t.coins = 1e9;
  run(g, 5);
  assert.equal(researchOpen(t), false);
  assert.equal(researchBlock(t, 'saws'), 'closed');
  assert.equal(startResearch(g, t, 'saws'), false);
  t.buildings.camp = 5; assert.ok(build(g, t, 'saw')); g.step(.25);
  assert.ok(researchOpen(t) && ev.some(([n]) => n === 'research:open'));
  assert.equal(researchBlock(t, 'saws'), null);
});

test('every item the town lists exists, with a name, text and levels', () => {
  const { t } = ready();
  assert.ok(itemsOf(t).length >= 6 && itemsOf(t).length <= 8);
  for (const id of itemsOf(t)) {
    const r = RESEARCH[id];
    assert.ok(r && r.name && r.about && r.max >= 1 && r.cost > 0 && r.effects.length, id);
    assert.ok(!/[:;]/.test(r.about + (r.worse || '')), id + ' text has a colon or semicolon');
  }
});

test('a level costs coins up front, takes its time, then counts', () => {
  const { g, t } = ready('r1'), ev = g.bus.record();
  const c = researchCost(t, 'saws'), s = researchTime(t, 'saws');
  assert.equal(c, RESEARCH.saws.cost); assert.equal(s, TIME);
  const coins = t.coins; assert.ok(startResearch(g, t, 'saws'));
  assert.equal(t.coins, coins - c);
  assert.equal(researchLevel(t, 'saws'), 0);
  run(g, s - 1); assert.equal(researchLevel(t, 'saws'), 0, 'not done early');
  run(g, 1.25); assert.equal(researchLevel(t, 'saws'), 1);
  assert.equal(t.lab, null);
  assert.ok(ev.some(([n, d]) => n === 'research:done' && d.id === 'saws' && d.level === 1));
  assert.equal(researchCost(t, 'saws'), RESEARCH.saws.cost * GROWTH);
  assert.equal(researchTime(t, 'saws'), TIME * TIME_GROWTH);
});

test('one item at a time, never past its last level, and only with the coins', () => {
  const { g, t } = ready('r2');
  assert.ok(startResearch(g, t, 'saws'));
  assert.equal(researchBlock(t, 'walls'), 'busy');
  assert.equal(startResearch(g, t, 'walls'), false);
  run(g, 30);
  t.coins = 0; assert.equal(researchBlock(t, 'walls'), 'coins'); assert.equal(startResearch(g, t, 'walls'), false);
  t.coins = 1e12;
  for (let i = 0; i < RESEARCH.furnaces.max; i++) finish(g, t, 'furnaces');
  assert.equal(researchBlock(t, 'furnaces'), 'max');
  assert.equal(startResearch(g, t, 'furnaces'), false);
});

test('Sharp Saws makes the camp and the sawmill faster, and the explain view names it', () => {
  const { g, t } = ready('r3');
  const camp = output(t, 'camp'), saw = output(t, 'saw'), mine = output(t, 'mine');
  finish(g, t, 'saws'); finish(g, t, 'saws');
  assert.ok(Math.abs(output(t, 'camp') - camp * 1.5) < 1e-9);
  assert.ok(Math.abs(output(t, 'saw') - saw * 1.5) < 1e-9);
  assert.equal(output(t, 'mine'), mine);
  const part = explainOutput(t, 'camp').find(p => p.source === 'Sharp Saws research');
  assert.ok(part && Math.abs(part.factor - 1.5) < 1e-9);
});

test('Hot Furnaces: the smelter works 60% faster and burns one more timber per copper', () => {
  const { g, t } = ready('r4');
  t.buildings.mine = 10; t.buildings.smelter = 5;
  const out = output(t, 'smelter'), use = demand(t).timber;
  assert.equal(uses(t, 'smelter', 'timber'), 1);
  finish(g, t, 'furnaces');
  assert.ok(Math.abs(output(t, 'smelter') - out * 1.6) < 1e-9);
  assert.equal(uses(t, 'smelter', 'timber'), 2);
  assert.equal(uses(t, 'smelter', 'ore'), 2, 'ore use is unchanged');
  assert.ok(demand(t).timber > use * 1.5);
  // making copper now takes two timber each
  t.goods = { ore: 100, timber: 100 }; t.sell = { ore: false, timber: false, copper: false };
  t.buildings.camp = 0; t.buildings.mine = 0; t.buildings.saw = 0; t.buildings.kiln = 0;
  const made = output(t, 'smelter') * .25; g.step(.25);
  assert.ok(Math.abs((t.goods.copper || 0) - made) < 1e-9);
  assert.ok(Math.abs(100 - t.goods.timber - made * 2) < 1e-9);
});

test('Gunsmith, Thick Walls, Wanted Posters and Market Stalls', () => {
  const { g, t } = ready('r5');
  t.goods.timber = 100; t.sell.timber = false;
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  const dmg = towerStats(t, t.towers[0]).dmg;
  finish(g, t, 'gunsmith'); assert.ok(Math.abs(towerStats(t, t.towers[0]).dmg - dmg * 1.15) < 1e-9);
  assert.equal(t.vault.max, WAVE.vault);
  t.vault.hp = WAVE.vault - 4;
  finish(g, t, 'walls');
  assert.equal(t.vault.max, vaultMax(t)); assert.equal(vaultMax(t), Math.round(WAVE.vault * 1.25));
  assert.equal(t.vault.hp, WAVE.vault - 4 + vaultMax(t) - WAVE.vault, 'the new strength is added, the damage stays');
  finish(g, t, 'stalls'); assert.ok(Math.abs(t.mods.factor('price') - 1.1) < 1e-9);
  const sat = price(g, t, 'planks') / (t.mods.factor('price') * 3); assert.ok(sat > 0 && sat <= 1, 'the price carries the bonus');
  finish(g, t, 'posters'); assert.ok(Math.abs(t.mods.factor('bounty') - 1.3) < 1e-9);
});

test('research keeps going while the game catches up time away', () => {
  const { g, t } = ready('r6');
  assert.ok(startResearch(g, t, 'shafts'));
  g.catchUp(600);
  assert.equal(researchLevel(t, 'shafts'), 1);
});

test('save v5: research and the running item survive a save, and an older save gets research open with its Sawmill', () => {
  assert.ok(SAVE_VERSION >= 5);
  const { g, t } = ready('r7');
  finish(g, t, 'saws'); assert.ok(startResearch(g, t, 'walls')); run(g, 3);
  const back = loadGame(decode(encode(g, 0)).game), b = back.town;
  assert.deepEqual(b.research, { saws: 1 });
  assert.equal(b.lab.id, 'walls'); assert.ok(Math.abs(b.lab.left - t.lab.left) < 1e-9);
  assert.equal(output(b, 'camp'), output(t, 'camp'));
  const old = migrate({ v: 4, at: 0, game: { towns: { gulch: { buildings: { camp: 6, saw: 2 }, flags: {} }, other: { buildings: { camp: 2 } } } } });
  assert.equal(old.v, SAVE_VERSION);
  assert.equal(old.game.towns.gulch.flags['open:research'], true);
  assert.equal(old.game.towns.gulch.lab, null);
  assert.ok(!old.game.towns.other.flags['open:research']);
});
