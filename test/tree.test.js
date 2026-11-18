// Institutions and the Empire tree (M4): founding them from the purse, upgrades bought with Influence, each a named
// source on every town's stats inside its cap, charters keep it, the save keeps it, and the old save migrates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { foundTown } from '../src/core/empire.js';
import { capitalOf, foundCapital, takeContract, claim } from '../src/core/capital.js';
import { cost } from '../src/core/economy.js';
import { researchCost } from '../src/core/research.js';
import { foundCost, foundBlock, foundInstitution, nodeBlock, nodeCost, buyNode, nextNode, nodesOf, treeCalls, influenceFor } from '../src/core/tree.js';
import { resetTown } from '../src/core/charter.js';
import { explainPrice } from '../src/core/explain.js';
import { INSTITUTIONS, INSTITUTION, FOUND, NODE_COST } from '../src/data/institutions.js';
import { CAPS } from '../src/core/mods.js';
import { CAPITAL_DEF } from '../src/data/capital.js';

/* A game with the Gulch, Iron Ridge and their outposts open, and the Capital built. */
function empire(seed = 'tree', coins = 1e7) {
  const g = newGame(seed, 'gulch'), gu = g.town;
  gu.bestWave = 20; gu.coins = 1e9;
  foundTown(g, 'ridge');
  for (const t of Object.values(g.towns)) if (t.waves) t.waves.hold = true;
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave;
  foundCapital(g);
  gu.coins = coins;
  return g;
}

test('institutions are founded once each with coins from the purse, and each one makes the next cost more', () => {
  const g = newGame('t0', 'gulch');
  assert.equal(foundBlock(g, 'bank'), 'closed', 'no Capital yet');
  assert.equal(treeCalls(g), false);
  const e = empire('t1', FOUND.coins - 1);
  assert.equal(foundCost(e), FOUND.coins);
  assert.equal(foundBlock(e, 'bank'), 'coins', 'one coin short');
  e.town.coins = FOUND.coins + 10;
  assert.equal(treeCalls(e), true, 'the Capital badge gets a dot');
  const seen = []; e.bus.on('institution:found', x => seen.push(x));
  assert.equal(foundInstitution(e, 'bank'), true);
  assert.equal(Math.round(e.town.coins), 10, 'the purse paid');
  assert.equal(foundInstitution(e, 'bank'), false, 'only once');
  assert.equal(foundBlock(e, 'bank'), 'done');
  assert.equal(foundCost(e), FOUND.coins * FOUND.growth, 'the next one costs more, whichever it is');
  e.town.coins = 1e9;
  assert.equal(foundInstitution(e, 'war'), true);
  assert.equal(foundCost(e), FOUND.coins * FOUND.growth ** 2);
  assert.deepEqual(seen.map(x => x.id), ['bank', 'war']);
  assert.deepEqual(seen.map(x => x.coins), [FOUND.coins, FOUND.coins * FOUND.growth]);
});

test('upgrades are bought in order with Influence, and each branch tops out', () => {
  const g = empire('t2'), c = capitalOf(g);
  assert.equal(nodeBlock(g, 'bank'), 'closed', 'not founded yet');
  foundInstitution(g, 'bank');
  assert.equal(nodeBlock(g, 'bank'), 'influence');
  c.influence = NODE_COST[0];
  assert.equal(nextNode(g, 'bank').id, INSTITUTION.bank.nodes[0].id);
  assert.equal(buyNode(g, 'bank'), true);
  assert.equal(c.influence, 0, 'Influence paid');
  assert.equal(nodesOf(g, 'bank'), 1);
  assert.equal(nextNode(g, 'bank').id, INSTITUTION.bank.nodes[1].id, 'the next one in the line');
  c.influence = 1e6;
  while (buyNode(g, 'bank'));
  assert.equal(nodesOf(g, 'bank'), INSTITUTION.bank.nodes.length);
  assert.equal(nodeBlock(g, 'bank'), 'max');
  assert.equal(nodeCost(g, 'bank'), null);
  assert.equal(c.influence, 1e6 - NODE_COST.slice(1).reduce((a, b) => a + b, 0));
  assert.equal(g.shared.tree.spent, NODE_COST.reduce((a, b) => a + b, 0));
});

test('every upgrade is a named source on every town, outposts only where it says, inside the published caps', () => {
  const g = empire('t3'), c = capitalOf(g), gu = g.towns.gulch, dc = g.towns.pinehollow;
  for (const i of INSTITUTIONS) foundInstitution(g, i.id);
  const before = { price: gu.mods.factor('price'), build: cost(gu, 'camp'), research: researchCost(gu, 'saws'), outpost: dc.mods.factor('prod'), town: gu.mods.factor('prod') };
  c.influence = 1e6;
  buyNode(g, 'market');
  assert.ok(Math.abs(gu.mods.factor('price') / before.price - 1.1) < 1e-9, 'Price Lists: goods sell for 10% more');
  assert.ok(explainPrice(g, gu, 'copper').rows.some(r => r.label === 'Market Board' && Math.abs(r.mul - 1.1) < 1e-9), 'the explain view names the Market Board');
  buyNode(g, 'transport');
  assert.ok(Math.abs(dc.mods.factor('prod') / before.outpost - 1.25) < 1e-9, 'Freight Office: outposts make 25% more');
  assert.equal(gu.mods.factor('prod'), before.town, 'but not towns');
  buyNode(g, 'transport');
  assert.ok(cost(gu, 'camp') < before.build, 'Survey Crews: buildings cost less');
  buyNode(g, 'university'); buyNode(g, 'university');
  assert.ok(researchCost(gu, 'saws') < before.research, 'Lab Grants: research costs less');
  assert.ok(Math.abs(gu.mods.factor('research') - 1.3) < 1e-9);
  // every stat the tree names has a published cap, and buying everything stays inside them
  for (const i of INSTITUTIONS) for (const n of i.nodes) for (const e of n.effects) assert.ok(CAPS[e.stat] || CAPS[e.stat.split(':')[0]], e.stat + ' has a cap');
  for (const i of INSTITUTIONS) while (buyNode(g, i.id));
  for (const t of Object.values(g.towns)) for (const st of Object.keys(t.mods.src)) { const ex = t.mods.explain(st, 1), cap = CAPS[st] || CAPS[st.split(':')[0]]; assert.ok(cap.max !== undefined ? ex.factor <= cap.max : ex.factor >= cap.min, st); }
});

test('the Market Board raises the Influence a contract pays', () => {
  const g = empire('t4'), c = capitalOf(g);
  foundInstitution(g, 'market');
  c.influence = NODE_COST[0] + NODE_COST[1];
  buyNode(g, 'market'); buyNode(g, 'market');
  assert.equal(influenceFor(g, 8), 10, 'Federal Agents: 25% more');
  // an offer on the board (this test town builds nothing, so one is put there by hand)
  const o = { id: 99, good: 'bricks', town: 'gulch', need: 20, got: 0, minutes: 6, coins: 100, influence: 4 };
  c.offers.push(o); takeContract(g, o.id);
  const t = g.towns[o.town], seen = [];
  g.bus.on('contract:done', e => seen.push(e));
  t.goods[o.good] = 1e6;
  claim(g, t);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].influence, influenceFor(g, o.influence));
  assert.equal(c.influence, influenceFor(g, o.influence));
});

test('a charter keeps the tree, and a new town gets it too', () => {
  const g = empire('t5'), c = capitalOf(g), gu = g.towns.gulch;
  foundInstitution(g, 'war'); c.influence = 100; buyNode(g, 'war');
  const f = gu.mods.factor('towerDmg');
  assert.ok(Math.abs(f - 1.1) < 1e-9);
  resetTown(g, gu);
  assert.ok(Math.abs(gu.mods.factor('towerDmg') - f) < 1e-9, 'kept after a charter');
  assert.equal(nodesOf(g, 'war'), 1);
  // a town opened after the upgrade has it from the start
  g.towns.gulch.bestWave = 99;
  const t = g.addTown('drycreek');
  assert.ok(Math.abs(t.mods.factor('towerDmg') - 1.1) < 1e-9);
});

test('the save keeps the tree, and a v14 save loads with none founded', () => {
  const g = empire('t6'), c = capitalOf(g);
  foundInstitution(g, 'market'); foundInstitution(g, 'bank');
  c.influence = 100; buyNode(g, 'market'); buyNode(g, 'market'); buyNode(g, 'bank');
  const back = loadGame(decode(encode(g, 0)).game);
  assert.deepEqual(back.shared.tree.founded, ['market', 'bank']);
  assert.equal(nodesOf(back, 'market'), 2);
  assert.ok(Math.abs(back.towns.gulch.mods.factor('income') - 1.1 * back.towns.gulch.mods.explain('income', 1).parts.filter(p => p.source !== 'Bank').reduce((m, p) => m * p.mul, 1)) < 1e-9, 'the Bank is back on income');
  assert.equal(influenceFor(back, 8), 10, 'the Influence bonus is rebuilt');
  assert.ok(SAVE_VERSION >= 15);
  const old = JSON.parse(encode(empire('t7'), 0)); old.v = 14; delete old.game.shared.tree;
  const m = migrate(old);
  assert.deepEqual(m.game.shared.tree, { founded: [], nodes: {}, spent: 0 });
  const g2 = loadGame(m.game);
  assert.equal(foundCost(g2), FOUND.coins);
});

test('names and text follow the rules: unique names, no colons, every node says what it does', () => {
  const names = new Set();
  for (const i of INSTITUTIONS) {
    for (const x of [i.name, ...i.nodes.map(n => n.name)]) { assert.ok(!names.has(x), 'one name twice ' + x); names.add(x); }
    assert.equal(i.nodes.length, NODE_COST.length);
    for (const n of i.nodes) { assert.ok(!/[:;]/.test(n.about), n.about); assert.ok(/\.$/.test(n.about)); assert.ok(n.effects.length); }
  }
});
