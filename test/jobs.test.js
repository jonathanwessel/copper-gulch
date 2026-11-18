// Tower jobs and the charter's payoff (M2, Tower balance): each kind is best against some raiders (the Crossbow
// against Riders, the Still's poison against armored raiders, the Mortar against the wagons), poison grows slower
// per level than a hit, a signed town's old ground (towers 3 times harder, Call now at once), save v11, and Powder
// Kegs, the research that opens at wave 26.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { buildTower, upgradeTower, towerStats, roadOf, bestFactor, canCall, oldGround, OLD_GROUND, callEarly } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { TOWERS, PER_LEVEL } from '../src/data/towers.js';
import { RESEARCH } from '../src/data/research.js';
import { signCharter } from '../src/core/charter.js';
import { itemsOf, researchBlock, applyResearch } from '../src/core/research.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { towerBalance, charterPayoff } from '../tools/balance.js';

const rich = g => { const t = g.town; t.coins = 1e9; for (const k of ['timber', 'ore', 'copper', 'bricks', 'planks', 'clay']) { t.goods[k] = 1e6; t.sell[k] = false; } return t; };
/* A distance along the road whose point is within r of a spot. */
const near = (t, spot, r) => { const road = roadOf(t), p = t.def.board.spots[spot]; for (let s = 1; s < road.length; s += .05) if (dist(p, pointAt(road, s)) <= r) return s; return null; };
/* Raiders frozen on the road, mid-wave, with lots of health. */
const place = (t, list) => {
  let id = 900;
  Object.assign(t.waves, { phase: 'wave', queue: [], hold: true, foes: list.map(([kind, s]) => ({ id: id++, kind, hp: 1e6, max: 1e6, s, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, brittle: 0 })) });
};
const lost = t => t.waves.foes.map(f => 1e6 - f.hp);

test('each tower kind is best against its own raiders', () => {
  assert.equal(bestFactor('crossbow', 'runner'), TOWERS.crossbow.best.runner);
  assert.equal(bestFactor('crossbow', 'raider'), 1);
  assert.equal(bestFactor('still', 'brute'), TOWERS.still.best.armored);
  assert.equal(bestFactor('still', 'wagon'), TOWERS.still.best.armored);
  assert.equal(bestFactor('still', 'raider'), 1);
  assert.equal(bestFactor('mortar', 'wagon'), TOWERS.mortar.best.boss);
  assert.equal(bestFactor('mortar', 'bandits'), TOWERS.mortar.best.boss);
  assert.equal(bestFactor('mortar', 'brute'), 1);
  assert.equal(bestFactor('cannon', 'runner'), 1);
  for (const k of ['crossbow', 'still', 'mortar']) assert.ok(TOWERS[k].bestText && /Best against/.test(TOWERS[k].about), k + ' says what it is best against');
});

test('a Crossbow bolt hits a Rider twice as hard as a Bandit', () => {
  const g = newGame('j1', 'gulch'), t = rich(g);
  const s = near(t, 0, 2.2);
  const one = kind => { t.towers = []; buildTower(g, t, 0, 'crossbow'); place(t, [[kind, s]]); g.step(.25); return lost(t)[0]; };
  const bandit = one('raider'), rider = one('runner');
  assert.ok(bandit > 0);
  assert.ok(Math.abs(rider / bandit - TOWERS.crossbow.best.runner) < 1e-9, rider + ' vs ' + bandit);
});

test('the Still\'s poison is weak on plain raiders and strong on armored ones, and grows slower than a hit', () => {
  const g = newGame('j2', 'gulch'), t = rich(g);
  const s = near(t, 0, 2.2);
  buildTower(g, t, 0, 'still');
  place(t, [['raider', s], ['brute', s]]);
  for (let i = 0; i < 8; i++) g.step(.25);
  const [plain, brute] = t.waves.foes;
  assert.equal(plain.poison, towerStats(t, t.towers[0]).poison);
  assert.ok(Math.abs(brute.poison / plain.poison - TOWERS.still.best.armored) < 1e-9);
  assert.ok(PER_LEVEL.poison < PER_LEVEL.dmg);
  const p1 = towerStats(t, t.towers[0]).poison, d1 = towerStats(t, t.towers[0]).dmg;
  upgradeTower(g, t, 0);
  assert.ok(Math.abs(towerStats(t, t.towers[0]).poison / p1 - PER_LEVEL.poison) < 1e-9);
  assert.ok(Math.abs(towerStats(t, t.towers[0]).dmg / d1 - PER_LEVEL.dmg) < 1e-9);
});

test('a Mortar shell hits a war wagon harder than a Brute beside it', () => {
  const g = newGame('j3', 'gulch'), t = rich(g);
  t.wave = 12; Object.assign(t.waves, { phase: 'break', timer: 999, hold: true }); g.step(.25);
  const pit = t.def.board.far; assert.ok(buildTower(g, t, pit, 'mortar'));
  const road = roadOf(t), p = t.def.board.spots[pit];
  let s = null; for (let x = 1; x < road.length; x += .05) { const d = dist(p, pointAt(road, x)); if (d > 3 && d < 4) { s = x; break; } }
  place(t, [['wagon', s], ['brute', s]]);
  for (let i = 0; i < 12; i++) g.step(.25);
  const [wagon, brute] = lost(t);
  assert.ok(brute > 0, 'the shell landed');
  const armor = f => 1 - ({ wagon: .35, brute: .25 })[f];
  assert.ok(Math.abs((wagon / armor('wagon')) / (brute / armor('brute')) - TOWERS.mortar.best.boss) < 1e-6);
});

test('a signed town remembers its best wave: old ground hits 3 times harder and Call now works at once', () => {
  const g = newGame('j4', 'gulch'), t = g.town;
  t.bestWave = 28; t.lifetime = 1e6;
  assert.ok(signCharter(g, t) > 0);
  assert.equal(t.record, 28); assert.equal(t.wave, 1); assert.equal(t.bestWave, 0);
  g.step(.25);
  assert.ok(oldGround(t));
  assert.equal(t.mods.factor('towerDmg'), OLD_GROUND.dmg);
  assert.ok(t.mods.explain('towerDmg').parts.some(p => p.source === 'Bonus on waves you beat before'), 'the tower card can show where it comes from');
  // past the first wave, Call now works right away (it always does)
  t.wave = 5; t.bestWave = 4; Object.assign(t.waves, { phase: 'break', timer: 50, hold: false });
  assert.ok(canCall(t)); assert.ok(callEarly(g, t) > 0);
  // past the old best wave the bonus is gone
  t.wave = 29; t.bestWave = 28; Object.assign(t.waves, { phase: 'break', timer: 50, queue: [], foes: [] });
  g.step(.25);
  assert.ok(!oldGround(t)); assert.equal(t.mods.factor('towerDmg'), 1); assert.ok(canCall(t), 'Call now is never locked');
  // a second charter keeps the higher record
  t.bestWave = 31; t.lifetime = 1e6; assert.ok(signCharter(g, t) > 0); assert.equal(t.record, 31);
  const back = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(back.town.record, 31);
});

test('save v11: a town that signed takes its record from the last charter', () => {
  assert.ok(SAVE_VERSION >= 11);
  const s = migrate({ v: 10, at: 0, game: { towns: { gulch: { id: 'gulch', charters: 1, bestWave: 3 }, drycreek: { id: 'drycreek' } }, shared: { charter: { last: { town: 'gulch', wave: 30 } } } } });
  assert.equal(s.game.towns.gulch.record, 30);
  assert.equal(s.game.towns.drycreek.record, 0);
  const fresh = migrate({ v: 10, at: 0, game: { towns: { gulch: { id: 'gulch', bestWave: 3 } }, shared: {} } });
  assert.equal(fresh.game.towns.gulch.record, 0);
});

test('Powder Kegs shows up at wave 26, once, and widens Cannon and Mortar blasts', () => {
  const g = newGame('j5', 'gulch'), t = rich(g);
  t.flags['open:research'] = true;
  assert.ok(!itemsOf(t).includes('kegs'));
  const ev = g.bus.record();
  t.bestWave = RESEARCH.kegs.opens - 1; g.step(.25);
  assert.ok(!ev.some(([n]) => n === 'research:new'));
  t.bestWave = RESEARCH.kegs.opens; g.step(.25); g.step(.25);
  assert.equal(ev.filter(([n, d]) => n === 'research:new' && d.id === 'kegs').length, 1);
  assert.ok(itemsOf(t).includes('kegs')); assert.equal(researchBlock(t, 'kegs'), null);
  buildTower(g, t, 0, 'cannon');
  const before = towerStats(t, t.towers[0]).splash;
  t.research.kegs = 2; t.lab = null; g.step(.25);
  applyResearch(t);
  assert.ok(Math.abs(towerStats(t, t.towers[0]).splash / before - (1 + 2 * RESEARCH.kegs.effects[0].per)) < 1e-9);
});

test('the balance gates catch a kind that carries the town, a kind that never leads, and a slow regain', () => {
  const run = (top, extra = {}) => ({ seed: 1, top, offer: 2400, signed: { at: 2400, wave: 20 }, regain: 600, reach: { 20: 2000 }, news: [1500], ...extra });
  const rows = [{ strategy: 'x', dealt: { still: 80, crossbow: 20 }, runs: [run([[1, 'still', 2]])] }];
  const m = towerBalance(rows).join('\n');
  assert.match(m, /still does 80%/); assert.match(m, /crossbow never does the most damage/);
  assert.deepEqual(charterPayoff([run([])]), []);
  assert.match(charterPayoff([run([], { regain: 1800 })]).join('\n'), /90% of the first climb/);
  assert.match(charterPayoff([run([], { news: [600] })]).join('\n'), /nothing new opens/);
});
