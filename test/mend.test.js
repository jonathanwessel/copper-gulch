/* The vault mends a little for each wave beaten (clarity fix 3b part 2c, GDD.md Vault): a tenth of its full strength,
   never past it, in play and in the background battle alike (both end a wave in waveEnd). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { startWave, fight, skirmish, wavesOf, setHold } from '../src/core/defense.js';
import { winOutpost } from '../src/core/outpost.js';
import { explainVault } from '../src/core/explain.js';
import { STEP } from '../src/core/clock.js';

function beat(g, t) { // start a wave and clear its raiders, so the next step ends it as beaten
  assert.ok(startWave(g, t));
  t.waves.queue = []; t.waves.foes = [];
  fight(g, t, STEP);
}

test('a beaten wave mends a tenth of the vault, never past full', () => {
  const g = newGame('mend', 'gulch'), t = g.town;
  assert.equal(wavesOf(t).mend, .1);
  t.vault.hp = 5;
  const w = t.wave;
  beat(g, t);
  assert.equal(t.wave, w + 1);
  assert.equal(t.vault.hp, 5 + t.vault.max * .1, 'a tenth of full strength back');
  t.vault.max = 25; t.vault.hp = 5;
  beat(g, t);
  assert.equal(t.vault.hp, 7.5, 'a 25-hit vault mends 2.5, as its sheet says');
  assert.equal(explainVault(t).mend, 2.5);
  t.vault.max = 20;
  t.vault.hp = t.vault.max - .5;
  beat(g, t);
  assert.equal(t.vault.hp, t.vault.max, 'never past full');
});

test('a lost boss wave does not mend: the vault refills only as the loss does', () => {
  const g = newGame('mend2', 'gulch'), t = g.town;
  t.vault.hp = 5;
  assert.ok(startWave(g, t));
  t.waves.queue = []; t.waves.foes = []; t.waves.bossLeaked = true;
  const w = t.wave;
  fight(g, t, STEP);
  assert.ok(t.wave < w || t.wave === 1, 'the wave is lost');
  assert.equal(t.vault.hp, t.vault.max);
});

test('a town away mends the same way in the background battle', () => {
  const g = newGame('mend3');
  winOutpost(g, g.town);
  setHold(g, g.town, true); g.town.waves.timer = 1e9; // Dry Creek stays quiet
  const G = g.towns.gulch;
  G.towers = [0, 1, 2, 3, 4, 5].map(i => ({ spot: i, kind: i % 2 ? 'cannon' : 'crossbow', level: 7, path: 'a', cd: 0, spent: 0, pulses: 0 }));
  G.wave = 3; G.bestWave = 2; G.waves.timer = 0; G.vault.hp = 3;
  skirmish(g, G, 0.01); // plays the wave from its run
  assert.equal(G.wave, 4, 'beaten away');
  assert.ok(Math.abs(G.vault.hp - (3 + G.vault.max * .1)) < 1e-9, 'and mended as in play');
});

test('the Vault sheet writes a mend in whole hits or halves', async () => {
  const { mendText } = await import('../src/ui/explain.js');
  assert.equal(mendText(2), '2 hits'); assert.equal(mendText(2.5), '2½ hits'); assert.equal(mendText(3.5), '3½ hits'); assert.equal(mendText(1), '1 hit');
});

test('the Vault sheet says how much each beaten wave mends', () => {
  const t = newGame('mend4', 'gulch').town;
  assert.equal(explainVault(t).mend, 2);
});
