// Poison eats armor (M6a, the Still late in the game): a raider carrying the Still's poison or Slow Rot loses
// EATS_ARMOR.share of its armor against every tower's hits, and the damage
// breakdown counts what that adds for the Still.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { fight, roadOf, eaten, towerStats } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { EATS_ARMOR } from '../src/data/towers.js';
import { FOES } from '../src/data/foes.js';
import { worth } from '../tools/balance.js';

const hold = t => Object.assign(t.waves, { phase: 'wave', timer: 999, hold: true, foes: [], queue: [], shells: [], fires: [] });
const tower = (t, spot, kind, level = 1) => { const x = { spot, kind, level, path: null, fork: null, cd: 0, spent: 0, pulses: 0 }; t.towers.push(x); return x; };
/* The road distance nearest a pad, so a raider set there stands in the tower's reach. */
const nearest = (t, spot) => { const r = roadOf(t), p = t.def.board.spots[spot]; let best = 0, bd = 1e9; for (let s = 0; s <= r.length; s += .05) { const d = dist(p, pointAt(r, s)); if (d < bd) { bd = d; best = s; } } return best; };
const brute = (t, s, extra = {}) => ({ id: 1, kind: 'brute', lane: 0, hp: 1e9, max: 1e9, s, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, rot: 0, eat: 0, brittle: 0, ...extra });
/* One Crossbow shot at a frozen Brute: the health it lost and the breakdown. */
function shot(extra) {
  const g = newGame('eat', 'gulch'), t = g.town; t.towers = []; hold(t);
  tower(t, 0, 'crossbow');
  const f = brute(t, nearest(t, 0), extra); t.waves.foes = [f];
  g.dealt = {};
  fight(g, t, .25);
  return { lost: 1e9 - f.hp, dealt: g.dealt[t.id] || {} };
}

test('a poisoned raider loses part of its armor against every hit', () => {
  const E = .3, plain = shot({}), sick = shot({ poison: 0, poisonT: 99, eat: E }), rot = shot({ rot: 1e-9, eat: E }), worn = shot({ poisonT: 0, eat: E });
  const A = FOES.brute.armor;
  assert.ok(A > 0);
  assert.ok(plain.lost > 0);
  const want = (1 - A * (1 - E)) / (1 - A);
  assert.ok(Math.abs(sick.lost / plain.lost - want) < 1e-6, `poisoned ${sick.lost} against ${plain.lost}`);
  assert.ok(Math.abs(rot.lost / plain.lost - want) < 1e-3, 'Slow Rot eats armor too');
  assert.ok(Math.abs(worn.lost - plain.lost) < 1e-9, 'worn-off poison eats nothing');
  assert.equal(eaten({ poisonT: 0, rot: 0, eat: .5 }), 0); assert.equal(eaten({ poisonT: 1, eat: .5 }), .5); assert.equal(eaten({ poisonT: 0, rot: 2, eat: .2 }), .2);
});

test('the breakdown gives the hit as armor would have left it to the tower, and the rest to the Still', () => {
  const plain = shot({}), sick = shot({ poison: 0, poisonT: 99, eat: .4 });
  assert.ok(Math.abs(sick.dealt.crossbow - plain.dealt.crossbow) < 1e-9, 'the Crossbow keeps its own share');
  assert.ok(Math.abs(sick.dealt.still - (sick.lost - plain.lost)) < 1e-4, 'the Still gets what the eaten armor added');
  assert.equal(plain.dealt.still, undefined);
});

test('a raider with no armor takes the same hit, poisoned or not', () => {
  const g = newGame('eat2', 'gulch'), t = g.town; t.towers = []; hold(t); tower(t, 0, 'crossbow');
  const a = { ...brute(t, nearest(t, 0)), kind: 'raider' }, b = { ...a, id: 2, poisonT: 99, eat: .6 };
  t.waves.foes = [a]; fight(g, t, .25); const one = 1e9 - a.hp;
  t.towers[0].cd = 0; t.waves.foes = [b]; fight(g, t, .25);
  assert.ok(Math.abs((1e9 - b.hp) - one) < 1e-9);
});

test('a careful player counts the armor a Still eats for the towers around it', () => {
  const g = newGame('eat3', 'gulch'), t = g.town; t.towers = []; t.wave = 30;
  // a strong Cannon, and a Still next to it or far from it
  const spots = t.def.board.spots, c = tower(t, 0, 'cannon', 15);
  const near = spots.map((p, i) => [i, dist(p, spots[0])]).filter(([i]) => i !== 0).sort((a, b) => a[1] - b[1])[0][0];
  const alone = worth(t, { kind: 'still', spot: near, level: 15, path: 'a' });
  t.towers = []; const lone = worth(t, { kind: 'still', spot: near, level: 15, path: 'a' });
  t.towers = [c];
  assert.ok(alone > lone * 1.01, `a level 15 Still by a level 15 Cannon is worth more (${alone.toFixed(1)} against ${lone.toFixed(1)})`);
});

test('every Still from its level eats the same share of armor, and a raider keeps the strongest dose it carries', () => {
  assert.ok(EATS_ARMOR.share > 0 && EATS_ARMOR.share <= 1);
  const g = newGame('eat4', 'gulch'), t = g.town; t.towers = []; hold(t);
  const lo = tower(t, 0, 'still', EATS_ARMOR.from), hi = { spot: 1, kind: 'still', level: 15, path: 'a', fork: null };
  assert.equal(towerStats(t, lo).eat, EATS_ARMOR.share); assert.equal(towerStats(t, hi).eat, EATS_ARMOR.share);
  assert.equal(towerStats(t, { spot: 3, kind: 'still', level: EATS_ARMOR.from - 1, path: 'a' }).eat, 0, 'not before its level');
  assert.equal(towerStats(t, { spot: 2, kind: 'crossbow', level: 9, path: 'a' }).eat, 0);
  // a raider already carrying a stronger dose keeps it when a weaker Still poisons it
  const f = brute(t, nearest(t, 0), { poisonT: 3, eat: .9 }); t.waves.foes = [f];
  fight(g, t, .25);
  assert.equal(f.eat, .9);
  const f2 = brute(t, nearest(t, 0), { id: 2 }); lo.path = 'a'; lo.cd = 0; t.waves.foes = [f2];
  fight(g, t, .25);
  assert.equal(f2.eat, EATS_ARMOR.share, 'a fresh raider takes the share of that Still');
});
