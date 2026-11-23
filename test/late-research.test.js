// Iron Ridge's late research (clarity fix 3b part 1, PLAN.md M6a): three items show up as the Ridge's best wave
// climbs toward the Capital (Telescope Sights at 27, Steam Hammers at 32, Bounty Office at 37), each with a price
// shown on its card, so the careful bots no longer go an hour with nothing new between the Ridge's routes and the
// Capital. A save already past those waves gets them too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { itemsOf, startResearch, researchBlock } from '../src/core/research.js';
import { towerStats, fitsSpot } from '../src/core/defense.js';
import { output, cost } from '../src/core/economy.js';
import { RESEARCH } from '../src/data/research.js';
import { TOWNS } from '../src/data/towns/index.js';

const LATE = { sights: 27, hammers: 32, bounties: 37 };
const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
function ridge(seed = 'late') {
  const g = newGame(seed, 'ridge'), t = g.town;
  Object.assign(t.waves, { hold: true, timer: 0 });
  t.buildings.rquarry = 5; t.buildings.ironmine = 5; t.buildings.colliery = 5; t.buildings.furnace = 1;
  t.coins = 1e9; g.step(.25);
  return { g, t };
}
const finish = (g, t, id) => { assert.ok(startResearch(g, t, id), 'started ' + id); run(g, t.lab.left + .5); };

test('the late Ridge items show up at their waves, one research:new each, and not before', () => {
  const { g, t } = ridge(), ev = g.bus.record();
  for (const id of Object.keys(LATE)) { assert.ok(TOWNS.ridge.research.includes(id)); assert.equal(RESEARCH[id].opens, LATE[id]); }
  t.bestWave = 26; g.step(.25);
  for (const id of Object.keys(LATE)) { assert.ok(!itemsOf(t).includes(id), id + ' hidden at 26'); assert.equal(researchBlock(t, id), 'closed'); }
  for (const [id, w] of Object.entries(LATE)) {
    t.bestWave = w; g.step(.25); g.step(.25);
    assert.ok(itemsOf(t).includes(id), id + ' shows at ' + w);
    assert.equal(ev.filter(([n, e]) => n === 'research:new' && e.id === id).length, 1, 'one research:new for ' + id);
  }
});

test('each late item has its effect and its price, as its card says', () => {
  const { g, t } = ridge('late-fx');
  t.bestWave = 40; g.step(.25);
  const spot = t.def.board.spots.findIndex((s, i) => fitsSpot(t, i, 'crossbow'));
  t.towers.push({ spot, kind: 'crossbow', level: 1, path: null, fork: null, cd: 0, spent: 0, pulses: 0 });
  const tw = t.towers[0], before = towerStats(t, tw);
  finish(g, t, 'sights');
  const after = towerStats(t, tw);
  assert.ok(Math.abs(after.range / before.range - 1.1) < 1e-9, 'reaches 10% farther');
  assert.ok(Math.abs(after.rate / before.rate - .85) < 1e-9, 'fires 15% slower');
  const out0 = output(t, 'rquarry'), cost0 = cost(t, 'rquarry');
  finish(g, t, 'hammers');
  assert.ok(Math.abs(output(t, 'rquarry') / out0 - 1.15) < 1e-6, 'buildings work 15% faster');
  assert.ok(cost(t, 'rquarry') > cost0 && Math.abs(t.mods.factor('cost:build') - 1.15) < 1e-9, 'a level costs 15% more');
  const h0 = t.mods.factor('foeHp'), b0 = t.mods.factor('bounty');
  finish(g, t, 'bounties');
  assert.ok(Math.abs(t.mods.factor('bounty') / b0 - 1.4) < 1e-9, 'raiders drop 40% more coins');
  assert.ok(Math.abs(t.mods.factor('foeHp') / h0 - 1.1) < 1e-9, 'raiders have 10% more health');
  for (const id of Object.keys(LATE)) {
    const r = RESEARCH[id];
    assert.ok(r.about && r.worse && r.downside.length, id + ' shows both sides');
    assert.ok(r.about.split(' ').length <= 8 && r.worse.split(' ').length <= 8, id + ' says it in a short line');
  }
});

test('a save already past the late waves gets the late items (new choices reach old saves)', () => {
  const { g, t } = ridge('late-old');
  t.bestWave = 45;
  const data = JSON.parse(JSON.stringify(g.toJSON()));
  const g2 = loadGame(data), t2 = g2.towns.ridge, ev = g2.bus.record();
  g2.step(.25);
  for (const id of Object.keys(LATE)) assert.ok(itemsOf(t2).includes(id), id + ' on an old save at wave 45');
  assert.equal(ev.filter(([n]) => n === 'research:new').length, 3);
});
