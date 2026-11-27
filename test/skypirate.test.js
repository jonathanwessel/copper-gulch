// The pirate airship, Thunder Mesa's boss from wave 20 (PLAN.md M6b part 2c): it flies the sky lane, where only the
// Tesla Coil reaches it, until at half health its crew slides down to the road and it sinks low, where every tower can
// hit it. The Mesa's first boss (wave 10) stays the war wagon, since its sky opens after it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { startWave, fight, planWave, bossKind, nextBoss, bossWave, laneFor, lanesOf, canHit, grounded, nearS, waveRun, fitsSpot } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { FOES } from '../src/data/foes.js';
import { TOWNS, laneIndex } from '../src/data/towns/index.js';
import { bossName } from '../src/ui/lost.js';
import { fightWords } from '../src/core/goals.js';

const F = TOWNS.mesa.found;
function mesa(seed) {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  g.towns.falls.bestWave = F.wave; g.town.coins = F.coins * 1.1;
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = 3; g.shared.charter.deeds = F.deeds || 0;
  foundTown(g, 'mesa'); g.go('mesa');
  return { g, t: g.towns.mesa };
}
const tw = (spot, kind, level) => ({ spot, kind, level, path: 'a', fork: null, cd: 0, spent: 0, pulses: 0 });
/* The Mesa on wave w with only the boss on the road. */
function onRoad(seed, w = 20, towers = []) {
  const { g, t } = mesa(seed);
  t.towers = towers; t.wave = w; t.waves.hold = false; t.waves.phase = 'break'; t.waves.timer = 0;
  assert.ok(startWave(g, t));
  t.waves.queue = [t.waves.queue.at(-1)];
  for (let i = 0; i < 20 && !t.waves.foes.length; i++) fight(g, t, .25);
  return { g, t, f: t.waves.foes[0] };
}
/* Towers of a kind on the first n pads that take it, from pad `from` on. */
function on(t, kind, level, n, from = 0, taken = new Set()) {
  const out = [];
  for (let i = from; i < t.def.board.spots.length && out.length < n; i++) if (!taken.has(i) && fitsSpot(t, i, kind)) { out.push(tw(i, kind, level)); taken.add(i); }
  return out;
}

test('the Mesa meets the war wagon at wave 10 and the pirate airship at every boss wave after, and no other town does', () => {
  const { t } = mesa('sp1');
  assert.equal(bossKind(t, 10), 'wagon');
  for (const w of [20, 30, 40]) { assert.ok(bossWave(t, w)); assert.equal(bossKind(t, w), 'skypirate'); assert.equal(planWave(t, w, 'mixed').at(-1), 'skypirate'); }
  assert.equal(planWave(t, 10, 'mixed').at(-1), 'wagon');
  t.wave = 4; assert.equal(nextBoss(t), 'wagon'); assert.equal(bossName(t), 'war wagon');
  t.wave = 10; assert.equal(nextBoss(t), 'wagon', 'on the boss wave itself');
  t.wave = 11; assert.equal(nextBoss(t), 'skypirate'); assert.equal(bossName(t), 'pirate airship');
  const g2 = newGame('sp1b', 'gulch');
  for (const w of [10, 20, 30]) assert.equal(bossKind(g2.town, w), 'wagon', 'the Gulch keeps its war wagon');
  for (const [k, F2] of Object.entries(FOES)) if (k !== 'skypirate') assert.ok(!(F2.boss && F2.air), k);
});

test('the pirate airship flies the sky lane, and only a tower that reaches the sky hits it until its stage', () => {
  const { g, t, f } = onRoad('sp2');
  assert.equal(f.kind, 'skypirate');
  assert.equal(f.lane, laneIndex(t.def.board, 'sky')); assert.equal(f.lane, laneFor(t, 'skypirate'));
  assert.equal(grounded(f), false);
  assert.equal(canHit({ air: false }, f), false, 'a cannon cannot reach it up high');
  assert.equal(canHit({ air: true }, f), true, 'a Tesla Coil can');
  const hp0 = f.hp;
  t.towers = on(t, 'cannon', 20, 14);
  for (let i = 0; i < 80; i++) fight(g, t, .25);
  assert.equal(f.hp, hp0, 'no ground tower hurt it');
  assert.ok(f.s > 0);
});

test('at half health its crew lands on the road under it and it sinks low, where every tower can hit it', () => {
  const { g, t, f } = onRoad('sp3'), st = FOES.skypirate.stages[0];
  for (let i = 0; i < 40; i++) fight(g, t, .25); // out over the town
  let seen = 0; g.bus.on('stage', e => { if (e.foe === f.id) seen++; });
  f.hp = f.max * (st.at - .01); fight(g, t, .25);
  assert.equal(seen, 1); assert.equal(f.stage, 1); assert.equal(f.low, true);
  assert.equal(grounded(f), true); assert.equal(canHit({ air: false }, f), true, 'a cannon can hit it now');
  const crew = t.waves.foes.filter(x => x.kind === st.drop);
  assert.equal(crew.length, st.n);
  const road = lanesOf(t)[0], at = pointAt(lanesOf(t)[f.lane], f.s), s0 = nearS(road, at);
  // the road point nearest the airship, found by a fine walk, is where the first one lands; the others just behind
  let best = Infinity; for (let s = 0; s <= road.length; s += .01) best = Math.min(best, dist(pointAt(road, s), at));
  assert.ok(dist(pointAt(road, s0), at) <= best + .02, 'nearS finds the nearest road point');
  for (const c of crew) { assert.equal(c.lane, 0, 'on the road'); assert.ok(c.s <= s0 + .3 && c.s >= s0 - 1.3, 'under it, a little behind'); assert.equal(grounded(c), true); }
  assert.ok(Math.abs(f.pace - st.speed) < 1e-9, 'it slows');
  // a saved game keeps it low
  assert.equal(grounded(JSON.parse(JSON.stringify(f))), true);
});

test('the boss gate needs both: cannons alone let it through, Teslas with cannons bring it down', () => {
  const play = pick => {
    const { g, t } = onRoad('sp4', 20);
    t.towers = pick(t);
    let leaked = false, fell = false;
    g.bus.on('leak', e => { if (e.boss) leaked = true; }); g.bus.on('kill', e => { if (e.kind === 'skypirate') fell = true; });
    for (let i = 0; i < 4 * 900 && t.waves.phase !== 'break'; i++) fight(g, t, .25);
    return { leaked, fell };
  };
  const ground = play(t => on(t, 'cannon', 18, 14));
  assert.equal(ground.fell, false); assert.equal(ground.leaked, true, 'no tower reached it up high');
  const both = play(t => { const taken = new Set(); return [...on(t, 'tesla', 17, 3, 0, taken), ...on(t, 'cannon', 18, 10, 0, taken)]; });
  assert.equal(both.fell, true, 'Teslas took it to half, then everyone');
});

test('the background battle plays the pirate airship and its crew from a run', () => {
  const { t } = onRoad('sp5', 20);
  t.waves.foes = []; t.waves.queue = ['skypirate'];
  const taken = new Set();
  t.towers = [...on(t, 'tesla', 17, 3, 0, taken), ...on(t, 'cannon', 18, 8, 0, taken)];
  const run = waveRun(t);
  assert.ok(run.ev.some(e => e[1] === 'k' && e[2] === 'skypirate'), 'the boss fell in the run');
  const crew = run.ev.filter(e => (e[1] === 'k' && e[2] === 'pirate') || (e[1] === 'l' && !e[3])).length;
  assert.equal(crew, FOES.skypirate.stages[0].n, 'its crew rode in the run');
});

test('the strip names the pirate airship in the Mesa after wave 10', () => {
  const { t } = onRoad('sp6', 20);
  assert.match(fightWords(t), /pirate airship/);
});

test('its card says only the Tesla Coil hits it while it is high, and drops that once it flies low', async () => {
  const { bestView, AIR_LABEL, BEST_LABEL } = await import('../src/ui/wave.js');
  const { g, t, f } = onRoad('sp7');
  assert.equal(bestView(t, f.kind, f).label, AIR_LABEL);
  f.hp = f.max * .4; fight(g, t, .25);
  assert.ok(f.low);
  assert.notEqual(bestView(t, f.kind, f).label, AIR_LABEL);
  assert.equal(bestView(t, f.kind, f).label, BEST_LABEL);
});
