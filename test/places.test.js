/* The place bar (owner rule, 2026-11-17: the top bar never grows with the towns): one back button to the last place
   in play, kept in the save; the map badges carry the alerts; goals that send the player elsewhere spotlight the back
   button or Map. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { winOutpost } from '../src/core/outpost.js';
import { foundTown } from '../src/core/empire.js';
import { siteInfo } from '../src/core/map.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { GOALS } from '../src/data/goals.js';
import { goalContext } from '../src/core/goals.js';

const opened = () => { const g = newGame('places'); winOutpost(g, g.town); return g; };

test('the back button goes to the last place in play, and two places are one tap apart', () => {
  const g = opened();
  assert.equal(g.active, 'drycreek');
  assert.equal(g.back, null, 'nowhere to go back to before the first switch');
  g.go('gulch');
  assert.equal(g.back, 'drycreek');
  g.go(g.back);
  assert.equal(g.active, 'drycreek');
  assert.equal(g.back, 'gulch', 'the back button now points the other way');
  assert.equal(g.go('drycreek'), false, 'going to the town in play changes nothing');
  assert.equal(g.back, 'gulch');
});

test('the back button stays on the place you came from when a new town is founded', () => {
  const g = opened(); g.go('gulch');
  const t = g.town; t.bestWave = 20; t.coins = 1e6;
  assert.ok(foundTown(g, 'ridge'));
  g.go('ridge');
  assert.equal(g.back, 'gulch');
});

test('the last place is saved, and an old save loads with no back button', () => {
  const g = opened(); g.go('gulch');
  const back = loadGame(decode(encode(g, 1)).game);
  assert.equal(back.active, 'gulch');
  assert.equal(back.back, 'drycreek');
  assert.ok(SAVE_VERSION >= 13);
  const old = JSON.parse(encode(g, 1)); old.v = 12; delete old.game.prev;
  const m = migrate(old);
  assert.equal(m.v, SAVE_VERSION);
  assert.equal(m.game.prev, null);
  assert.equal(loadGame(m.game).back, null);
  // a save that names a town it does not have keeps no back button
  const bad = JSON.parse(encode(g, 1)); bad.game.prev = 'ridge';
  assert.equal(loadGame(migrate(bad).game).back, null);
});

test('a town raided while you were elsewhere shows on its map badge until you go there', () => {
  const g = opened(); g.go('gulch');
  const dc = g.towns.drycreek;
  assert.equal(siteInfo(g, 'drycreek').alert, null);
  dc.breaches = (dc.breaches || 0) + 1;
  assert.equal(siteInfo(g, 'drycreek').alert, 'raided');
  g.go('drycreek');
  assert.equal(siteInfo(g, 'drycreek').alert, null, 'the town in play never carries the alert');
});

test('a goal that sends you to another place spotlights the back button when it goes there, else Map', () => {
  const g = opened();
  const go = GOALS.find(x => x.id === 'dc-go');
  assert.equal(go.text, 'Tap Map, then tap Copper Gulch');
  assert.deepEqual(go.at(goalContext(g, g.town)), { el: '#mapBtn', go: 'gulch' });
  g.go('gulch'); g.go('drycreek');
  assert.deepEqual(go.at(goalContext(g, g.town)), { el: '#backBtn', go: 'gulch' });
  for (const x of GOALS) if (x.at) { const a = x.at(goalContext(g, g.town)) || {}; assert.ok(!(a.el || '').includes('townChip'), x.id + ' points at the old town buttons'); }
});
