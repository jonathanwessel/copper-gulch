// The newcomer's Ridge wall (PLAN.md M6a): after the Ridge's charter the newcomer filled every pad with Crossbows in two
// minutes (the one tower its stone could pay for) and stalled at waves 44-47 for hours. A town now remembers the towers
// it had before its charter, and the strip asks for each one back on its old pad: the building that makes a good it
// lacks first, then the tower, swapping a low tower of another kind. Once the Capital stands, the save for the next
// town holds the waves like the Capital's save, and a town with nothing left to open sends the player where goals are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalsOf, rebuildStep, playStep, townSaveNext, SWAP_BELOW, goalCoins, REBUILD_WORDS } from '../src/core/goals.js';
import { foundTown } from '../src/core/empire.js';
import { foundCapital } from '../src/core/capital.js';
import { signCharter } from '../src/core/charter.js';
import { towerAt, setHold } from '../src/core/defense.js';
import { DEEDS } from '../src/data/perks.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { textIssues } from '../tools/audit.js';
import { goalTap } from '../tools/firstplay.js';
import { Rng } from '../src/core/rng.js';

const allDone = (g, town) => { for (const x of goalsOf(town)) g.shared.goals.done[x.id] = true; };
const tower = (spot, kind, level) => ({ spot, kind, level, path: level >= 5 ? 'a' : null, fork: null, cd: 0, spent: 100 * level, pulses: 0 });
/* A game in Iron Ridge just after its charter: before it, a level-18 Frost Lens on pad 0, a level-12 Still on pad 1
   and a level-6 Crossbow on pad 2. */
function signedRidge(seed) {
  const g = newGame(seed, 'gulch');
  g.town.bestWave = 20; g.town.coins = 1e6; foundTown(g, 'ridge');
  for (const id of ['gulch', 'ridge', 'drycreek', 'pinehollow']) allDone(g, id);
  g.go('ridge');
  const r = g.towns.ridge;
  r.towers = [tower(2, 'crossbow', 6), tower(0, 'frost', 18), tower(1, 'still', 12)];
  r.bestWave = 41; r.lifetime = DEEDS.coins;
  assert.ok(signCharter(g, r) >= 1);
  g.shared.purse.coins = 1e6;
  return g;
}

test('a charter keeps the towers the town had, highest level first, and nothing else of them', () => {
  const g = signedRidge('rb1'), r = g.towns.ridge;
  assert.deepEqual(r.plan, [{ spot: 0, kind: 'frost' }, { spot: 1, kind: 'still' }, { spot: 2, kind: 'crossbow' }]);
  assert.equal(r.towers.length, 0);
});

test('a good nothing here makes comes first: the strip asks for the building that makes it', () => {
  const g = signedRidge('rb2'), r = g.towns.ridge;
  assert.equal(r.level('colliery'), 0);
  const s = rebuildStep(g, r);
  assert.ok(s.id.startsWith('rebuild:0:frost'), s.id);
  // its lot is still locked behind the Quarry, so the step asks for the level that opens it
  assert.equal(s.at().plot, 'rquarry');
  assert.match(s.text, new RegExp('to open the ' + BUILDINGS.colliery.name + '$'));
  assert.equal(goalNow(g).id, s.id, 'the strip shows it');
  r.buildings.rquarry = 20;
  const t = rebuildStep(g, r);
  assert.equal(t.at().plot, 'colliery');
  assert.equal(t.text, 'Tap the ' + BUILDINGS.colliery.name + ' lot, then tap Build');
});

test('with the goods in stock the strip asks for the old tower on its old pad, and the newcomer builds it there', () => {
  const g = signedRidge('rb3'), r = g.towns.ridge;
  r.buildings.colliery = 1; r.goods.coal = 50; r.goods.stone = 50;
  const s = goalNow(g);
  assert.equal(s.id, 'rebuild:0:frost');
  assert.equal(s.text, REBUILD_WORDS.build('stone pad', 'Frost Lens'));
  assert.deepEqual(textIssues(s.text), [], s.text);
  assert.equal(s.at().spot, 0);
  const tap = goalTap(g, r, new Rng('rb3'));
  assert.ok(tap.run());
  assert.equal(towerAt(r, 0).kind, 'frost');
  assert.equal(goalNow(g).id, 'rebuild:1:still', 'then the next one');
});

test('a low tower of another kind on the pad is swapped back, a tower at the path level stays', () => {
  const g = signedRidge('rb4'), r = g.towns.ridge;
  r.buildings.colliery = 1; r.goods.coal = 50; r.goods.stone = 50;
  r.towers.push(tower(0, 'crossbow', 2));
  let s = goalNow(g);
  assert.equal(s.id, 'rebuild:0:frost:swap');
  assert.equal(s.text, REBUILD_WORDS.swap('Crossbow', 'Frost Lens'));
  assert.deepEqual(textIssues(s.text), [], s.text);
  assert.equal(s.at().tower, 0);
  assert.equal(s.at().sell, true);
  assert.equal(goalCoins(g, r, s), null, 'it shows only once it can be paid, so it counts no coins');
  assert.ok(goalTap(g, r, new Rng('rb4')).run());
  assert.equal(towerAt(r, 0).kind, 'frost');
  assert.equal(towerAt(r, 0).level, 1);
  // a Crossbow at the path level is the player's choice now: not swapped
  r.towers.push(tower(1, 'crossbow', SWAP_BELOW));
  s = rebuildStep(g, r);
  assert.ok(!s || !s.id.startsWith('rebuild:1:'), s && s.id);
});

test('a tower the purse or the yard cannot pay for leaves the strip to the next step (seen red: the Capital never opened)', () => {
  const g = signedRidge('rb5'), r = g.towns.ridge;
  r.buildings.colliery = 1; r.goods.coal = 0; r.goods.stone = 50;
  const s = rebuildStep(g, r);
  assert.ok(!s || s.kind === 'crossbow', s && s.id);
  g.shared.purse.coins = 0;
  assert.equal(rebuildStep(g, r), null);
});

test('a save from before this change loads with no plan, and asks for nothing', () => {
  const g = newGame('rb6', 'gulch');
  const data = JSON.parse(JSON.stringify(g.toJSON()));
  for (const t of Object.values(data.towns)) delete t.plan;
  const m = migrate({ v: 28, at: 0, game: data });
  assert.equal(m.v, SAVE_VERSION);
  for (const t of Object.values(m.game.towns)) assert.deepEqual(t.plan, []);
});

/* After the Capital, with the Ridge past wave 52 and 5 deeds held, only Silver Falls' coins are missing. */
function fallsSave(seed) {
  const g = newGame(seed, 'gulch');
  g.town.bestWave = 20; g.town.coins = 1e6; foundTown(g, 'ridge');
  for (const id of ['gulch', 'ridge', 'drycreek', 'pinehollow']) allDone(g, id);
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave; g.shared.purse.coins = CAPITAL_DEF.found.coins + 10;
  assert.ok(foundCapital(g));
  g.shared.tree = g.shared.tree || {}; g.shared.tree.founded = ['market'];
  g.towns.ridge.bestWave = 52; g.shared.charter.deeds = 5; g.shared.purse.coins = 1000;
  g.go('ridge');
  return g;
}

test('the save for Silver Falls starts with Hold waves, and a town lost away does not break it', () => {
  const g = fallsSave('rb7'), r = g.towns.ridge, gu = g.towns.gulch;
  assert.equal(townSaveNext(g).id, 'next:falls:coins');
  let s = goalNow(g);
  assert.equal(s.id, 'next:falls:hold');
  // clarity fix 8x: the save's own words and count, with its own Hold waves button
  assert.equal(s.text, townSaveNext(g).text);
  assert.ok(s.hold && s.saveNeed === townSaveNext(g).need && !s.need);
  assert.deepEqual(textIssues(s.text), [], s.text);
  setHold(g, r, true);
  assert.equal(goalNow(g).id, 'next:falls:coins', 'held to save: no Resume waves step');
  // the Gulch loses while away: the strip does not send the player there during the save
  gu.waves.hold = true; gu.waves.autoHold = true; gu.lost = { why: 'vault', wave: 30, back: 28, coins: 0, at: 0, away: true };
  assert.equal(goalNow(g).id, 'next:falls:coins');
  // the coins are there: the step to open it shows even with the Gulch held after a loss
  g.shared.purse.coins = 2e6; g.go('gulch');
  assert.equal(goalNow(g).id, 'next:falls:go');
});

test('with nothing left to open, a town with no goal sends the player to a place that has one (seen blank for hours)', () => {
  const g = fallsSave('rb8');
  g.shared.purse.coins = 2e6;
  foundTown(g, 'falls');
  for (const id of ['falls', 'sandybend']) allDone(g, id);
  g.go('ridge');
  assert.equal(playStep(g), null, 'no goals left anywhere: nothing to send to');
  delete g.shared.goals.done[goalsOf('falls')[0].id];
  const s = playStep(g);
  assert.equal(s.id, 'play:falls');
  assert.equal(s.text, REBUILD_WORDS.play('Silver Falls'));
  assert.equal(s.at().go, 'falls');
});
