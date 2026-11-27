// Thunder Mesa, part 2b (PLAN.md M6b): the sky lane and the airship raider. Airships fly their own lane out of a cloud
// bank to the vault, only in a town with a sky (board.sky), every waves.airEvery-th raider from waves.airFrom, and only
// a tower that reaches the sky (the Tesla Coil) can hit them. A ground-only town's waves never send one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { planWave, lanesOf, laneFor, airWave, wavesOf, startWave, fight, waveRun } from '../src/core/defense.js';
import { STEP } from '../src/core/clock.js';
import { TOWNS, TOWN_ORDER, laneDefs, laneHides, laneIndex } from '../src/data/towns/index.js';
import { FOES, WAVE_TYPES } from '../src/data/foes.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { explainVault } from '../src/core/explain.js';
import { mapRules } from '../tools/audit.js';

const F = TOWNS.mesa.found;
function mesa(seed) {
  const g = newGame(seed, 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  g.towns.falls.bestWave = F.wave; g.town.coins = F.coins * 1.1;
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = 3; g.shared.charter.deeds = F.deeds || 0;
  foundTown(g, 'mesa'); g.go('mesa');
  return g;
}
/* A high tower of one kind on every normal pad of the Mesa. */
const fill = (t, kind, level) => { const B = t.def.board; t.towers = []; B.spots.forEach((p, i) => { if (!B.pits.includes(i)) t.towers.push({ spot: i, kind, level, path: 'a', fork: null, cd: 0, spent: 1, pulses: 0 }); }); };

test('the lanes come in one order everywhere: the road, then the river, then the sky', () => {
  for (const id of TOWN_ORDER) {
    const B = TOWNS[id].board, keys = laneDefs(B).map(l => l.key);
    assert.deepEqual(keys, ['road', ...(B.river ? ['river'] : []), ...(B.sky ? ['sky'] : [])], id);
    assert.equal(laneHides(B).length, keys.length, id);
  }
  assert.deepEqual(laneDefs(TOWNS.mesa.board).map(l => l.key), ['road', 'sky']);
  assert.equal(laneIndex(TOWNS.falls.board, 'sky'), -1);
});

test('a ground-only town never sends an airship, in any wave or wave kind', () => {
  const g = newGame('sky1', 'gulch');
  for (const id of TOWN_ORDER.filter(id => id !== 'mesa')) {
    const t = g.towns[id] || g.addTown(id);
    assert.ok(!TOWNS[id].board.sky, id + ' has no sky');
    for (let w = 1; w <= 80; w++) {
      assert.equal(airWave(t, w), false, id + ' wave ' + w);
      for (const type of Object.keys(WAVE_TYPES)) assert.ok(!planWave(t, w, type).some(k => FOES[k].air), id + ' wave ' + w + ' ' + type);
    }
  }
  // seen red: a stand-in sky on the Gulch board makes its waves send airships
  const t = g.towns.gulch, d = t.def;
  t.def = { ...d, waves: { ...(d.waves || {}), airEvery: 5, airFrom: 6 }, board: { ...d.board, sky: TOWNS.mesa.board.sky } };
  try { assert.ok(planWave(t, 8, 'mixed').includes('airship')); } finally { t.def = d; }
});

test('the Mesa sends every airEvery-th raider by air from airFrom, on the sky lane to the vault', () => {
  const g = mesa('sky2'), t = g.town, W = wavesOf(t);
  assert.ok(W.airEvery >= 2 && W.airFrom > 1);
  assert.ok(!planWave(t, W.airFrom - 1, 'mixed').includes('airship'), 'none before airFrom');
  for (let w = W.airFrom; w < W.airFrom + 20; w++) {
    const q = planWave(t, w, 'mixed');
    q.forEach((k, i) => { if (!FOES[k].boss) assert.equal(k === 'airship', (i + 1) % W.airEvery === 0, 'wave ' + w + ' raider ' + i); });
  }
  assert.equal(laneFor(t, 'airship'), 1); assert.equal(laneFor(t, 'raider'), 0);
  t.wave = W.airFrom; t.waves.phase = 'break'; startWave(g, t, 0);
  for (let i = 0; i < 400 && !t.waves.foes.some(f => f.kind === 'airship'); i++) fight(g, t, STEP);
  const ship = t.waves.foes.find(f => f.kind === 'airship');
  assert.ok(ship && ship.lane === 1, 'it rides lane 1, the sky');
  const sky = lanesOf(t)[1];
  assert.deepEqual(sky.points[sky.points.length - 1], TOWNS.mesa.board.vault);
});

test('only the Tesla Coil stops airships: with Crossbows alone they reach the vault', () => {
  const run = kind => {
    const g = mesa('sky3-' + kind), t = g.town;
    fill(t, kind, 12);
    t.vault = { hp: 1e9, max: 1e9 };
    t.wave = wavesOf(t).airFrom; t.waves.phase = 'break'; startWave(g, t, 0);
    let leaks = 0; const emit = g.bus.emit.bind(g.bus);
    g.bus.emit = (type, e) => { if (type === 'leak' && e.town === 'mesa') { const f = t.waves.foes.find(x => x.id === e.foe); if (f && FOES[f.kind].air) leaks++; } return emit(type, e); };
    for (let i = 0; i < 4000 && t.waves.phase === 'wave'; i++) fight(g, t, STEP);
    return leaks;
  };
  assert.ok(run('crossbow') >= 1, 'airships get past Crossbows');
  assert.equal(run('tesla'), 0, 'Tesla Coils bring them all down');
});

test('the background battle plays the sky lane too: a wave run counts the airships it kills and lets through', () => {
  const g = mesa('sky4'), t = g.town;
  fill(t, 'tesla', 10);
  t.wave = wavesOf(t).airFrom + 2; t.waves.phase = 'break'; startWave(g, t, 0);
  assert.ok(waveRun(t).ev.some(e => e[1] === 'k' && e[2] === 'airship'), 'the run kills airships');
  fill(t, 'crossbow', 10);
  const hits = waveRun(t).ev.filter(e => e[1] === 'l').reduce((a, e) => a + e[2], 0);
  assert.ok(hits >= FOES.airship.leak, 'with no Tesla the airships get through in the background too');
});

test('the airship is listed only where there is a sky, its card says its hits, and its lane has an entrance', () => {
  const g = mesa('sky5');
  assert.ok(explainVault(g.towns.mesa).raiders.some(r => r.kind === 'airship'));
  assert.ok(!explainVault(g.towns.falls).raiders.some(r => r.kind === 'airship'));
  const e = EXPLAINERS.find(x => x.id === 'airship');
  assert.ok(e && e.town === 'mesa' && e.covers.includes('sky') && !/[;:]/.test(e.text));
  assert.ok(e.text.includes(FOES.airship.leak + ' hits'), 'the card says the hits the vault takes');
  assert.ok(e.when({ airOut: 3 }) && !e.when({ airOut: null }));
  assert.deepEqual(e.at({ airOut: 3 }), { foe: 3 });
  assert.ok(FOES.airship.air && !FOES.airship.boss && !Object.values(WAVE_TYPES).some(T => T.mix.airship), 'it comes by airEvery, never in a mix');
  assert.equal(TOWNS.mesa.board.sky.entrance.kind, 'cloud');
  assert.deepEqual(mapRules(), []);
  // seen red: a sky lane with no entrance fails the map rules
  const B = TOWNS.mesa.board;
  const towns = { ...TOWNS, mesa: { ...TOWNS.mesa, board: { ...B, sky: { ...B.sky, entrance: null } } } };
  assert.ok(mapRules(towns).some(p => /mesa: the sky has no entrance/.test(p)));
});
