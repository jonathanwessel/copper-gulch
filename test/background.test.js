// Every town keeps playing out of sight (PLAN.md M4, owner rule 2026-11-17): a town out of play keeps its wave clock
// and fights its waves, the same during time away (step by step, then in coarse chunks played from runs), its own Hold
// waves still parks it, and a town away that loses holds its own waves so it pays the loss once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { winOutpost } from '../src/core/outpost.js';
import { setHold, callEarly, waitsAway, away, skirmish, waveRun, startWave } from '../src/core/defense.js';
import { siteInfo } from '../src/core/map.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
const tower = (spot, kind, level, path = null) => ({ spot, kind, level, path, cd: 0, spent: 0, pulses: 0 });
/* Dry Creek won and in play; the Gulch out of play with `towers`. */
function setup(seed, towers) {
  const g = newGame(seed);
  winOutpost(g, g.town);
  setHold(g, g.town, true); g.town.waves.timer = 1e9; // Dry Creek stays quiet
  const G = g.towns.gulch;
  G.towers = towers;
  G.coins = 1000;
  return { g, G };
}
const strong = () => [0, 1, 2, 3, 4, 5].map(i => tower(i, i % 2 ? 'cannon' : 'crossbow', 7, 'a'));

test('a town out of play keeps its wave clock and fights its waves', () => {
  const { g, G } = setup('b1', strong());
  assert.equal(g.active, 'drycreek');
  assert.equal(away(g, G), true);
  assert.equal(waitsAway(g, G), false, 'a town with towers plays while away');
  const coins = G.lifetime;
  run(g, 8 * 60);
  assert.ok(G.wave >= 6, 'the Gulch went on to wave ' + G.wave);
  assert.ok(G.lifetime > coins, 'its bounties were paid');
  assert.equal(G.breaches || 0, 0);
});

test('a town with no towers waits for the player, and Hold waves parks a town away', () => {
  const g = newGame('b2');
  winOutpost(g, g.town);
  const G = g.towns.gulch, timer = G.waves.timer;
  run(g, 120);
  assert.equal(G.waves.timer, timer, 'a town just opened is not raided before the player has had a look');
  G.towers = strong(); setHold(g, G, true);
  run(g, 300);
  assert.equal(G.wave, 1, 'held: no wave came');
  setHold(g, G, false);
  run(g, 300);
  assert.ok(G.wave > 1, 'let go: the waves came');
});

test('a weak town away loses its vault once, holds its own waves, and starts again on Resume waves or Call now', () => {
  const { g, G } = setup('b3', [tower(0, 'crossbow', 1)]);
  G.wave = 12; G.bestWave = 12; G.recent = 400; G.coins = 1000;
  const ev = g.bus.record();
  run(g, 20 * 60);
  const br = ev.filter(([n, e]) => n === 'breach' && e.town === 'gulch');
  assert.equal(br.length, 1, 'one loss, not a loop');
  assert.equal(br[0][1].held, true);
  assert.equal(br[0][1].why, 'vault');
  assert.equal(G.wave, br[0][1].wave - 2);
  assert.equal(G.lost.back, G.wave);
  assert.ok(G.waves.hold && G.waves.autoHold);
  assert.equal(G.lost.why, 'vault');
  assert.equal(siteInfo(g, 'gulch').alert, 'lost', 'the map badge shows it');
  assert.ok(G.coins >= 1000 - 100 - 1e-9, 'it lost at most its share once');
  // going there and tapping Resume waves
  g.go('gulch'); setHold(g, G, false);
  assert.equal(G.waves.autoHold, false);
  assert.equal(siteInfo(g, 'gulch').alert === 'lost', false);
  run(g, 120);
  assert.ok(G.waves.phase === 'wave' || G.wave > 10 || G.breaches > 1, 'the waves came again');
  // Call now releases a town that held its own waves too
  const h = setup('b3b', [tower(0, 'crossbow', 1)]);
  h.G.wave = 12; h.G.bestWave = 12;
  run(h.g, 20 * 60);
  assert.ok(h.G.waves.autoHold);
  h.g.go('gulch');
  assert.ok(callEarly(h.g, h.G) >= 0);
  assert.equal(h.G.waves.hold, false);
  assert.equal(h.G.waves.phase, 'wave');
});

// in play the first fall does not hold; the second in a row with no new best wave does (the Gulch's loss loop box,
// PLAN.md M6a: the newcomer's Ridge fell 17-33 times in play on its climb to wave 52)
test('in play a fallen vault holds the waves only on the second fall in a row with no new best wave', () => {
  const { g, G } = setup('b4', [tower(0, 'crossbow', 1)]);
  g.go('gulch');
  G.wave = 12; G.bestWave = 12;
  const ev = g.bus.record();
  run(g, 10 * 60);
  const br = ev.filter(([n, e]) => n === 'breach' && e.town === 'gulch');
  assert.ok(br.length >= 2);
  assert.equal(br[0][1].held, false);
  assert.equal(br[1][1].held, true);
  assert.equal(br.length, 2, 'held after the second, so no third');
  assert.equal(!!G.waves.autoHold, true);
});

test('away, a boss that gets through loses the wave: back two waves and held', () => {
  // enough to clear wave 9's raiders but not the war wagon
  const { g, G } = setup('b5', [tower(0, 'crossbow', 6), tower(1, 'crossbow', 6)]);
  G.wave = 10; G.bestWave = 9; G.waves.timer = 1;
  G.vault.max = G.vault.hp = 1e6; // the vault never falls: only the boss decides
  const ev = g.bus.record();
  run(g, 4 * 60);
  const br = ev.filter(([n, e]) => n === 'breach' && e.town === 'gulch');
  assert.equal(br.length, 1, 'the boss got through');
  assert.equal(br[0][1].why, 'boss');
  assert.equal(G.wave, 8, 'back two waves, never past the boss');
  assert.equal(G.bestWave, 9, 'the boss wave was not beaten');
  assert.ok(G.waves.autoHold);
});

test('time away: towns fight their waves through coarse catch-up, and a loss holds them', () => {
  const a = setup('b6', strong());
  const r = a.g.catchUp(3 * 3600);
  assert.ok(r.coarse > 0);
  assert.ok(a.G.wave > 15, 'a strong Gulch got to wave ' + a.G.wave);
  assert.ok(a.G.breaches >= 1 && a.G.waves.autoHold, 'and stopped at the first wave it lost');
  const b = setup('b7', [tower(0, 'crossbow', 1)]);
  b.G.wave = 12; b.G.bestWave = 12;
  b.g.go('gulch'); // the town in play is away too while time away is caught up
  const ev = b.g.bus.record();
  b.g.catchUp(6 * 3600);
  assert.equal(ev.filter(([n, e]) => n === 'breach' && e.town === 'gulch').length, 1, 'one loss in six hours');
  assert.ok(b.G.waves.autoHold);
  // a won outpost keeps its light raids all day
  const d = b.g.towns.drycreek;
  setHold(b.g, d, false); d.towers = [tower(0, 'crossbow', 5, 'a'), tower(1, 'crossbow', 5, 'a')];
  const life = d.lifetime;
  b.g.catchUp(4 * 3600);
  assert.ok(d.lifetime > life, 'its bounties were paid');
  assert.equal(d.wave, d.def.goal);
});

test('a wave played from its run pays the same bounties and ends the same as the wave played step by step', () => {
  for (const seed of ['b8', 'b9']) {
    const A = setup(seed, strong()), B = setup(seed, strong());
    for (const { G } of [A, B]) { G.wave = 14; G.bestWave = 13; G.waves.timer = 0; G.tally = {}; }
    startWave(A.g, A.G);
    for (let n = 0; A.G.waves.phase === 'wave' && n < 8000; n++) A.g.step(.25);
    skirmish(B.g, B.G, 0.01); // starts the same wave (the same random stream) and plays it from its run
    assert.equal(B.G.waves.phase, 'break');
    assert.equal(B.G.wave, A.G.wave);
    assert.ok(A.G.tally.bounty > 0);
    assert.ok(Math.abs(B.G.tally.bounty - A.G.tally.bounty) < 1e-6, 'the same raiders fell');
    assert.ok(Math.abs(B.G.vault.hp - A.G.vault.hp) < 1e-9);
    assert.ok(B.G.waves.owe > 0, 'the time the wave took is owed by the next chunk');
    assert.ok(waveRun(B.G) !== null);
  }
});

test('a held town and its alert come back from a save', () => {
  const { g, G } = setup('b10', [tower(0, 'crossbow', 1)]);
  G.wave = 12; G.bestWave = 12;
  run(g, 20 * 60);
  assert.ok(G.waves.autoHold);
  const back = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  assert.ok(back.towns.gulch.waves.autoHold && back.towns.gulch.waves.hold);
  assert.equal(back.towns.gulch.lost.why, 'vault');
});
