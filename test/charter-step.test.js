// Clarity fix 9 (PLAN.md M6a): the charter is guided. Once the charter is out, the strip asks for a charter that pays
// when the player would otherwise only wait for a climb: a town's first charter when it is not the town that must climb,
// or a charter whose deeds make up all the deeds the next place needs. The newcomer bot signs when it asks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalsOf, nextStep, charterAsk, meterWords } from '../src/core/goals.js';
import { foundTown } from '../src/core/empire.js';
import { deedsFor, signCharter } from '../src/core/charter.js';
import { DEEDS } from '../src/data/perks.js';
import { TOWNS } from '../src/data/towns/index.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { textIssues } from '../tools/audit.js';
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';

const allDone = (g, town) => { for (const x of goalsOf(town)) g.shared.goals.done[x.id] = true; };
function ridgeGame(seed) {
  const g = newGame(seed, 'gulch'), t = g.town;
  t.bestWave = 20; t.coins = 1e6; foundTown(g, 'ridge');
  for (const id of ['gulch', 'ridge', 'drycreek', 'pinehollow']) allDone(g, id);
  g.towns.ridge.bestWave = 10;
  return g;
}

test('no charter step before the charter is offered, even when a town would pay', () => {
  const g = ridgeGame('cs1'), gu = g.towns.gulch;
  gu.lifetime = DEEDS.coins;
  assert.equal(deedsFor(gu), 1);
  g.go('ridge');
  assert.equal(nextStep(g).id, 'next:capital:wave');
});

test('the Gulch first charter comes before the wait for the Ridge to climb, and the newcomer signs it there', () => {
  const g = ridgeGame('cs2'), gu = g.towns.gulch;
  gu.lifetime = DEEDS.coins; g.shared.charter.offered = true;
  g.go('ridge');
  let x = goalNow(g);
  assert.equal(x.id, 'charter:gulch:there');
  assert.equal(x.text, 'Tap Map, Copper Gulch, then sign its charter in Perks');
  assert.equal(x.at().go, 'gulch');
  // in the Gulch it points at Perks
  g.go('gulch');
  x = goalNow(g);
  assert.equal(x.id, 'charter:gulch:1', 'the count is in the id, so the strip repaints when it grows');
  assert.equal(x.text, 'Tap Perks, then tap Sign the charter to get 1 deed');
  assert.equal(x.at().el, '#perksBtn');
  const tap = goalTap(g, g.town, new Rng('cs2'));
  assert.equal(tap.what, 'sign');
  assert.ok(tap.run());
  assert.equal(g.shared.charter.deeds, 1);
  // signed once: not asked again for one more deed, so the town is never reset in a loop
  gu.lifetime = DEEDS.coins;
  assert.ok(deedsFor(gu) >= 1);
  assert.equal(charterAsk(g, null), null);
  assert.notEqual((goalNow(g) || {}).charter, 'gulch');
});

test('the town that must climb is not asked for its charter while it climbs for the Capital', () => {
  const g = ridgeGame('cs3'), r = g.towns.ridge;
  g.shared.charter.offered = true;
  r.bestWave = CAPITAL_DEF.found.wave - 1; r.lifetime = DEEDS.coins;
  assert.equal(deedsFor(r), 1);
  g.go('ridge');
  assert.equal(nextStep(g).id, 'next:capital:wave');
});

test('for Silver Falls the climbing town is asked once its deeds make up all that is missing, with the deeds counted', () => {
  const g = ridgeGame('cs4'), r = g.towns.ridge, need = TOWNS.falls.found.deeds;
  g.shared.charter.offered = true; g.shared.capital.open = true;
  g.shared.charter.deeds = 1; g.towns.gulch.charters = 1;
  r.bestWave = 40; r.lifetime = 0;
  g.go('ridge');
  assert.ok(deedsFor(r) < need - 1);
  assert.equal(nextStep(g).id, 'next:falls:wave', 'too few deeds: it climbs on');
  r.lifetime = DEEDS.coins * 10; // 2 coin deeds on top of 2 wave deeds
  assert.ok(deedsFor(r) >= need - 1);
  const x = nextStep(g);
  assert.equal(x.id, 'charter:ridge:' + deedsFor(r));
  assert.equal(x.text, 'Tap Perks, then tap Sign the charter', 'its two taps, the deeds in the meter beside it (clarity fix 8d: three things in one line)');
  assert.equal(meterWords(x, g), '1 / ' + need + ' deeds');
  assert.equal(signCharter(g, r), deedsFor({ bestWave: 40, ownEarned: DEEDS.coins * 10 }));
  assert.ok(g.shared.charter.deeds >= need);
});

test('the charter step lines follow the writing rule', () => {
  for (const s of ['Tap Map, Copper Gulch, then sign its charter in Perks', 'Tap Perks, then tap Sign the charter to get 1 deed', 'Tap Perks, then tap Sign the charter to get 4 deeds', 'Tap Perks, then tap Sign the charter'])
    assert.deepEqual(textIssues(s), [], s);
});
