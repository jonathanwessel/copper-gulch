// Keep trying the boss (M4 Automation, owner 2026-11-17): a per-town switch, Off by default and opened with Auto-towers.
// On, a town that loses its boss wave holds its waves as always, then starts them again by itself once a tower has gone
// up a level, so it drops back, climbs and tries again. One coin loss per try, and its map badge says Retrying.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { foundTown } from '../src/core/empire.js';
import { foundCapital } from '../src/core/capital.js';
import { foundInstitution } from '../src/core/tree.js';
import { setHold, wavesOf } from '../src/core/defense.js';
import { autoOf, autoOpen, autoOn, setAuto, retryState, towerPower, towerEvery } from '../src/core/automation.js';
import { siteInfo } from '../src/core/map.js';
import { lostCard, lostToast } from '../src/ui/lost.js';
import { CAPITAL_DEF } from '../src/data/capital.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
const tower = (spot, kind, level, path = null) => ({ spot, kind, level, path, cd: 0, spent: 0, pulses: 0 });
const weak = () => [tower(0, 'crossbow', 2), tower(1, 'crossbow', 2)];
const strong = () => [0, 1, 2, 3, 4, 5].map(i => tower(i, i % 2 ? 'cannon' : 'crossbow', 9, 'a'));
const rich = t => { for (const g of Object.keys(t.goods)) { t.goods[g] = 1e6; t.sell[g] = false; } };

/* The Gulch in play at the war wagon's wave with the Capital and the War Office built, and a vault that never falls
   (only the boss decides). Iron Ridge holds its waves. */
function gulch(seed, towers, inst = ['war']) {
  const g = newGame(seed, 'gulch'), G = g.town;
  G.bestWave = 20; G.coins = 1e9;
  foundTown(g, 'ridge'); g.active = 'gulch';
  setHold(g, g.towns.ridge, true); g.towns.ridge.waves.timer = 1e9;
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave;
  foundCapital(g);
  for (const id of inst) foundInstitution(g, id);
  G.towers = towers; G.coins = 1e6; G.recent = 1000;
  G.wave = 10; G.bestWave = 9; setHold(g, G, false); G.waves.timer = 1;
  G.mods.set('vault', 'test', { mul: 1e4 });
  return { g, G };
}
const breaches = ev => ev.filter(([n, e]) => n === 'breach' && e.town === 'gulch').map(([, e]) => e);
const starts = (ev, w) => ev.filter(([n, e]) => n === 'wave:start' && e.town === 'gulch' && e.wave === w).length;

test('Keep trying the boss opens with Auto-towers and starts Off', () => {
  const { g, G } = gulch('r0', weak(), []);
  assert.equal(autoOpen(g, 'retry'), false);
  assert.equal(setAuto(g, G, 'retry', true), false, 'cannot switch on before the War Office');
  foundInstitution(g, 'war');
  assert.equal(autoOpen(g, 'retry'), true);
  assert.equal(autoOn(g, G, 'retry'), false, 'Off until the player switches it on');
  assert.equal(retryState(g, G), null);
});

test('Off, a lost boss holds the waves even after a tower goes up a level', () => {
  const { g, G } = gulch('r1', weak());
  const ev = g.bus.record();
  run(g, 4 * 60);
  assert.equal(breaches(ev).length, 1); assert.equal(breaches(ev)[0].why, 'boss');
  assert.ok(G.waves.autoHold);
  G.towers[0].level++;
  run(g, 5 * 60);
  assert.ok(G.waves.autoHold, 'still held: the player decides');
  assert.equal(starts(ev, 8), 0);
  assert.equal(siteInfo(g, 'gulch').alert, 'lost');
});

test('On, the town waits for a stronger tower, then climbs back and tries again, one coin loss per try', () => {
  const { g, G } = gulch('r2', weak());
  setAuto(g, G, 'retry', true);
  const ev = g.bus.record();
  run(g, 4 * 60);
  assert.equal(breaches(ev).length, 1, 'the boss got through once');
  assert.equal(G.wave, 10 - wavesOf(G).breachBack);
  assert.ok(G.waves.autoHold, 'held right after the loss');
  assert.equal(retryState(g, G), 'stuck', 'Auto-towers is off, so it waits for the player');
  assert.equal(siteInfo(g, 'gulch').alert, 'lost', 'stuck: the map asks for the player');
  assert.match(lostCard(G, g).lines[1], /start again by themselves after a tower goes up a level/);
  assert.match(lostToast(G, false, g), /start again by themselves/);
  const a = autoOf(g, G);
  assert.deepEqual([a.boss.wave, a.boss.tries, a.boss.power], [10, 1, towerPower(G)]);
  // no stronger tower: nothing comes, however long it waits
  run(g, 10 * 60);
  assert.equal(starts(ev, 8), 0, 'no wave while no tower went up');
  assert.equal(breaches(ev).length, 1, 'no second coin loss while it waits');
  // a tower goes up a level: the waves start again by themselves
  const mark = ev.length;
  G.towers[0].level++;
  g.step(.25);
  assert.equal(G.waves.autoHold, false);
  assert.equal(G.waves.hold, false);
  assert.deepEqual(ev.slice(mark).filter(([n]) => n === 'auto:retry').map(([, e]) => [e.wave, e.tries]), [[10, 1]]);
  assert.equal(retryState(g, G), 'climb');
  assert.equal(siteInfo(g, 'gulch').alert, 'retrying');
  // still too weak: it loses the boss again, once, and holds again for the next stronger tower
  run(g, 8 * 60);
  assert.ok(starts(ev, 8) >= 1 && starts(ev, 10) === 2, 'it climbed back and met the boss again');
  assert.equal(breaches(ev).length, 2, 'one coin loss per try');
  assert.ok(G.waves.autoHold);
  assert.equal(a.boss.tries, 2);
  run(g, 10 * 60);
  assert.equal(breaches(ev).length, 2, 'still one loss per try');
});

test('On with Auto-towers, the town breaks through by itself', () => {
  // two Crossbows with their path picked, so Auto-towers can keep raising them
  const { g, G } = gulch('r3', [tower(0, 'crossbow', 5, 'a'), tower(1, 'crossbow', 5, 'a')]);
  rich(G);
  setAuto(g, G, 'retry', true); setAuto(g, G, 'towers', true);
  const ev = g.bus.record();
  run(g, 4 * 60);
  assert.ok(breaches(ev).length >= 1, 'the weak towers lose the first try');
  // the loss came: it waits for Auto-towers, never longer than one Auto-towers wait
  const at = ev.findIndex(([n, e]) => n === 'breach' && e.town === 'gulch');
  assert.ok(at >= 0);
  if (G.waves.autoHold) {
    assert.equal(retryState(g, G), 'wait');
    assert.equal(siteInfo(g, 'gulch').alert, 'retry', 'no call for the player: it is handling it');
    run(g, towerEvery(g) + 5);
    assert.equal(G.waves.autoHold, false, 'Auto-towers raised a tower and the waves started again');
  }
  // given time (and Auto-towers raising every few minutes), it gets past the war wagon
  for (let m = 0; m < 240 && G.bestWave < 10; m++) run(g, 60);
  assert.ok(G.bestWave >= 10, 'it broke through the gate (best wave ' + G.bestWave + ')');
  assert.equal(autoOf(g, G).boss, null, 'the try is over');
  assert.equal(retryState(g, G), null);
  const losses = breaches(ev).filter(e => e.why === 'boss').length, tries = ev.filter(([n]) => n === 'auto:retry').length;
  assert.ok(losses <= tries + 1, 'never more than one loss per try (' + losses + ' losses, ' + tries + ' tries)');
});

test('a boss killed on the next try lets the town pass and ends the try', () => {
  const { g, G } = gulch('r4', weak());
  setAuto(g, G, 'retry', true);
  run(g, 4 * 60);
  assert.ok(G.waves.autoHold);
  G.towers = strong();
  g.step(.25);
  assert.equal(G.waves.autoHold, false);
  run(g, 6 * 60);
  assert.ok(G.bestWave >= 10);
  assert.equal(autoOf(g, G).boss, null);
});

test('the switch survives a save, and a v16 save loads with it Off', () => {
  const { g, G } = gulch('r5', weak());
  setAuto(g, G, 'retry', true);
  const h = loadGame(JSON.parse(encode(g, 1)).game);
  assert.equal(autoOn(h, h.towns.gulch, 'retry'), true);
  const old = JSON.parse(encode(g, 1)); old.v = 16;
  for (const a of Object.values(old.game.shared.auto)) { delete a.retry; delete a.boss; }
  const m = migrate(old);
  assert.equal(m.v, SAVE_VERSION);
  for (const a of Object.values(m.game.shared.auto)) { assert.equal(a.retry, false); assert.equal(a.boss, null); }
  const o = loadGame(m.game);
  assert.equal(autoOn(o, o.towns.gulch, 'retry'), false);
});

test('away and in catch-up, the town keeps trying and breaks through with Auto-towers', () => {
  const { g, G } = gulch('r6', [tower(0, 'crossbow', 5, 'a'), tower(1, 'crossbow', 5, 'a')]);
  rich(G);
  setAuto(g, G, 'retry', true); setAuto(g, G, 'towers', true);
  g.go('ridge');
  const ev = g.bus.record();
  g.catchUp(3 * 3600);
  assert.ok(G.bestWave >= 10, 'it got past the war wagon while away (best wave ' + G.bestWave + ')');
  const losses = breaches(ev).filter(e => e.why === 'boss' && e.wave === 10).length, tries = ev.filter(([n, e]) => n === 'auto:retry' && e.town === 'gulch').length;
  assert.ok(losses <= tries + 1, 'one loss per try (' + losses + ' losses, ' + tries + ' tries)');
});

// Evaluation 2 (2026-11-19): in the 24 h idle run every seed's Gulch lost its vault on a plain wave while away and sat
// on hold for the whole day. Keep trying the boss now takes up a fallen vault too.
test('On, a vault that fell on a plain wave while away starts again once a tower goes up a level', async () => {
  const { fall } = await import('../src/core/defense.js');
  const { retryLine } = await import('../src/ui/lost.js');
  const { g, G } = gulch('r9', weak());
  G.wave = 14; G.bestWave = 13; g.active = 'ridge';
  setAuto(g, G, 'retry', true);
  fall(g, G, 'vault');
  assert.equal(G.waves.autoHold, true, 'away, a fallen vault holds the waves');
  assert.equal(G.lost.why, 'vault');
  assert.equal(retryState(g, G), 'stuck', 'Auto-towers is off');
  assert.equal(retryLine(g, G), 'Go to Copper Gulch and raise a tower one level. Then it fights wave 14 again.');
  run(g, 60);
  assert.equal(G.waves.hold, true, 'no stronger tower yet');
  G.towers[0].level++;
  g.step(.25);
  assert.equal(G.waves.hold, false, 'a tower went up: the waves start again');
  assert.equal(retryState(g, G), 'climb');
  assert.equal(retryLine(g, G), 'Copper Gulch fights wave 14 again.');
});

test('Off, a vault that fell while away stays on hold until the player goes there', async () => {
  const { fall } = await import('../src/core/defense.js');
  const { g, G } = gulch('r10', weak());
  G.wave = 14; G.bestWave = 13; g.active = 'ridge';
  fall(g, G, 'vault');
  G.towers[0].level++;
  run(g, 60);
  assert.equal(G.waves.hold, true);
});
