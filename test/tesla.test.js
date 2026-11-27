// The Tesla Coil (PLAN.md M6b, part 2a): Thunder Mesa's own tower, a spark that jumps from raider to raider, and the only
// kind so far that reaches the sky. Air raiders come in part 2b; these tests use a stand-in air raider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { fight, towerStats, towerIn, towerOpen, buildTower, sparked, canHit, defense } from '../src/core/defense.js';
import { TOWERS, PATHS, ARC } from '../src/data/towers.js';
import { FOES } from '../src/data/foes.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { explainTower } from '../src/core/explain.js';
import { TOWNS } from '../src/data/towns/index.js';

const foe = (id, s, extra = {}) => ({ id, kind: 'raider', lane: 0, hp: 1e9, max: 1e9, s, slow: 0, slowT: 0, frozenT: 1e9, poison: 0, poisonT: 0, rot: 0, brittle: 0, eat: 0, ...extra });
const straight = (t, pads) => { t.def = { ...t.def, board: { ...t.def.board, road: [[0, 0], [60, 0]], vault: [61, 0], spots: pads, pits: [], river: null } }; t.vault = { hp: 1e15, max: 1e15 }; };
const tower = (t, spot, kind, level = 6, path = 'a') => { const x = { spot, kind, level, path: level >= 5 ? path : null, fork: null, cd: 0, spent: 0, pulses: 0 }; t.towers.push(x); return x; };
const battle = (t, foes) => Object.assign(t.waves, { phase: 'wave', timer: 1e9, queue: [], foes, shells: [], fires: [], hold: false, age: 0 });
const bus = () => { const ev = []; return { ev, bus: { emit: (n, e) => ev.push([n, e]), on: () => () => {} } }; };

test('only a tower that reaches the sky hits an air raider, and no blast, cloud or fire on the road reaches it', () => {
  FOES.testship = { name: 'Test airship', hp: 1, speed: 0, bounty: 1, leak: 1, armor: 0, from: 1, air: true };
  try {
    for (const kind of ['crossbow', 'cannon', 'frost', 'still', 'mortar', 'tesla']) {
      const g = newGame('air' + kind, 'gulch'), t = g.town; t.id = kind === 'tesla' ? 'mesa' : t.id;
      straight(t, [[5, 1.2]]); t.towers = []; tower(t, 0, kind, 8);
      // the Mortar fires only past its dead zone, so its targets sit farther off; the ship is nearest the vault, so a
      // tower that aims at the first raider would aim at it
      const at = kind === 'mortar' ? 9 : 5, ship = foe(1, at + .2, { kind: 'testship' }), walker = foe(2, at);
      battle(t, [ship, walker]);
      const { bus: b } = bus(); g.bus = { ...g.bus, emit: b.emit };
      for (let i = 0; i < 40; i++) fight(g, t, .25);
      if (TOWERS[kind].air) assert.ok(ship.hp < 1e9, kind + ' hits the air raider');
      else assert.equal(ship.hp, 1e9, kind + ' never hits the air raider');
      assert.ok(walker.hp < 1e9, kind + ' still hits the raider on the road');
    }
    // the rule itself, one function the battle and the spark share
    assert.equal(canHit({ air: false }, { kind: 'testship' }), false);
    assert.equal(canHit({ air: true }, { kind: 'testship' }), true);
    assert.equal(canHit({ air: false }, { kind: 'raider' }), true);
  } finally { delete FOES.testship; }
  // only the Tesla Coil reaches the sky so far; the Mortar lobs and never will
  assert.deepEqual(Object.keys(TOWERS).filter(k => TOWERS[k].air), ['tesla']);
  assert.ok(TOWERS.mortar.lob && !TOWERS.mortar.air);
});

test('the spark jumps to the nearest raiders it has not hit, each jump softer, up to its jumps', () => {
  const pos = new Map(), fs = [];
  const add = (id, x) => { const f = foe(id, 0); pos.set(f, [x, 0]); fs.push(f); return f; };
  const first = add(1, 0); add(2, 1); add(3, 2.2); add(4, 2.2 + ARC.reach + .1); pos.set(add(5, 1), [1, .9]);
  assert.deepEqual(sparked(fs, pos, first, 2).map(f => f.id), [1, 2, 5], 'nearest first, from the last one hit');
  assert.deepEqual(sparked(fs, pos, first, 5).map(f => f.id), [1, 2, 5], 'it stops where no raider is in reach of the last');
  assert.deepEqual(sparked(fs, pos, first, 0).map(f => f.id), [1]);
  // in the battle: three raiders bunched, the first hit full, the next fall times it, then fall squared
  const g = newGame('arc', 'gulch'), t = g.town; t.id = 'mesa';
  straight(t, [[30, 1.5]]); t.towers = []; const x = tower(t, 0, 'tesla', 3);
  const a = foe(1, 30.6), b = foe(2, 30), c = foe(3, 29.4); battle(t, [a, b, c]);
  fight(g, t, .25);
  const st = towerStats(t, x), lost = f => 1e9 - f.hp;
  assert.ok(Math.abs(lost(a) - st.dmg) < 1e-6, 'the first, nearest the vault');
  assert.ok(st.fall > 0 && st.fall < 1);
  assert.ok(Math.abs(lost(b) - st.dmg * st.fall) < 1e-6 && Math.abs(lost(c) - st.dmg * st.fall ** 2) < 1e-6, 'each jump softer');
});

test('Storm Coil jumps farther down the line, Lightning Rod hits one raider much harder and never jumps', () => {
  const g = newGame('paths', 'gulch'), t = g.town; t.id = 'mesa';
  const none = towerStats(t, { kind: 'tesla', level: 4, path: null }), a = towerStats(t, { kind: 'tesla', level: 5, path: 'a' }), b = towerStats(t, { kind: 'tesla', level: 5, path: 'b' });
  assert.equal(none.arcs, TOWERS.tesla.arcs); assert.equal(a.arcs, PATHS.tesla.a.arcs); assert.equal(b.arcs, 0);
  assert.ok(a.arcs > none.arcs && a.dmg < b.dmg && b.range > a.range);
  assert.ok(none.air && a.air && b.air, 'every Tesla reaches the sky');
  // the card's rows name the path
  const ex = explainTower(t, { kind: 'tesla', level: 5, path: 'b', fork: null });
  assert.ok(ex.dmg.rows.some(r => r.label === PATHS.tesla.b.name));
});

test('the Tesla Coil is built only in Thunder Mesa, opens at its wave, and has its card', () => {
  for (const [id, T] of Object.entries(TOWNS)) {
    const g = newGame('in' + id, 'gulch'), t = g.towns.gulch;
    const fake = { ...t, id, def: T };
    assert.equal(towerIn(fake, 'tesla'), id === 'mesa', id);
  }
  // every other kind stays where it was: every town builds each kind it has a price for
  for (const [id, T] of Object.entries(TOWNS)) for (const k of Object.keys(TOWERS)) if (k !== 'tesla' && (!T.towers || T.towers.includes(k))) assert.ok(!!TOWERS[k].goods[id], id + ' ' + k + ' has a price');
  const g = newGame('opens', 'gulch'); const m = g.addTown('mesa'); m.coins = 1e12; g.shared.purse.coins = 1e12;
  for (const k of Object.keys(m.goods)) m.goods[k] = 1e9; m.goods.aluminum = 1e9; m.goods.rubber = 1e9;
  assert.equal(towerOpen(m, 'tesla'), false);
  assert.equal(buildTower(g, m, 0, 'tesla'), false, 'not before its wave');
  m.wave = TOWERS.tesla.opens; defense.opens(g, m);
  assert.ok(towerOpen(m, 'tesla') && buildTower(g, m, 0, 'tesla'));
  // the Gulch reaching that wave opens no Tesla there
  const gl = g.towns.gulch; gl.wave = 30; defense.opens(g, gl); assert.ok(!gl.flags['open:tesla']);
  const e = EXPLAINERS.find(x => (x.covers || []).includes('tower:tesla'));
  assert.ok(e && e.town === 'mesa' && /airships/.test(e.text) && !/[;:]/.test(e.text));
});

test('a line that says to build a building picks a or an', async () => {
  const { aName } = await import('../src/data/buildings.js');
  assert.equal(aName('Aluminum Works'), 'an Aluminum Works');
  assert.equal(aName('Oil Derrick'), 'an Oil Derrick');
  assert.equal(aName('Kiln'), 'a Kiln');
});
