// The raider card (owner, 2026-11-22: "Can I click on a mob to see the current buffs and debuffs? Like poison, frozen,
// shield strength?"). Every value on it comes from one core function, foeStatus, which the bots count with too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foeStatus, bountyOf, roadOf, towerStats } from '../src/core/defense.js';
import { pointAt, dist } from '../src/core/path.js';
import { POISON_SECONDS } from '../src/data/towers.js';
import { FOES } from '../src/data/foes.js';
import { foeView, foeLines, EFFECT_WORDS, fxLeft } from '../src/ui/foe.js';
import { textIssues } from '../tools/audit.js';

const raider = (o = {}) => ({ id: 7, kind: 'brute', lane: 0, hp: 50, max: 80, s: 6, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, rot: 0, eat: 0, brittle: 0, ...o });
function town(seed = 'foe1') {
  const g = newGame(seed, 'gulch'), t = g.town;
  t.wave = 8;
  Object.assign(t.waves, { phase: 'wave', queue: [], hold: true, foes: [], fires: [], shells: [] });
  return { g, t };
}

test('a raider with nothing on it: health, armor at full, no effects, what it pays', () => {
  const { t } = town(), f = raider();
  t.waves.foes.push(f);
  const st = foeStatus(t, f);
  assert.equal(st.hp, 50); assert.equal(st.max, 80);
  assert.equal(st.armorFull, FOES.brute.armor); assert.equal(st.armor, FOES.brute.armor); assert.equal(st.eaten, 0);
  assert.deepEqual(st.effects, []);
  assert.equal(st.gone, null);
  assert.ok(Math.abs(st.worth - bountyOf(t, 'brute')) < 1e-9 && st.worth > 0);
});

test('every effect shows while it lasts, in the card order, with its seconds left', () => {
  const { t } = town(), f = raider({ frozenT: .5, poisonT: 2.5, poison: 3, rot: 1, spread: true, slowT: 1.5, slow: .3, brittle: .2, eat: .5 });
  t.waves.foes.push(f);
  t.waves.fires.push({ at: pointAt(roadOf(t), f.s), r: 1, t: 2, dps: 1 });
  const st = foeStatus(t, f);
  assert.deepEqual(st.effects.map(e => e.key), ['frozen', 'poison', 'rot', 'spread', 'fire', 'slow', 'brittle']);
  const left = Object.fromEntries(st.effects.map(e => [e.key, e.left]));
  assert.equal(left.frozen, .5); assert.equal(left.poison, 2.5); assert.equal(left.rot, null); assert.equal(left.fire, 2); assert.equal(left.slow, 1.5); assert.equal(left.brittle, 1.5);
  // poison eats half its armor while it carries poison
  assert.ok(Math.abs(st.armor - FOES.brute.armor * .5) < 1e-9); assert.equal(st.eaten, .5);
  // when the effects run out they leave the card, and the armor comes back
  Object.assign(f, { frozenT: 0, poisonT: -.1, rot: 0, slowT: -.1 }); t.waves.fires.length = 0;
  const after = foeStatus(t, f);
  assert.deepEqual(after.effects, []); assert.equal(after.armor, FOES.brute.armor);
});

test('fire counts only where the burning ground is, and brittle only while slowed', () => {
  const { t } = town(), f = raider({ brittle: .3 });
  t.waves.foes.push(f);
  const at = pointAt(roadOf(t), f.s);
  t.waves.fires.push({ at: [at[0] + 3, at[1] + 3], r: 1, t: 2, dps: 1 });
  assert.deepEqual(foeStatus(t, f).effects, []);
});

test('a raider that fell or got through says so, with nothing left on it', () => {
  const { t } = town();
  assert.equal(foeStatus(t, raider({ hp: 0, poisonT: 2 })).gone, 'down');
  assert.deepEqual(foeStatus(t, raider({ hp: 0, poisonT: 2 })).effects, []);
  assert.equal(foeStatus(t, raider({ hp: 0, poisonT: 2, eat: .5 })).eaten, 0);
  assert.equal(foeStatus(t, raider({ hp: 0, leaked: true })).gone, 'through');
});

test('the card says what the raider pays, the coins it really pays when it falls', () => {
  const { g, t } = town('foe2'), f = raider({ kind: 'raider', hp: 1e-6, max: 10 });
  t.waves.foes.push(f);
  const worth = foeStatus(t, f).worth;
  let paid = null; g.bus.on('kill', e => { if (e.foe === f.id) paid = e.coins; });
  f.hp = -1; g.step(.25);
  assert.ok(paid !== null && Math.abs(paid - worth) < 1e-9, 'paid ' + paid + ', card ' + worth);
});

test('a Still on the road poisons a raider, and the card shows it with its time left', () => {
  const { g, t } = town('foe3');
  const road = roadOf(t), spots = t.def.board.spots;
  // the pad nearest the road's middle, and a raider walking past it with health to spare
  let best = 0, bd = Infinity; const mid = pointAt(road, road.length / 2);
  spots.forEach((p, i) => { const d = dist(p, mid); if (d < bd) { bd = d; best = i; } });
  t.towers.push({ spot: best, kind: 'still', level: 3, path: null, fork: null, cd: 0, spent: 0, pulses: 0 }); // placed by hand, as the fork tests do
  const range = towerStats(t, t.towers[0]).range;
  let s0 = 0, near = Infinity; for (let s = 0; s < road.length; s += .25) { const d = dist(spots[best], pointAt(road, s)); if (d < near) { near = d; s0 = s; } }
  assert.ok(near < range, 'the road passes in reach');
  const f = raider({ kind: 'raider', hp: 1e9, max: 1e9, s: s0 });
  t.waves.foes.push(f);
  let st = null;
  for (let i = 0; i < 40 && !(st && st.effects.some(e => e.key === 'poison')); i++) { g.step(.25); st = foeStatus(t, f); }
  const p = st.effects.find(e => e.key === 'poison');
  assert.ok(p, 'poisoned: ' + JSON.stringify(st.effects));
  assert.ok(p.left > 0 && p.left <= POISON_SECONDS + 1e-9);
  assert.ok(st.hp < 1e9, 'the poison hurt it');
});

test('the card words: plain lines, health as have / most, fixed short cells', () => {
  const { t } = town(), f = raider({ poisonT: 2.2, eat: .5, rot: 1, slowT: 1, slow: .3 });
  t.waves.foes.push(f);
  const v = foeView(t, f);
  assert.equal(v.health.text, '50 / 80');
  assert.equal(v.armor.text, Math.round(FOES.brute.armor * 50) + '%, was ' + Math.round(FOES.brute.armor * 100) + '%');
  assert.equal(foeView(t, raider()).armor.text, Math.round(FOES.brute.armor * 100) + '%'); // nothing eaten: no "was"
  assert.deepEqual(v.effects.map(e => e.word), [EFFECT_WORDS.poison, EFFECT_WORDS.rot, EFFECT_WORDS.slow]);
  assert.deepEqual(v.effects.map(e => e.left), ['3s', 'No end', '1s']);
  for (const e of v.effects) assert.ok(e.left.length <= 6);
  for (const s of [0, .01, 4, 9.99, 120]) assert.ok(fxLeft(s).length <= 3, fxLeft(s));
  for (const line of foeLines(t, f)) assert.deepEqual(textIssues(line), [], line);
  for (const kind of Object.keys(FOES)) for (const line of foeLines(t, raider({ kind, hp: 0 }), 'stockpile')) assert.deepEqual(textIssues(line), [], line);
  // a raider with no armor has no armor row
  assert.equal(foeView(t, raider({ kind: 'raider' })).armor, null);
});
