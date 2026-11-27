// The Mesa's strip asks for a Tesla Coil before the airships (PLAN.md M6b, found with part 2b): from wave 7 a Tesla
// Coil on the pad that reach the most of the sky lane, from wave 11 one of them to its path, then the first pirate
// airship. tools/mesa-newcomer.js plays the newcomer through them from six Falls-era games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { goalNow, goalContext } from '../src/core/goals.js';
import { skyReach, fitsSpot, isPit, towerOpen } from '../src/core/defense.js';
import { GOALS, TESLA_ASK, TESLA_FROM, TESLA_PATH_FROM } from '../src/data/goals.js';
import { TOWNS } from '../src/data/towns/index.js';

const F = TOWNS.mesa.found;
function mesa(seed = 'tesla-step') {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  g.towns.falls.bestWave = F.wave; g.town.coins = F.coins * 1.1;
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = 3; g.shared.charter.deeds = F.deeds || 0;
  foundTown(g, 'mesa'); g.go('mesa');
  const t = g.towns.mesa;
  t.flags['open:tesla'] = true;
  return { g, t };
}
const step = id => GOALS.find(x => x.id === id);
const tw = (spot, kind, level, path = null) => ({ spot, kind, level, path, fork: null, cd: 0, spent: 0, pulses: 0 });

test('the Tesla step waits for wave 7, then comes first in the Mesa', () => {
  const { g, t } = mesa();
  assert.ok(towerOpen(t, 'tesla'));
  t.bestWave = TESLA_FROM - 1;
  assert.equal(step('m-tesla').ready(goalContext(g, t)), false);
  t.bestWave = TESLA_FROM;
  const first = GOALS.find(x => x.town === 'mesa' && !g.shared.goals.done[x.id] && (!x.ready || x.ready(goalContext(g, t))));
  assert.equal(first.id, 'm-tesla');
});

test('its spotlight is on the free pad that reaches the most of the sky lane', () => {
  const { g, t } = mesa();
  const c = goalContext(g, t), spot = step('m-tesla').at(c).spot, spots = t.def.board.spots;
  assert.ok(skyReach(t, spot) > 0, 'the lit pad reaches the sky');
  for (let i = 0; i < spots.length; i++) if (!isPit(t, i) && fitsSpot(t, i, 'tesla')) assert.ok(skyReach(t, i) <= skyReach(t, spot) + 1e-9, 'pad ' + i + ' reaches more');
  // and the first free pad by number reaches less, so the choice matters on this board
  assert.ok(skyReach(t, c.freeSpot()) < skyReach(t, spot));
  // once that pad is taken it lights the next best one
  t.towers.push(tw(spot, 'tesla', 1));
  const next = step('m-tesla').at(goalContext(g, t)).spot;
  assert.notEqual(next, spot);
  assert.ok(skyReach(t, next) > 0);
});

test('a Tesla clears it, then a path, then the pirate airship', () => {
  const { g, t } = mesa();
  t.bestWave = TESLA_PATH_FROM;
  const c = () => goalContext(g, t);
  assert.equal(TESLA_ASK, 1);
  assert.equal(step('m-tesla').done(c()), false);
  t.towers.push(tw(0, 'tesla', 4));
  assert.equal(step('m-tesla').done(c()), true);
  t.towers.push(tw(1, 'tesla', 1));
  // the path step lights the highest Tesla with no path, and clears once one has a path
  assert.equal(step('m-teslapath').ready(c()), true);
  assert.equal(step('m-teslapath').at(c()).tower, 0);
  t.towers[0].level = 5; t.towers[0].path = 'a';
  assert.equal(step('m-teslapath').done(c()), true);
  assert.equal(step('m-pirate').done(c()), false);
  t.bestWave = 20;
  assert.equal(step('m-pirate').done(c()), true);
});

test('the strip in play shows the Tesla step at wave 7', () => {
  const { g, t } = mesa();
  t.bestWave = TESLA_FROM;
  const s = goalNow(g);
  assert.ok(s && s.id.startsWith('m-tesla'), 'strip shows ' + (s && s.id));
});

test('a board with no sky reaches nothing', () => {
  const g = newGame('no-sky', 'gulch');
  assert.equal(skyReach(g.towns.gulch, 0), 0);
});
