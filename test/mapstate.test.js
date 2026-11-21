// Every place shows its wave state from the map (owner, 2026-11-20: "Does Dry Creek waves keep going? In map view it's
// hard to see the status of the waves in each city"): siteState in the core, and the words and marks the label and the
// card show (src/ui/state.js), the same in every town and outpost.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { winOutpost } from '../src/core/outpost.js';
import { siteState } from '../src/core/map.js';
import { setHold, startWave, buildTower } from '../src/core/defense.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { clock, timeWords, stateWord, stateMark, stateNeeds, stateBar, stateLines } from '../src/ui/state.js';
import { waveTitle, waveLines } from '../src/ui/wave.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.advance(.25); };

test('clock and time words', () => {
  assert.equal(clock(24), '0:24'); assert.equal(clock(23.2), '0:24'); assert.equal(clock(120), '2:00'); assert.equal(clock(0), '0:00');
  assert.equal(clock(1e9), "9:59");
  assert.equal(timeWords(24), '24 sec'); assert.equal(timeWords(120), '2 min'); assert.equal(timeWords(90), '1 min 30 sec');
});

test('a town counting down, fighting and on hold reads Next, Fighting and On hold, with the raiders left', () => {
  const g = newGame('ms1'), t = g.town;
  let s = siteState(g, t.id);
  assert.equal(s.state, 'next'); assert.equal(stateWord(s), 'Next in ' + clock(t.waves.timer)); assert.equal(stateMark(s), 'clock');
  assert.equal(stateBar(s, t.waves.timer * 2), .5, 'the bar fills as the countdown runs');
  assert.match(stateLines(s)[0], /^Wave 1 comes in \d+ sec\.$/);
  assert.ok(startWave(g, t));
  s = siteState(g, t.id);
  assert.equal(s.state, 'fight'); assert.equal(stateWord(s), 'Fighting'); assert.equal(stateMark(s), 'swords');
  assert.equal(s.size, t.waves.queue.length); assert.equal(s.left, s.size); assert.equal(stateBar(s), 0);
  assert.equal(stateLines(s)[0], 'Fighting wave 1, ' + s.left + ' raiders left.');
  run(g, 4);
  s = siteState(g, t.id);
  assert.ok(s.left <= s.size);
  // held by the player between waves
  Object.assign(t.waves, { phase: 'break', queue: [], foes: [], timer: 30 });
  setHold(g, t, true);
  s = siteState(g, t.id);
  assert.equal(s.state, 'hold'); assert.equal(stateWord(s), 'On hold'); assert.equal(stateMark(s), 'pause');
  assert.equal(stateNeeds(s), true, 'red: the player holds it'); assert.equal(stateBar(s), null);
  assert.equal(stateLines(s)[0], 'Wave ' + t.wave + ' is on hold until you tap Resume waves there.');
  assert.deepEqual(stateLines(s, { lost: true }), [], 'a loss has its own line on the card');
});

test('a won outpost reads Raids with the time to the next raid, and its card says the raids keep coming', () => {
  const g = newGame('ms2'), d = g.town;
  buildTower(g, d, 0, 'crossbow');
  winOutpost(g, d); g.go('gulch');
  let s = siteState(g, 'drycreek');
  assert.equal(s.state, 'raids'); assert.equal(stateMark(s), 'flag'); assert.equal(stateWord(s), 'Raid in ' + clock(s.timer));
  assert.equal(s.raid, d.def.raid);
  const lines = stateLines(s);
  assert.equal(lines[0], 'Won. Light raids keep coming every 2 min. Your towers hold them.');
  assert.match(lines[1], /^Next raid in .+\.$/);
  assert.equal(waveTitle(d), 'Raids', 'its own wave bar says Raids, not a stuck wave number');
  assert.equal(waveTitle(g.towns.gulch), 'Wave 1');
  assert.ok(waveLines(d).some(l => l.startsWith('Won. Light raids')));
  // the raid comes and is fought in the background: the label says Fighting
  let seen = false;
  for (let i = 0; i < 4 * 200 && !seen; i++) { g.advance(.25); seen = siteState(g, 'drycreek').state === 'fight'; }
  assert.ok(seen, 'a raid shows as a fight');
  s = siteState(g, 'drycreek');
  assert.match(stateLines(s)[1], /^A raid is on now, \d+ raiders? left\.$/);
});

test('a town away with no tower waits for the player, in red', () => {
  const g = newGame('ms3'); winOutpost(g, g.town);
  const s = siteState(g, 'gulch');
  assert.equal(s.state, 'wait'); assert.equal(stateWord(s), 'No towers'); assert.equal(stateNeeds(s), true);
  assert.equal(stateLines(s)[0], 'Wave 1 waits until you build a tower here.');
  assert.equal(siteState(g, 'ridge'), null, 'a place not open has no state');
});

test('every label word fits its 12-character cell, and a hold Auto will lift reads Retry soon', () => {
  for (const s of [{ state: 'fight' }, { state: 'hold', needs: true }, { state: 'hold', needs: false }, { state: 'wait' }, { state: 'next', timer: 5999 }, { state: 'raids', timer: 1e9 }]) assert.ok(stateWord(s).length <= 12, stateWord(s));
  assert.equal(stateWord({ state: 'hold', needs: false }), 'Retry soon');
  assert.equal(stateNeeds({ state: 'hold', needs: false }), false);
});

test('save v21: a wave on the road keeps how many raiders it has', () => {
  assert.ok(SAVE_VERSION >= 21);
  const m = migrate({ v: 20, at: 0, game: { towns: { gulch: { waves: { phase: 'wave', queue: ['raider', 'raider'], foes: [{}] } }, ridge: { waves: { phase: 'break', queue: [], foes: [] } } } } });
  assert.equal(m.game.towns.gulch.waves.size, 3);
  assert.equal(m.game.towns.ridge.waves.size, 0);
});
