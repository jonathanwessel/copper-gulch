// Evaluation 2 (M5, 2026-11-19): waves never stay on hold with nothing on screen to start them. The newcomer bot held
// the Gulch's waves to save for Iron Ridge and never resumed them, and the Ridge's vault fell while it was in the Gulch,
// so from about an hour in both towns sat on hold. Now founding a town starts the paying town's waves again, and the
// goal strip asks for Resume waves (in the town in play first, then in a town that lost while away) before any other
// goal, except while the town holds to save for its next town.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalText } from '../src/core/goals.js';
import { setHold, fall } from '../src/core/defense.js';
import { foundTown } from '../src/core/empire.js';
import { GOALS } from '../src/data/goals.js';
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';
import { textIssues } from '../tools/audit.js';

function gulch(seed, wave, coins) {
  const g = newGame(seed, 'gulch'), t = g.town;
  for (const x of GOALS) if (x.town === 'gulch' && !x.within) g.shared.goals.done[x.id] = true;
  t.bestWave = wave; t.coins = coins;
  return g;
}

test('founding a town starts the waves the paying town held to save for it', () => {
  const g = gulch('h1', 20, 15000), t = g.town;
  setHold(g, t, true);
  assert.equal(goalNow(g).id, 'g-found', 'holding to save: the strip still says to found the Ridge');
  const ev = g.bus.record();
  foundTown(g, 'ridge');
  assert.equal(t.waves.hold, false);
  assert.deepEqual(ev.filter(([n]) => n === 'town:found').map(([, e]) => e.resumed), [true]);
});

test('a hold from a loss stays on when the town founds the next one', () => {
  const g = gulch('h2', 20, 15000), t = g.town;
  g.addTown('pinehollow'); g.active = 'pinehollow';
  t.wave = 20; fall(g, t, 'vault');
  assert.equal(t.waves.autoHold, true);
  t.coins = 15000; foundTown(g, 'ridge');
  assert.equal(t.waves.hold, true, 'it waits for the player to come back');
});

test('the strip asks for Resume waves first in the town in play, but not while it saves', () => {
  const g = gulch('h3', 25, 0), t = g.town;
  g.addTown('ridge'); g.addTown('pinehollow');
  setHold(g, t, true);
  const gl = goalNow(g);
  assert.equal(gl.id, 'resume');
  assert.equal(goalText(g, t, gl), 'Tap Resume waves');
  assert.deepEqual(gl.at(), { el: '#holdWaves' });
  assert.deepEqual(textIssues(gl.text), []);
  const tap = goalTap(g, t, new Rng(1));
  assert.equal(tap.what, 'resume');
  tap.run();
  assert.equal(t.waves.hold, false, 'the newcomer taps it');
  assert.notEqual((goalNow(g) || {}).id, 'resume');
  // saving for the Ridge: no Resume waves
  const s = gulch('h4', 20, 500);
  setHold(s, s.town, true);
  assert.equal(goalNow(s).id, 'g-save');
});

test('the strip sends the player to a town that lost while away, unless Keep trying the boss handles it', () => {
  const g = gulch('h5', 25, 0);
  const r = g.addTown('ridge'); g.addTown('pinehollow');
  r.wave = 12; r.bestWave = 11; fall(g, r, 'vault');
  assert.equal(r.waves.autoHold, true);
  const gl = goalNow(g);
  assert.equal(gl.id, 'resume-ridge');
  assert.equal(gl.text, 'Go to Iron Ridge and tap Resume waves');
  assert.deepEqual(textIssues(gl.text), []);
  assert.deepEqual(gl.at({ back: 'ridge' }), { el: '#backBtn', go: 'ridge' });
  assert.deepEqual(gl.at({ back: 'drycreek' }), { el: '#mapBtn', go: 'ridge' });
  g.go('ridge');
  assert.equal(goalNow(g).id, 'resume', 'there: Tap Resume waves');
  setHold(g, r, false);
  assert.notEqual((goalNow(g) || {}).id, 'resume');
  g.go('gulch');
  assert.ok(!(goalNow(g) || { id: '' }).id.startsWith('resume'));
});

test('after a loss the strip says to build towers first, as the lost card does', () => {
  const g = gulch('h6', 25, 0), t = g.town;
  g.addTown('ridge'); g.addTown('pinehollow');
  t.wave = 10; t.bestWave = 9; fall(g, t, 'boss');
  assert.equal(t.waves.autoHold, true, 'a lost boss holds the town in play');
  const gl = goalNow(g);
  assert.equal(gl.id, 'resume');
  assert.equal(gl.text, 'Build more towers, then tap Resume waves');
  assert.deepEqual(textIssues(gl.text), []);
});
