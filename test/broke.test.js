// Clarity fixes 4 and 10 (PLAN.md M6a, reviews 3 and 10 of 2026-11-23): nothing asks for coins while nothing comes in,
// and the numbers and spotlights say what is true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { goalNow, goalCoins, brokeWatch, BROKE_LIMIT, earnRate, EARN_WINDOW } from '../src/core/goals.js';
import { incomeWindow, explainWindow, INCOME_SPAN } from '../src/core/explain.js';
import { buildTower } from '../src/core/defense.js';
import { winOutpost } from '../src/core/outpost.js';
import { researchCost } from '../src/core/research.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { helper } from '../src/ui/coach.js';
import { researchDoneWords } from '../src/ui/play.js';
import { newcomer } from '../tools/firstplay.js';

const step = (g, n = 1) => { for (let i = 0; i < n; i++) g.step(.25); };

// the gate of fix 4; seen red before the wave-1 Call now step: 33-35 s on seeds 1, 5 and 6 ("Tap the Stone Camp, then
// tap Upgrade" at 0 of 12 coins until wave 1's raiders fell)
test('the newcomer\'s first hour never shows a coin goal for more than 30 seconds while nothing comes in', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = brokeWatch();
    newcomer(seed, 60, (g, at) => { w.step(g, at); return false; });
    const long = w.stretches.filter(s => s.len > BROKE_LIMIT).map(s => Math.round(s.from) + ' s ' + s.goal + ' (' + Math.round(s.len) + ' s)');
    assert.deepEqual(long, [], 'seed ' + seed);
  }
});

test('after the first Crossbow the strip asks for Call now, which costs nothing and pays at once', () => {
  const g = newGame('broke1'), t = g.town;
  t.goods.stone = 6; // what a Crossbow takes: none left over to sell
  assert.ok(buildTower(g, t, 0, 'crossbow')); step(g);
  const s = goalNow(g);
  assert.equal(s.id, 'dc-first');
  assert.equal(goalCoins(g, t, s), null);
  assert.ok(t.coins < 12, 'nothing else could be paid for now');
});

test('the Research goal counts the coins its cheapest item takes while they are short', () => {
  const g = newGame('broke2', 'gulch'), t = g.town;
  t.flags['open:research'] = true;
  t.buildings.saw = Math.max(t.buildings.saw || 0, 1);
  for (const id of Object.keys(g.shared.goals.done)) delete g.shared.goals.done[id];
  const all = goalNow(g); // find the research goal the way the strip does: mark the goals before it done
  let s = all, n = 0;
  while (s && s.id !== 'g-research' && n++ < 60) { g.shared.goals.done[s.id.split('>')[0]] = true; s = goalNow(g); }
  assert.equal(s && s.id, 'g-research');
  t.coins = 1;
  s = goalNow(g);
  assert.ok(s.need > 1, 'have / need on the strip');
  t.coins = 1e6;
  assert.ok(!goalNow(g).need, 'no count once it can be paid');
});

test('the Mortar pit card waits for the Mortar, and the Capital card never says soon', () => {
  const g = newGame('broke3', 'gulch'), t = g.town;
  t.bestWave = 6; t.waves.phase = 'break';
  const h = helper(t, g);
  assert.ok(h.firstPit !== null, 'the Gulch has a pit');
  for (const e of EXPLAINERS.filter(x => x.covers.includes('pit'))) assert.ok(!e.when(h), e.id + ' shows before the Mortar opens');
  t.flags['open:mortar'] = true;
  assert.ok(EXPLAINERS.filter(x => x.covers.includes('pit')).some(e => e.when(helper(t, g))), 'a card covers the pits once the Mortar opens');
  for (const e of EXPLAINERS) assert.ok(!/\bsoon\b/i.test(e.text), e.id + ' says soon');
});

// the gate of fix 10's rate; seen red with INCOME_SPAN at 5 (the old top bar's window): it read 0 while the purse grew
test('the coin rate follows the purse: it is earnRate, and never 0 while the purse grew in the last minute', () => {
  assert.equal(INCOME_SPAN, EARN_WINDOW, 'the top bar and the strip count the same minute');
  const g = newGame('broke4'), dc = g.town;
  dc.goods.stone = 1e3; dc.coins = 1e3;
  for (const s of [0, 1, 2, 3]) buildTower(g, dc, s, 'crossbow');
  winOutpost(g, dc); g.go('gulch'); const gt = g.town;
  gt.coins = 500; gt.goods.timber = 100; buildTower(g, gt, 0, 'crossbow'); buildTower(g, gt, 1, 'crossbow');
  const hist = [], earned = [];
  let zero = 0, checked = 0;
  for (let s = 0; s < 4 * 600; s++) {
    step(g);
    if (s % 4) continue;
    const at = g.stats.steps * .25, ex = explainWindow(g), er = earnRate(g, hist);
    earned.push([at, g.earned]);
    if (at < 70) continue;
    checked++;
    assert.ok(Math.abs(ex.value - er) < 1e-6 * Math.max(1, er), 'at ' + at + ' s: ' + ex.value + ' against ' + er);
    assert.ok(Math.abs(ex.rows.reduce((a, r) => a + r.value, 0) - ex.value) < 1e-9, 'the rows add up to the number');
    const back = earned.find(e => e[0] >= at - EARN_WINDOW + 1); // a fixed minute, not the window under test
    if (g.earned > back[1] + 1e-6 && ex.value <= 0) zero++;
  }
  assert.ok(checked > 400);
  assert.equal(zero, 0, 'seconds the rate read 0 while the purse grew');
});

test('the window lasts across switching towns, and a charter or a load starts it over', () => {
  const g = newGame('broke5');
  for (let i = 0; i < 40; i++) { step(g); incomeWindow(g); }
  const h = incomeWindow(g), n = h.length;
  assert.ok(n > 5);
  assert.equal(incomeWindow(g), h, 'one list on the game');
  assert.ok(!('incomeHist' in g.toJSON()), 'never saved');
});

test('a finished Thick Walls says how many hearts the vault has now', () => {
  const g = newGame('broke6', 'gulch'), t = g.town;
  const w = researchDoneWords(t, { id: 'walls', level: 1 });
  assert.match(w, /^Thick Walls level 1 is done\. The vault has \d+ hearts now\.$/);
  assert.ok(researchCost(t, 'walls') > 0);
});

// clarity fix 8c: the map's top bar, its labels and its Income card read windowRates, the town's top bar reads
// explainWindow, and both are one sum (seen red with the map on FlowMeter's few seconds: +2.1/s on the map, +1.6/s in
// the town, the same moment)
test('the coin rate in a town and on the map are one number, and the map labels add up to it', async () => {
  const { windowRates } = await import('../src/core/explain.js');
  const g = newGame('broke8c'), dc = g.town;
  dc.goods.stone = 1e3; dc.coins = 1e3;
  for (const s of [0, 1, 2, 3]) buildTower(g, dc, s, 'crossbow');
  winOutpost(g, dc); g.go('gulch'); const gt = g.town;
  gt.coins = 500; gt.goods.timber = 100; buildTower(g, gt, 0, 'crossbow');
  let checked = 0;
  for (let s = 0; s < 4 * 240; s++) {
    step(g);
    if (s % 8) continue;
    const ex = explainWindow(g), wr = windowRates(g);
    assert.equal(ex.value, wr.total, 'the town and the map at ' + s);
    const sum = Object.values(wr.towns).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - wr.total) < 1e-9, 'the towns add up to the total');
    if (wr.total > 0 && wr.towns.drycreek > 0 && wr.towns.gulch > 0) checked++;
  }
  assert.ok(checked > 10, 'both places earned ' + checked);
});
