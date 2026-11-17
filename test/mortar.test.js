// The Mortar and the mortar pits: it opens at wave 12, fits the far pads, has a dead zone, lobs shells that hit on
// landing with splash, cannot hit airships, and Shrapnel leaves burning ground. Every map has 3 to 5 pits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { buildTower, upgradeTower, towerStats, towerAt, roadOf, towerReserve, isPit, pitSpots, towerOpen } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { TOWERS, PATH_LEVEL, NORMAL_REACH, FIRE } from '../src/data/towers.js';
import { FOES } from '../src/data/foes.js';
import { migrate, SAVE_VERSION } from '../src/core/save.js';
import { mapRules } from '../tools/audit.js';
import { TOWNS } from '../src/data/towns/index.js';

const run = (g, sec) => { for (let i = 0; i < sec * 4; i++) g.step(.25); };
const rich = g => { const t = g.town; t.coins = 1e9; for (const k of ['timber', 'copper', 'bricks', 'tools']) t.goods[k] = 1e6; t.sell = { timber: false, copper: false, bricks: false, tools: false }; return t; };
const open = (g, t) => { t.wave = 12; Object.assign(t.waves, { phase: 'break', timer: 999, hold: true }); g.step(.25); };
/* A distance along the road whose point is between lo and hi from a spot. */
const sAt = (t, spot, lo, hi) => { const r = roadOf(t), p = t.def.board.spots[spot]; for (let s = 1; s < r.length; s += .05) { const d = dist(p, pointAt(r, s)); if (d >= lo && d <= hi) return s; } return null; };
/* Put raiders standing still on the road (frozen), mid-wave, with lots of health. */
const place = (t, list) => {
  let id = 900;
  Object.assign(t.waves, { phase: 'wave', queue: [], hold: true, foes: list.map(([kind, s]) => ({ id: id++, kind, hp: 1e6, max: 1e6, s, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, brittle: 0 })) });
};

test('the Mortar opens at wave 12, and only then can it be built or does the town keep goods for it', () => {
  const g = newGame('m1'), t = rich(g), pit = pitSpots(t)[0];
  assert.equal(towerOpen(t, 'mortar'), false);
  assert.equal(buildTower(g, t, pit, 'mortar'), false);
  t.goods = {}; assert.equal(towerReserve(t).bricks || 0, TOWERS.frost.goods.gulch.bricks);
  rich(g); const ev = g.bus.record(); open(g, t);
  assert.ok(towerOpen(t, 'mortar') && ev.some(([n, d]) => n === 'tower:open' && d.kind === 'mortar'));
  t.wave = 3; g.step(.25); assert.ok(towerOpen(t, 'mortar'), 'it stays open after falling back');
  assert.ok(buildTower(g, t, pit, 'mortar'));
  assert.ok(towerReserve(t).bricks >= TOWERS.mortar.goods.gulch.bricks);
});

test('mortar pits take only long-range towers, and the Mortar goes only in a pit', () => {
  const g = newGame('m2'), t = rich(g); open(g, t);
  const pits = pitSpots(t);
  assert.ok(pits.length >= 3 && pits.length <= 5 && pits.every(i => isPit(t, i)) && !isPit(t, 0));
  for (const k of ['crossbow', 'cannon', 'frost', 'still']) assert.equal(buildTower(g, t, pits[0], k), false, k);
  assert.ok(buildTower(g, t, pits[0], 'mortar'));
  assert.equal(buildTower(g, t, 0, 'mortar'), false);
});

test('reach: from half to twice a normal tower, and the pits sit beyond a normal tower', () => {
  const g = newGame('m3'), t = rich(g); open(g, t); buildTower(g, t, 12, 'mortar');
  const st = towerStats(t, towerAt(t, 12));
  assert.equal(st.minRange, NORMAL_REACH / 2); assert.equal(st.range, NORMAL_REACH * 2);
  const r = roadOf(t);
  for (const i of pitSpots(t)) { let min = Infinity; for (let s = 0; s <= r.length; s += .1) min = Math.min(min, dist(t.def.board.spots[i], pointAt(r, s))); assert.ok(min > NORMAL_REACH, 'pit ' + i); }
  assert.deepEqual(mapRules(), []);
});

test('the dead zone: a raider too close is never fired at, one in the ring is', () => {
  // a test board where the first pit sits inside the bottom bend, so road passes within the dead zone
  const g = newGame('m4'), t = rich(g); t.def = { ...t.def, board: { ...t.def.board, far: 6 } }; open(g, t); assert.ok(buildTower(g, t, 6, 'mortar'));
  const close = sAt(t, 6, 0, 1.2), far = sAt(t, 6, 3, 5);
  assert.ok(close !== null && far !== null);
  const ev = g.bus.record();
  place(t, [['raider', close]]); run(g, 4);
  assert.equal(ev.filter(([n, d]) => n === 'shot' && d.kind === 'mortar').length, 0);
  place(t, [['raider', far]]); run(g, 1);
  assert.ok(ev.some(([n, d]) => n === 'shot' && d.kind === 'mortar' && d.flight > 0));
});

test('a shell flies first, then hits every raider near where it lands', () => {
  const g = newGame('m5'), t = rich(g); open(g, t); buildTower(g, t, 12, 'mortar');
  const s = sAt(t, 12, 3, 5); place(t, [['raider', s], ['raider', s + .3], ['raider', s + 6]]);
  const ev = g.bus.record();
  g.step(.25);
  assert.ok(ev.some(([n]) => n === 'shot') && t.waves.shells.length === 1);
  const [a, b, c] = t.waves.foes;
  assert.equal(a.hp, 1e6, 'no damage while the shell is in the air');
  run(g, TOWERS.mortar.flight);
  assert.ok(a.hp < 1e6 && b.hp < 1e6, 'both raiders in the blast are hit');
  assert.equal(c.hp, 1e6, 'a raider far from the landing is not');
  assert.ok(ev.some(([n]) => n === 'land'));
});

test('a lobbed shell never targets an airship', () => {
  FOES.testship = { name: 'Test airship', hp: 1, speed: 1, bounty: 1, leak: 1, armor: 0, from: 99, air: true };
  try {
    const g = newGame('m6'), t = rich(g); open(g, t); buildTower(g, t, 12, 'mortar');
    const ev = g.bus.record();
    place(t, [['testship', sAt(t, 12, 3, 5)]]); run(g, 5);
    assert.equal(ev.filter(([n]) => n === 'shot').length, 0);
  } finally { delete FOES.testship; }
});

test('Shrapnel leaves burning ground that slows and hurts for a few seconds', () => {
  const g = newGame('m7'), t = rich(g); open(g, t); buildTower(g, t, 12, 'mortar');
  for (let L = 1; L < PATH_LEVEL; L++) assert.ok(upgradeTower(g, t, 12, L + 1 === PATH_LEVEL ? 'b' : undefined));
  assert.equal(towerAt(t, 12).path, 'b');
  const s = sAt(t, 12, 3, 5); place(t, [['raider', s]]);
  run(g, TOWERS.mortar.flight + .5);
  assert.ok(t.waves.fires.length >= 1);
  const f = t.waves.foes[0], hp = f.hp;
  f.frozenT = 1e9; t.towers = []; // no more shells: only the fire works now
  run(g, 1);
  assert.ok(f.hp < hp && f.slowT > 0 && f.slow >= FIRE.slow);
  run(g, FIRE.seconds + 1); assert.equal(t.waves.fires.length, 0);
});

test('the Siege Mortar reaches 2.4 times a normal tower', () => {
  const g = newGame('m8'), t = rich(g); open(g, t); buildTower(g, t, 12, 'mortar');
  for (let L = 1; L < PATH_LEVEL; L++) upgradeTower(g, t, 12, 'a');
  const st = towerStats(t, towerAt(t, 12)), base = towerStats(t, { ...towerAt(t, 12), path: null });
  assert.ok(Math.abs(st.range / base.range - 1.2) < 1e-9);
  assert.ok(Math.abs(TOWERS.mortar.range * 1.2 - NORMAL_REACH * 2.4) < 1e-9);
});

test('the map rule: a town with too few pits, or a pit too near the road, fails the audit', () => {
  const b = TOWNS.gulch.board;
  const few = { x: { board: { ...b, far: b.spots.length - 2 } } };
  assert.ok(mapRules(few, ['x']).some(p => /2 mortar pits/.test(p)));
  const near = { x: { board: { ...b, spots: [...b.spots.slice(0, -1), [2.5, 3]] } } };
  assert.ok(mapRules(near, ['x']).some(p => /within a normal tower/.test(p)));
});

test('save v3: an older save gets empty shell and fire lists', () => {
  assert.equal(SAVE_VERSION, 3);
  const s = migrate({ v: 2, at: 0, game: { towns: { gulch: { waves: { phase: 'break', foes: [] } } } } });
  assert.deepEqual([s.v, s.game.towns.gulch.waves.shells, s.game.towns.gulch.waves.fires], [3, [], []]);
});

test('damage is tallied by tower kind (the balance bot reads it)', () => {
  const g = newGame('m9'), t = rich(g); open(g, t); buildTower(g, t, 12, 'mortar'); buildTower(g, t, 0, 'crossbow');
  const s = sAt(t, 12, 3, 5); place(t, [['raider', s]]);
  run(g, TOWERS.mortar.flight + .5);
  assert.ok(g.dealt.gulch.mortar > 0);
  assert.ok(!('dealt' in g.toJSON()), 'not saved');
});
