// Two towns on screen (PLAN.md M1b, box 2): switching the town in play, the town out of play waiting for its next wave,
// and the explainers that belong to one town.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { winOutpost } from '../src/core/outpost.js';
import { waitsAway } from '../src/core/defense.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { helper } from '../src/ui/coach.js';
import { TOWNS, TOWN_ORDER } from '../src/data/towns/index.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
/* The first card a town would show to a player who has seen none. */
const first = (g, seen = {}) => { const h = helper(g.town, g); return EXPLAINERS.find(e => !seen[e.id] && (!e.town || e.town === h.id) && e.when(h)); };

test('winning Dry Creek opens the Gulch and go() switches the town in play both ways, and the save keeps it', () => {
  const g = newGame('t1');
  winOutpost(g, g.town);
  assert.ok(g.towns.gulch);
  assert.equal(g.active, 'drycreek');
  assert.equal(g.go('gulch'), true);
  assert.equal(g.town.id, 'gulch');
  assert.equal(g.go('gulch'), false);
  assert.equal(g.go('nowhere'), false);
  const back = loadGame(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(back.active, 'gulch');
  assert.equal(back.go('drycreek'), true);
  assert.equal(back.town.id, 'drycreek');
});

test('a town out of play waits for the player: its next wave does not come, but its goods keep coming', () => {
  const g = newGame('t2');
  winOutpost(g, g.town);
  const gulch = g.towns.gulch;
  assert.equal(waitsAway(g, gulch), true);
  assert.equal(waitsAway(g, g.towns.drycreek), false);
  const made = gulch.made.timber || 0, timer = gulch.waves.timer;
  run(g, TOWNS.gulch.waves?.first || 60);
  assert.equal(gulch.waves.phase, 'break');
  assert.equal(gulch.wave, 1);
  assert.equal(gulch.waves.timer, timer, 'the clock to wave 1 stopped');
  assert.ok((gulch.made.timber || 0) > made);
  g.go('gulch');
  assert.equal(waitsAway(g, gulch), false);
  run(g, timer + 1);
  assert.equal(gulch.waves.phase, 'wave');
});

test('a won outpost out of play keeps its raids', () => {
  const g = newGame('t3');
  winOutpost(g, g.town);
  g.go('gulch');
  const dc = g.towns.drycreek, w = dc.wave;
  run(g, (TOWNS.drycreek.raid || 120) + 1);
  assert.equal(dc.wave, w);
  assert.ok(dc.waves.phase === 'wave' || dc.waves.age < 30, 'a raid started');
});

test('a new game opens on the Dry Creek welcome, a Gulch-only game on the Gulch welcome', () => {
  assert.equal(first(newGame('t4')).id, 'dc-welcome');
  assert.equal(first(newGame('t5', 'gulch')).id, 'welcome');
});

test('explainers named for one town never show in another, and the Gulch tower cards wait for the Gulch', () => {
  const g = newGame('t6'), t = g.town, h = helper(t, g);
  t.made.ore = 50; t.made.planks = 50; t.made.clay = 50;
  const shown = EXPLAINERS.filter(e => (!e.town || e.town === h.id) && e.when(helper(t, g))).map(e => e.id);
  for (const id of ['welcome', 'vault', 'boss', 'cannon', 'still', 'frost', 'mortar', 'pit']) assert.ok(!shown.includes(id), id + ' showed in Dry Creek');
  for (const e of EXPLAINERS) if (e.town) assert.ok(TOWNS[e.town], e.id + ' names a town that does not exist');
});

test('the win card offers a button to the town the outpost opens, and shows once the outpost is won', () => {
  const card = EXPLAINERS.find(e => e.id === 'dc-won');
  assert.equal(card.go, TOWNS.drycreek.opens);
  assert.ok(card.button && card.button.includes(TOWNS.gulch.name));
  const g = newGame('t7');
  assert.equal(card.when(helper(g.town, g)), false);
  winOutpost(g, g.town);
  assert.equal(card.when(helper(g.town, g)), true);
});

test('the town chip and the outpost cards show in the Gulch once both towns are open', () => {
  const g = newGame('t8');
  winOutpost(g, g.town); g.go('gulch'); run(g, 60);
  const h = helper(g.town, g);
  assert.equal(h.towns, 2);
  assert.equal(h.outpostWon, true);
  for (const id of ['townchip', 'outposts']) assert.ok(EXPLAINERS.find(e => e.id === id).when(h), id);
  for (const id of TOWN_ORDER) assert.ok(TOWNS[id].short, id + ' has a short name for the chip');
});

test('coins from an outpost sale reach the town in play but do not count toward its deeds; save v9 adds the count', async () => {
  const { deedParts } = await import('../src/core/charter.js');
  const { migrate, SAVE_VERSION } = await import('../src/core/save.js');
  const g = newGame('t9');
  winOutpost(g, g.town); g.go('gulch');
  const gulch = g.towns.gulch, dc = g.towns.drycreek;
  dc.buildings.quarry = 15; dc.sell = {};
  const before = gulch.coins;
  run(g, 60);
  assert.ok(gulch.fromOutposts > 0, 'Dry Creek paid in');
  assert.ok(gulch.coins - before >= gulch.fromOutposts * .5);
  assert.equal(gulch.ownEarned, gulch.lifetime - gulch.fromOutposts);
  gulch.lifetime = 1e6; gulch.fromOutposts = 1e6;
  assert.equal(deedParts(gulch).coins, 0, 'outpost coins earn no deed');
  gulch.fromOutposts = 0;
  assert.ok(deedParts(gulch).coins > 0);
  assert.ok(SAVE_VERSION >= 9);
  const old = { v: 8, at: 0, game: { towns: { gulch: { id: 'gulch', lifetime: 5 } } } };
  assert.equal(migrate(old).game.towns.gulch.fromOutposts, 0);
});

test('Dry Creek is paced so a player who never calls a wave wins in 12-15 minutes: waves at least 80 s apart', async () => {
  const { wavesOf } = await import('../src/core/defense.js');
  const g = newGame('t10'), w = wavesOf(g.town);
  assert.equal(w.pace, 80);
  const earliest = w.first + (TOWNS.drycreek.goal - 1) * w.pace;
  assert.ok(earliest >= 12 * 60 && earliest <= 13 * 60, 'wave 10 starts at ' + earliest + ' s at the soonest without Call now');
});
