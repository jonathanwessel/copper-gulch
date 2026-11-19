// Automation (M4): per-town switches that keep buying what the player already chose by hand. Auto-towers opens with the
// War Office, Auto-research with the University, Foremen switch all at once; each keeps half the coins, works away,
// survives a save and a charter, and an old save migrates with every switch Off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { foundTown } from '../src/core/empire.js';
import { foundCapital } from '../src/core/capital.js';
import { foundInstitution, buyNode } from '../src/core/tree.js';
import { buildTower, upgradeTower, towerCost } from '../src/core/defense.js';
import { researchCost } from '../src/core/research.js';
import { hireForeman, foremanOn } from '../src/core/foremen.js';
import { resetTown } from '../src/core/charter.js';
import { autoOf, autoOpen, autoOn, setAuto, towerEvery, nextTowerUp, towerBlock, nextResearch, setForemen, foremenWorking } from '../src/core/automation.js';
import { tabs, dots } from '../src/core/reveal.js';
import { AUTO } from '../src/data/automation.js';
import { CAPITAL_DEF } from '../src/data/capital.js';
import { PATH_LEVEL } from '../src/data/towers.js';

/* The Gulch with the Capital built (Iron Ridge founded to get there), waves held so nothing breaks in. */
function empire(seed, inst = ['war', 'university']) {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 20; gu.coins = 1e9;
  foundTown(g, 'ridge'); g.active = 'gulch';
  for (const t of Object.values(g.towns)) if (t.waves) t.waves.hold = true;
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave;
  foundCapital(g);
  for (const id of inst) foundInstitution(g, id);
  return g;
}
const rich = t => { t.coins = 1e9; Object.assign(t.goods, { timber: 1e6, ore: 1e6, copper: 1e6, bricks: 1e6, stone: 1e6, planks: 1e6, tools: 1e6, clay: 1e6, pigiron: 1e6, steel: 1e6, coal: 1e6, granite: 1e6 }); for (const g of Object.keys(t.goods)) { t.goods[g] = 1e6; t.sell[g] = false; } };

test('Auto-towers and Auto-research open with the War Office and the University, and start Off', () => {
  const g = empire('a0', []), t = g.town;
  assert.equal(autoOpen(g, 'towers'), false); assert.equal(tabs(g, t).auto, false, 'no Auto button yet');
  assert.equal(setAuto(g, t, 'towers', true), false, 'cannot switch on before it opens');
  foundInstitution(g, 'war');
  assert.equal(autoOpen(g, 'towers'), true); assert.equal(autoOpen(g, 'research'), false);
  assert.equal(tabs(g, t).auto, true); assert.equal(dots(g, t).auto, true, 'a dot until the sheet is opened');
  assert.equal(autoOn(g, t, 'towers'), false, 'Off until the player switches it on');
  g.shared.seen = { 'auto:sheet': true }; assert.equal(dots(g, t).auto, false);
});

test('Auto-towers raises the cheapest standing tower once per wait, keeps half the coins and never picks a path', () => {
  const g = empire('a1'), t = g.town; rich(t);
  assert.ok(buildTower(g, t, 2, 'crossbow')); assert.ok(buildTower(g, t, 3, 'cannon'));
  setAuto(g, t, 'towers', true);
  const ups = []; g.bus.on('auto:tower', x => ups.push(x));
  g.step(.25);
  assert.equal(ups.length, 1, 'the first raise comes at once');
  assert.equal(ups[0].spot, 2, 'the Crossbow is the cheaper raise');
  assert.equal(autoOf(g, t).wait, towerEvery(g));
  for (let i = 0; i < 4 * (AUTO.towerEvery - 1); i++) g.step(.25);
  assert.equal(ups.length, 1, 'nothing more until the wait is over');
  for (let i = 0; i < 12; i++) g.step(.25);
  assert.equal(ups.length, 2);
  // never past level 4 without a path the player picked
  for (const x of t.towers) x.level = PATH_LEVEL - 1;
  autoOf(g, t).wait = 0;
  assert.equal(towerBlock(g, t), 'path'); g.step(.25);
  assert.ok(t.towers.every(x => x.level === PATH_LEVEL - 1));
  assert.ok(upgradeTower(g, t, 3, 'a'), 'the player picks the Cannon path');
  assert.equal(nextTowerUp(t).tower.spot, 3);
  // half the coins always stays
  const c = towerCost(t, 'cannon', t.towers.find(x => x.spot === 3).level).coins;
  t.coins = c * 2 - 1; assert.equal(towerBlock(g, t), 'coins');
  t.coins = c * 2; assert.equal(towerBlock(g, t), null);
  setAuto(g, t, 'towers', false); assert.equal(towerBlock(g, t), 'off');
});

test('War Office upgrades make Auto-towers faster', () => {
  const g = empire('a2'), before = towerEvery(g);
  g.shared.capital.influence = 1e4;
  assert.ok(buyNode(g, 'war')); assert.ok(buyNode(g, 'war'));
  assert.ok(Math.abs(towerEvery(g) - before * AUTO.faster ** 2) < 1e-9);
});

test('Auto-research runs again only what the player researched by hand, cheapest first, keeping half the coins', () => {
  const g = empire('a3'), t = g.town; rich(t);
  t.flags['open:research'] = true; t.buildings.saw = Math.max(1, t.level('saw'));
  setAuto(g, t, 'research', true);
  g.step(.25);
  assert.equal(t.lab, null, 'nothing researched by hand yet, so nothing starts');
  t.research.saws = 1; t.research.walls = 2;
  const cheaper = researchCost(t, 'saws') <= researchCost(t, 'walls') ? 'saws' : 'walls';
  assert.equal(nextResearch(t).id, cheaper);
  g.step(.25);
  assert.equal(t.lab && t.lab.id, cheaper);
  t.lab = null; t.coins = researchCost(t, cheaper) * 2 - 1;
  const other = cheaper === 'saws' ? 'walls' : 'saws';
  assert.notEqual(nextResearch(t) && nextResearch(t).id, cheaper, 'the cheapest one costs more than half the coins');
  assert.ok(!nextResearch(t) || nextResearch(t).id === other);
});

test('the Foremen switch turns every hired foreman of the town on or off', () => {
  const g = empire('a4'), t = g.town; t.coins = 1e12;
  t.buildings.camp = 10; t.buildings.mine = 10;
  assert.ok(hireForeman(g, t, 'camp')); assert.ok(hireForeman(g, t, 'mine'));
  setForemen(t, false); assert.equal(foremenWorking(t), 0);
  setForemen(t, true); assert.equal(foremenWorking(t), 2); assert.ok(foremanOn(t, 'mine'));
});

test('Auto-towers keeps working in a town out of play and while time away is caught up', () => {
  const g = empire('a5'), t = g.towns.ridge; rich(t);
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  setAuto(g, t, 'towers', true);
  const L = t.towers[0].level;
  g.step(.25);
  assert.equal(t.towers[0].level, L + 1, 'out of play');
  g.catchUp(30 * 60);
  assert.ok(t.towers[0].level > L + 1, 'while away');
});

test('the switches survive a save and a charter, and an old save loads with every switch Off', () => {
  const g = empire('a6'), t = g.town;
  setAuto(g, t, 'towers', true); setAuto(g, t, 'research', true);
  const h = loadGame(decode(encode(g, 1)).game);
  assert.equal(autoOn(h, h.towns.gulch, 'towers'), true); assert.equal(autoOn(h, h.towns.gulch, 'research'), true);
  resetTown(g, t);
  assert.equal(autoOn(g, g.towns.gulch, 'towers'), true, 'a charter keeps the switches');
  const old = JSON.parse(encode(g, 1)); old.v = 15; delete old.game.shared.auto;
  const m = migrate(old);
  assert.equal(m.v, SAVE_VERSION); assert.deepEqual(m.game.shared.auto, {});
  const o = loadGame(m.game);
  assert.equal(autoOn(o, o.towns.gulch, 'towers'), false);
});

// Evaluation 2 (2026-11-19): a won outpost only meets light raids its towers already beat, so Auto-towers raises a
// tower there only after a raid got through, one raise per raid lost.
test('in a won outpost Auto-towers waits for a raid to get through, then raises one tower', () => {
  const g = empire('a-won'), d = g.towns.drycreek || g.addTown('drycreek');
  d.won = true; rich(d);
  d.towers = [{ spot: 0, kind: 'crossbow', level: 2, path: null, cd: 0, spent: 0, pulses: 0 }];
  d.breaches = 0;
  setAuto(g, d, 'towers', true); autoOf(g, d).wait = 0;
  assert.equal(towerBlock(g, d), 'won');
  for (let i = 0; i < 4 * 600; i++) g.step(.25);
  assert.equal(d.towers[0].level, 2, 'no raise while the raids are held');
  d.breaches = 1; autoOf(g, d).wait = 0;
  g.step(.25);
  assert.equal(d.towers[0].level, 3, 'a raid got through: one raise');
  autoOf(g, d).wait = 0;
  for (let i = 0; i < 4 * 600; i++) g.step(.25);
  assert.equal(d.towers[0].level, 3, 'one raise per raid lost');
});
