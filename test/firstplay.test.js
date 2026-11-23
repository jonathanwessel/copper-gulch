// The newcomer bot (tools/firstplay.js) and the full audit's name, cap and model rules (M2, Bots and checks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newcomer, misses, WAIT, STUCK_LIMIT } from '../tools/firstplay.js';
import { nameRules, capRules, modelRules } from '../tools/audit.js';
import { GOODS } from '../src/data/goods.js';
import { RESEARCH } from '../src/data/research.js';
import { FOES } from '../src/data/foes.js';

const r = newcomer(1, 30);

test('the newcomer is slow: at least 3 seconds between taps', () => {
  assert.ok(r.taps.length > 50, 'only ' + r.taps.length + ' taps');
  for (let i = 1; i < r.taps.length; i++) assert.ok(r.taps[i] - r.taps[i - 1] >= WAIT[0] - 1e-9, 'taps at ' + r.taps[i - 1] + ' and ' + r.taps[i]);
});

test('the newcomer makes wrong buys, follows the goal strip, and wins Dry Creek', () => {
  assert.ok(r.wrong > 0 && r.wrong < r.buys * .5, r.wrong + ' wrong of ' + r.buys);
  assert.ok(r.goalTaps >= 5, r.goalTaps + ' taps from the goal strip');
  assert.ok(r.dcWon !== null && r.dcWon <= 20 * 60, 'won at ' + r.dcWon);
  assert.ok(r.gulchAt !== null && r.game.active === 'gulch', 'it went to the Gulch');
  assert.ok(r.stuck.longest < STUCK_LIMIT, 'stuck for ' + r.stuck.longest + ' s');
});

test('the newcomer uses only the buttons that are out', () => {
  // research starts only once the Research button is out: no research tap in the log before the flag opened it
  const first = r.log.find(l => l[2] === 'research');
  assert.ok(first, 'it never started research');
  assert.equal(first[1], 'gulch');
  assert.ok(!r.log.some(l => l[1] === 'drycreek' && l[2] === 'research'), 'research in Dry Creek');
});

test('the newcomer misses are reported in plain lines', () => {
  assert.deepEqual(misses({ ...r, wave10: 600, dcWon: 700, stuck: { longest: 60, at: 0 }, ridgeAt: 3600 }), []);
  assert.equal(misses({ ...r, wave10: 600, dcWon: 21 * 60, stuck: { longest: 60, at: 0 }, ridgeAt: 3600 }).length, 1);
  assert.match(misses({ ...r, wave10: 600, dcWon: 700, stuck: { longest: 200, at: 300 }, ridgeAt: 3600 })[0], /stuck/);
  assert.match(misses({ ...r, wave10: 600, dcWon: 700, stuck: { longest: 60, at: 0 }, ridgeAt: null })[0], /Iron Ridge founded at never/);
});

test('the audit notices two things with one name', () => {
  assert.deepEqual(nameRules(), []);
  const was = GOODS.stone.name;
  GOODS.stone.name = GOODS.ore.name;
  try { assert.ok(nameRules().some(p => p.includes(was) || p.includes(GOODS.ore.name)), 'no name clash found'); }
  finally { GOODS.stone.name = was; }
});

test('the audit notices a bonus on a stat with no published cap', () => {
  assert.deepEqual(capRules(), []);
  const id = Object.keys(RESEARCH)[0], e = RESEARCH[id].effects[0], was = e.stat;
  e.stat = 'luck';
  try { assert.ok(capRules().some(p => p.includes('"luck"'))); } finally { e.stat = was; }
});

test('every building, tower kind and raider has its own model, and the audit notices a missing one', () => {
  assert.deepEqual(modelRules(), []);
  FOES.ghost = { name: 'Ghost rider', hp: 1 };
  try { assert.ok(modelRules().some(p => p.includes('raider ghost'))); } finally { delete FOES.ghost; }
});

// Clarity fix 3: the newcomer had no tap for the Capital's step, so no newcomer run ever founded it. Every empire step
// the strip shows that can be taken now is a tap the newcomer can make.
test('the newcomer takes the empire steps the strip shows: go to the town that must climb, then found the Capital', async () => {
  const { goalTap, capitalMiss, CAPITAL_AT } = await import('../tools/firstplay.js');
  const { newGame } = await import('../src/core/setup.js');
  const { foundTown } = await import('../src/core/empire.js');
  const { goalNow, goalsOf } = await import('../src/core/goals.js');
  const { capitalOpen } = await import('../src/core/capital.js');
  const { CAPITAL_DEF } = await import('../src/data/capital.js');
  const { Rng } = await import('../src/core/rng.js');
  const g = newGame('fp-cap', 'gulch'), rng = new Rng('fp-cap');
  g.town.bestWave = 20; g.town.coins = 1e6; foundTown(g, 'ridge');
  for (const id of ['gulch', 'ridge', 'drycreek', 'pinehollow']) for (const x of goalsOf(id)) g.shared.goals.done[x.id] = true;
  g.go('gulch'); g.towns.ridge.bestWave = CAPITAL_DEF.found.wave - 5; g.town.coins = 0;
  let tap = goalTap(g, g.town, rng);
  assert.equal(goalNow(g).id, 'next:capital:there');
  assert.ok(tap && tap.what === 'go' && tap.label === 'ridge', 'the step to Iron Ridge is a tap');
  tap.run(); assert.equal(g.active, 'ridge');
  g.towns.ridge.bestWave = CAPITAL_DEF.found.wave; g.town.coins = CAPITAL_DEF.found.coins;
  tap = goalTap(g, g.town, rng);
  assert.equal(goalNow(g).id, 'next:capital:go');
  assert.ok(tap && tap.label === 'capital', 'the step to found the Capital is a tap');
  tap.run(); assert.ok(capitalOpen(g));
  // the gate: most seeds and the median within CAPITAL_AT
  const at = m => ({ capitalAt: m * 60 });
  assert.equal(capitalMiss([at(112), at(125), at(130), at(140), at(148), at(160)]), null);
  assert.ok(capitalMiss([at(112), at(125), at(155), at(160), at(170), { capitalAt: null }]), 'the median over ' + CAPITAL_AT / 60 + ' min fails');
});
