// Boss waves are gates (owner rule, 2026-11-17): a boss wave is beaten only when its boss is killed. A boss that gets
// through loses the wave in the town in play too: back breachBack waves, the coin share, the vault refills, and the
// waves hold until the player taps Resume waves or Call now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { winOutpost } from '../src/core/outpost.js';
import { setHold, callEarly, away, wavesOf } from '../src/core/defense.js';
import { lostCard } from '../src/ui/lost.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
const tower = (spot, kind, level, path = null) => ({ spot, kind, level, path, cd: 0, spent: 0, pulses: 0 });
/* The Gulch in play at the war wagon's wave, with `towers` and a vault that never falls (only the boss decides). */
function gulch(seed, towers) {
  const g = newGame(seed);
  winOutpost(g, g.town);
  setHold(g, g.town, true); g.town.waves.timer = 1e9; // Dry Creek stays quiet
  g.go('gulch');
  const G = g.town;
  G.towers = towers; G.coins = 1000; G.recent = 1000;
  G.wave = 10; G.bestWave = 9; G.waves.timer = 1;
  G.mods.set('vault', 'test', { mul: 1e4 }); // a vault that never falls (syncVault keeps the vault at its mods)
  return { g, G };
}
const weak = () => [tower(0, 'crossbow', 3), tower(1, 'crossbow', 3)];
const strong = () => [0, 1, 2, 3, 4, 5].map(i => tower(i, i % 2 ? 'cannon' : 'crossbow', 9, 'a'));

test('in play, a boss that gets through loses the wave: no wave 11, back two waves, coins lost, waves held', () => {
  const { g, G } = gulch('bg1', weak());
  assert.equal(away(g, G), false, 'the Gulch is in play');
  const ev = g.bus.record();
  run(g, 4 * 60);
  const br = ev.filter(([n, e]) => n === 'breach' && e.town === 'gulch').map(([, e]) => e);
  assert.equal(br.length, 1, 'the boss got through once');
  assert.equal(br[0].why, 'boss');
  assert.equal(br[0].away, false);
  assert.equal(br[0].held, true);
  assert.ok(br[0].lost > 0, 'it cost coins');
  assert.equal(G.wave, 10 - wavesOf(G).breachBack, 'back two waves');
  assert.equal(G.bestWave, 9, 'the boss wave was not beaten');
  assert.ok(!ev.some(([n, e]) => n === 'wave:clear' && e.wave === 10), 'wave 10 never counts as cleared');
  assert.ok(!ev.some(([n, e]) => n === 'wave:start' && e.wave === 11), 'no wave 11');
  assert.equal(G.vault.hp, G.vault.max, 'the vault refills');
  assert.ok(G.waves.hold && G.waves.autoHold, 'the waves hold');
  assert.equal(G.lost.away, false);
  // held: nothing comes, however long the player waits
  const starts = ev.filter(([n]) => n === 'wave:start').length;
  run(g, 10 * 60);
  assert.equal(ev.filter(([n]) => n === 'wave:start').length, starts, 'no wave while held');
  // Resume waves starts them again
  setHold(g, G, false);
  assert.equal(G.waves.autoHold, false);
  run(g, 2 * 60);
  assert.ok(ev.some(([n, e]) => n === 'wave:start' && e.wave === 8), 'wave 8 comes after Resume waves');
});

test('in play, a killed boss lets the town pass to wave 11', () => {
  const { g, G } = gulch('bg2', strong());
  const ev = g.bus.record();
  run(g, 4 * 60);
  assert.ok(!ev.some(([n, e]) => n === 'breach' && e.town === 'gulch'), 'no loss');
  assert.ok(ev.some(([n, e]) => n === 'wave:clear' && e.wave === 10), 'wave 10 cleared');
  assert.ok(G.wave >= 11 && G.bestWave >= 10);
});

test('Call now after a lost boss tries again at once', () => {
  const { g, G } = gulch('bg3', weak());
  run(g, 4 * 60);
  assert.ok(G.waves.autoHold);
  assert.ok(callEarly(g, G) >= 0);
  assert.equal(G.waves.autoHold, false);
  assert.equal(G.waves.hold, false);
  assert.equal(G.waves.phase, 'wave');
});

test('Dry Creek: a bandit wagon that gets through does not win the outpost', () => {
  const g = newGame('bg4'), t = g.town, ev = g.bus.record();
  t.towers = [tower(0, 'crossbow', 2)];
  t.wave = 10; t.bestWave = 9; t.waves.timer = 1; t.mods.set('vault', 'test', { mul: 1e4 }); t.coins = 500; t.recent = 500;
  run(g, 4 * 60);
  assert.equal(t.won, false);
  assert.ok(!ev.some(([n]) => n === 'outpost:won'));
  assert.equal(t.wave, 8);
  assert.ok(t.waves.autoHold);
});

test('the lost card says what happened and what to tap, in plain words', () => {
  const { g, G } = gulch('bg5', weak());
  run(g, 4 * 60);
  const c = lostCard(G);
  assert.equal(c.title, 'Wave 10 lost');
  assert.match(c.lines[0], /^The war wagon got through\. You dropped back to wave 8 and lost \d+ coins\.$/);
  assert.match(c.lines[1], /Resume waves/);
  for (const l of [c.title, ...c.lines]) assert.ok(!/[;:]/.test(l), 'no colons or semicolons: ' + l);
});
