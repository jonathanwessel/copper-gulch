// The progression and first-play clarity pass (PLAN.md M6a, 2026.11.23-2). A newcomer's play (tools/playthrough.js)
// showed the strip asking for things the player could not act on for 15-25 minutes, and a blank strip from about an
// hour in. These check the goal strip always names a step that can be taken now, with have / need.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalText, goalsOf, nextStep, meterWords } from '../src/core/goals.js';
import { foundTown } from '../src/core/empire.js';
import { setHold } from '../src/core/defense.js';
import { cost } from '../src/core/economy.js';
import { textIssues } from '../tools/audit.js';
import { TOWNS } from '../src/data/towns/index.js';
import { CAPITAL_DEF } from '../src/data/capital.js';

const gulch = seed => { const g = newGame(seed, 'gulch'); return g; };
const allDone = (g, town) => { for (const x of goalsOf(town)) g.shared.goals.done[x.id] = true; };

test('a building goal counts its price as have / need', () => {
  const g = gulch('cl1'), t = g.town;
  for (const x of goalsOf('gulch')) if (x.id !== 'g-smelter') g.shared.goals.done[x.id] = true;
  Object.assign(t.buildings, { camp: 10, mine: 10 }); // the Smelter lot is open
  const x = goalNow(g);
  assert.equal(x.id, 'g-smelter');
  assert.equal(x.need, cost(t, 'smelter'), 'the price the strip counts up to');
});

test('a locked lot asks for the level that opens it, in plain words', () => {
  const g = gulch('cl2'), t = g.town;
  allDone(g, 'gulch'); delete g.shared.goals.done['g-tools'];
  const tools = goalsOf('gulch').find(x => x.id === 'g-tools');
  const ready = tools.ready; tools.ready = () => true;
  try {
    Object.assign(t.buildings, { camp: 30, saw: 4, smelter: 5 });
    const x = goalNow(g);
    assert.equal(x.id, 'g-tools>saw');
    assert.equal(goalText(g, t, x), 'Tap the Sawmill and upgrade it to level 10 to open the Toolsmith');
    assert.deepEqual(x.at(), { plot: 'saw' });
    assert.equal(x.need, undefined, 'an upgrade step shows no price beside its level');
    t.buildings.saw = 10;
    assert.equal(goalNow(g).id, 'g-tools');
  } finally { tools.ready = ready; }
});

test('a town with no goal left shows the next step for the empire: the wave, then the coins, then the map', () => {
  const g = gulch('cl3'), t = g.town, f = TOWNS.ridge.found;
  allDone(g, 'gulch');
  t.bestWave = 12;
  let x = goalNow(g);
  assert.equal(x.text, 'Reach wave ' + f.wave + ' in Copper Gulch to open Iron Ridge');
  assert.equal(meterWords(x, g), 'wave 12 / ' + f.wave, 'the count says what it counts');
  t.bestWave = f.wave; t.coins = 10;
  x = goalNow(g);
  assert.equal(x.text, 'Save coins to open Iron Ridge');
  assert.equal(x.need, f.coins);
  t.coins = f.coins;
  assert.equal(goalNow(g).text, 'Tap Map, then tap Iron Ridge to start it');
});

test('after Iron Ridge the strip leads to the Capital (the lower wave), then Silver Falls with its deeds', () => {
  const g = gulch('cl4'), t = g.town;
  t.bestWave = 20; t.coins = 1e6; foundTown(g, 'ridge');
  allDone(g, 'gulch'); allDone(g, 'ridge'); allDone(g, 'drycreek'); allDone(g, 'pinehollow');
  const r = g.towns.ridge; r.bestWave = 10;
  let x = nextStep(g);
  assert.equal(x.next, 'capital');
  // in the Gulch it sends the player to Iron Ridge (clarity fix 3), with no count: it read as the Gulch's wave
  assert.equal(x.text, 'Tap Map, Iron Ridge, then reach wave ' + CAPITAL_DEF.found.wave + ' there to build the Capital');
  assert.equal(x.at().go, 'ridge');
  assert.equal(x.meter, undefined);
  g.go('ridge');
  x = nextStep(g);
  assert.equal(x.text, 'Reach wave ' + CAPITAL_DEF.found.wave + ' in Iron Ridge to build the Capital');
  assert.equal(meterWords(x, g), 'wave 10 / ' + CAPITAL_DEF.found.wave, 'in Iron Ridge, beside its own wave bar');
  g.shared.capital.open = true;
  r.bestWave = TOWNS.falls.found.wave;
  x = nextStep(g);
  assert.equal(x.next, 'falls');
  assert.equal(x.text, 'Sign a charter in Perks for the deeds to open Silver Falls');
  assert.equal(meterWords(x, g), '0 / ' + TOWNS.falls.found.deeds + ' deeds');
});

test('every new strip line follows the writing rule', () => {
  const lines = ['Tap the Sawmill and upgrade it to level 10 to open the Toolsmith', 'Tap the Kiln lot, then tap Build',
    'Reach wave 30 in Iron Ridge to build the Capital', 'Tap Map, Iron Ridge, then reach wave 30 there to build the Capital', 'Sign a charter in Perks for the deeds to open Silver Falls', 'Save coins to build the Capital', 'Tap Map, then tap the Capital to build it'];
  for (const s of lines) assert.deepEqual(textIssues(s), [], s);
});

test('once only coins are missing, the Capital leads the strip in every town, ahead of the town\'s own goals (clarity fix 3)', () => {
  const g = gulch('cl9'), t = g.town;
  t.bestWave = 20; t.coins = 1e6; foundTown(g, 'ridge');
  t.coins = 1000;
  g.go('ridge');
  const r = g.town;
  assert.ok(goalNow(g).id.startsWith('r-'), 'before wave 30 the Ridge shows its own goals');
  r.bestWave = CAPITAL_DEF.found.wave;
  let x = goalNow(g);
  assert.equal(x.id, 'next:capital:coins');
  setHold(g, r, true);
  x = goalNow(g);
  assert.equal(x.id, 'next:capital:coins', 'a player holding the Ridge to save is not asked to resume');
  assert.equal(x.need, CAPITAL_DEF.found.coins);
  assert.ok(goalNow(g, false).id.startsWith('r-'), 'the careful bots save for it by their own rule and still read the Ridge goals');
  g.go('gulch');
  assert.equal(goalNow(g).id, 'next:capital:coins', 'the same in the Gulch');
  g.go('pinehollow');
  assert.ok(!goalNow(g) || goalNow(g).next !== 'capital', 'not in an outpost still being won');
  g.go('ridge');
  r.coins = CAPITAL_DEF.found.coins;
  assert.equal(goalNow(g).id, 'next:capital:go');
  g.shared.capital.open = true;
  assert.equal(goalNow(g).id, 'resume', 'once it stands, Resume waves');
  setHold(g, r, false);
  assert.ok(goalNow(g).id.startsWith('r-'), 'then the Ridge goals come back');
});
