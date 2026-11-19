// M5, Pacing and Evaluation 2: towers that hit a whole group grow slower per level than the Crossbow, which hits one
// raider, so late in the game (every tower near level 13 in Silver Falls) no group tower carries a town. Silver Falls has
// 3 mortar pits (was 4), and save v18 moves a Mortar off the pit that went.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { foundTown } from '../src/core/empire.js';
import { towerStats, isPit, pitSpots, fitsSpot } from '../src/core/defense.js';
import { TOWERS, PER_LEVEL } from '../src/data/towers.js';
import { TOWNS } from '../src/data/towns/index.js';
import { mapRules } from '../tools/audit.js';

const grow = k => TOWERS[k].grow || PER_LEVEL.dmg;

test('a tower that hits a group grows slower each level than one that hits one raider, the Mortar slowest', () => {
  assert.equal(grow('crossbow'), PER_LEVEL.dmg, 'the Crossbow keeps the normal growth');
  for (const k of ['cannon', 'frost', 'mortar']) assert.ok(grow(k) < grow('crossbow'), k + ' grows slower');
  assert.ok(grow('mortar') < grow('frost') && grow('frost') < grow('cannon'));
  // the hit at a level follows its own growth, and level 1 is unchanged
  const g = newGame('gr1', 'gulch'), t = g.town;
  for (const k of ['crossbow', 'cannon', 'frost', 'mortar']) {
    const one = towerStats(t, { kind: k, level: 1, path: null }).dmg, ten = towerStats(t, { kind: k, level: 10, path: null }).dmg;
    assert.ok(Math.abs(one - TOWERS[k].dmg * t.mods.factor('towerDmg')) < 1e-9, k + ' level 1');
    assert.ok(Math.abs(ten / one - grow(k) ** 9) < 1e-9, k + ' level 10');
  }
  // the Still's poison keeps its own slower growth, and its hit the normal one
  assert.ok(PER_LEVEL.poison < grow('mortar'));
});

test('Silver Falls has 3 mortar pits, only the Mortar builds there, and the map rules hold', () => {
  const b = TOWNS.falls.board, pits = b.spots.length - b.far;
  assert.equal(pits, 3);
  const g = newGame('gr2', 'gulch'); g.addTown('ridge');
  const f = TOWNS.falls.found; g.towns.ridge.bestWave = f.wave; g.town.coins = f.coins * 2; g.shared.charter.deeds = f.deeds;
  assert.ok(foundTown(g, 'falls'));
  const ft = g.towns.falls;
  assert.deepEqual(pitSpots(ft), [12, 13, 14]);
  for (const i of pitSpots(ft)) { assert.ok(isPit(ft, i)); assert.ok(fitsSpot(ft, i, 'mortar')); assert.ok(!fitsSpot(ft, i, 'crossbow')); }
  assert.deepEqual(mapRules().filter(p => p.startsWith('falls')), []);
});

test('save v18: a Mortar by the vault keeps its place, and one on the east pit moves there or comes down for its coins', () => {
  const g = newGame('gr3', 'gulch'); g.addTown('ridge');
  const f = TOWNS.falls.found; g.towns.ridge.bestWave = f.wave; g.town.coins = f.coins * 2; g.shared.charter.deeds = f.deeds;
  assert.ok(foundTown(g, 'falls'));
  const save = () => JSON.parse(encode(g, 1));
  const mortar = (spot, spent) => ({ spot, kind: 'mortar', level: 3, path: null, cd: 0, spent, pulses: 0 });
  // alone on old pit 15 (by the vault, now pit 13): it moves, and nothing is paid back
  let old = save(); old.v = 17; old.game.towns.falls.towers = [mortar(15, 2000)];
  const coins = old.game.shared.purse.coins;
  let m = migrate(old);
  assert.equal(m.v, SAVE_VERSION);
  assert.deepEqual(m.game.towns.falls.towers.map(t => t.spot), [13]);
  assert.equal(m.game.shared.purse.coins, coins);
  assert.deepEqual(TOWNS.falls.board.spots[13], [3.6, 16.6], 'the same place as the old pit 15');
  // alone on the east pit (old 13): it keeps number 13, which is now the pit by the vault
  old = save(); old.v = 17; old.game.towns.falls.towers = [mortar(13, 1000)];
  m = migrate(old);
  assert.deepEqual(m.game.towns.falls.towers.map(t => [t.spot, t.spent]), [[13, 1000]]);
  assert.equal(m.game.shared.purse.coins, coins);
  // both taken: the east one comes down and every coin spent on it goes back to the purse, the vault one stays
  old = save(); old.v = 17; old.game.towns.falls.towers = [mortar(13, 1000), mortar(15, 2500), mortar(14, 500)];
  m = migrate(old);
  assert.deepEqual(m.game.towns.falls.towers.map(t => [t.spot, t.spent]).sort((a, b) => a[0] - b[0]), [[13, 2500], [14, 500]]);
  assert.equal(m.game.shared.purse.coins, coins + 1000);
  const h = loadGame(m.game);
  assert.equal(h.towns.falls.towers.length, 2);
  // a save with no Falls is left alone
  const plain = JSON.parse(encode(newGame('gr4', 'gulch'), 1)); plain.v = 17;
  assert.equal(migrate(plain).v, SAVE_VERSION);
});
