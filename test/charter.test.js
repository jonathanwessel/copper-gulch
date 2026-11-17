// Charters, deeds and perks: the deed formula, the offer, signing (the town starts over, deeds and the explainers seen
// stay), the deeds' income bonus as a named source in every town, perk pairs (one side, enough deeds, cleared at the
// next charter), the tower cost perks, and save v6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { DEEDS, PERKS } from '../src/data/perks.js';
import { deedParts, deedsFor, nextDeed, signCharter, pickPerk, perkState, perksToPick, deedsHeld, charterOffered } from '../src/core/charter.js';
import { buildTower, towerCost } from '../src/core/defense.js';
import { quote } from '../src/core/market.js';
import { output } from '../src/core/economy.js';
import { migrate, encode, decode, SAVE_VERSION } from '../src/core/save.js';

const ready = (seed = 'c') => { const g = newGame(seed, 'gulch'), t = g.town; Object.assign(t.waves, { hold: true, timer: 0 }); return { g, t }; };

test('deeds come from the best wave and the coins earned in this charter', () => {
  const { t } = ready();
  assert.equal(deedsFor(t), 0);
  t.bestWave = DEEDS.wave - 1; t.lifetime = DEEDS.coins - 1;
  assert.deepEqual(deedParts(t), { wave: 0, coins: 0, total: 0 });
  t.bestWave = DEEDS.wave; assert.equal(deedParts(t).wave, 1);
  t.bestWave = DEEDS.wave + DEEDS.waveStep - 1; assert.equal(deedParts(t).wave, 1);
  t.bestWave = DEEDS.wave + 2 * DEEDS.waveStep; assert.equal(deedParts(t).wave, 3);
  t.lifetime = DEEDS.coins; assert.equal(deedParts(t).coins, 1);
  t.lifetime = DEEDS.coins * DEEDS.coinStep * .99; assert.equal(deedParts(t).coins, 1);
  t.lifetime = DEEDS.coins * DEEDS.coinStep; assert.equal(deedParts(t).coins, 2);
  t.lifetime = DEEDS.coins * DEEDS.coinStep ** 2; assert.equal(deedParts(t).coins, 3);
  assert.equal(deedsFor(t), 6);
  assert.deepEqual(nextDeed(t), { wave: DEEDS.wave + 3 * DEEDS.waveStep, coins: DEEDS.coins * DEEDS.coinStep ** 3 });
});

test('the charter is offered once it would pay a deed, and stays offered', () => {
  const { g, t } = ready('c2'), ev = g.bus.record();
  g.step(.25); assert.equal(charterOffered(g), false);
  t.lifetime = DEEDS.coins; g.step(.25);
  assert.equal(charterOffered(g), true);
  assert.ok(ev.some(([n, d]) => n === 'charter:offer' && d.deeds === 1));
  signCharter(g, t); g.step(.25);
  assert.equal(charterOffered(g), true, 'the Perks button stays after the town starts over');
  assert.equal(ev.filter(([n]) => n === 'charter:offer').length, 1);
});

test('signing pays the deeds and starts the town over, keeping the explainers seen', () => {
  const { g, t } = ready('c3');
  assert.equal(signCharter(g, t), 0, 'nothing to sign yet');
  Object.assign(t, { coins: 5e4, bestWave: DEEDS.wave + DEEDS.waveStep, lifetime: DEEDS.coins, wave: 31 });
  t.buildings.saw = 12; t.buildings.camp = 20; t.research.saws = 3; t.foremen.camp = true; t.flags['open:research'] = true; t.flags['open:mortar'] = true;
  t.coins = 1e6; buildTower(g, t, 0, 'crossbow'); t.coins = 5e4;
  g.shared.seen = { welcome: true };
  const rng = t.rng.state, tm = t.t, ev = g.bus.record();
  assert.equal(signCharter(g, t), 3);
  assert.equal(g.town, t, 'the same town object (the screen keeps its reference)');
  assert.equal(deedsHeld(g), 3); assert.equal(g.shared.charter.signed, 1);
  assert.deepEqual(g.shared.charter.last, { town: 'gulch', deeds: 3, wave: DEEDS.wave + DEEDS.waveStep, coins: DEEDS.coins });
  assert.equal(t.coins, 5e4, 'the shared purse is kept');
  assert.deepEqual(t.buildings, t.def.start.buildings);
  assert.deepEqual(t.towers, []); assert.equal(t.wave, 1); assert.equal(t.bestWave, 0); assert.equal(t.lifetime, 0);
  assert.deepEqual(t.research, {}); assert.equal(t.lab, null); assert.deepEqual(t.foremen, {});
  assert.ok(!t.flags['open:research'] && !t.flags['open:mortar']);
  assert.equal(t.waves.phase, 'break'); assert.equal(t.charters, 1);
  assert.equal(t.mods.factor('prod:saw'), 1, 'research bonuses are gone');
  assert.deepEqual(g.shared.seen, { welcome: true });
  assert.deepEqual(t.rng.state, rng, 'the random stream carries on'); assert.equal(t.t, tm);
  assert.ok(ev.some(([n, d]) => n === 'charter:sign' && d.deeds === 3));
  assert.equal(deedsFor(t), 0);
});

test('each deed adds its share to the coins earned, as a named source, in every town', () => {
  const { g, t } = ready('c4');
  t.goods.timber = 100;
  const before = quote(g, t, 'timber', 10);
  t.lifetime = DEEDS.coins * DEEDS.coinStep; signCharter(g, t); // 2 deeds
  t.goods.timber = 100;
  const e = t.mods.explain('income');
  assert.deepEqual(e.parts.map(p => [p.source, p.mul]), [['Deeds', 1 + 2 * DEEDS.income]]);
  assert.ok(Math.abs(quote(g, t, 'timber', 10) / before - (1 + 2 * DEEDS.income)) < 1e-9);
  // a town opened later gets the deeds too
  g.defs.other = { ...t.def, id: 'other', start: { coins: 0, buildings: {} } };
  const o = g.addTown('other');
  assert.equal(o.mods.factor('income'), 1 + 2 * DEEDS.income);
});

test('perk pairs: one side, only with enough deeds, cleared by the next charter', () => {
  const { g, t } = ready('c5');
  const [first, second] = PERKS;
  assert.equal(perkState(g, first.id), 'locked');
  assert.equal(pickPerk(g, first.id, 'a'), false);
  t.lifetime = DEEDS.coins; signCharter(g, t); // 1 deed
  assert.equal(perkState(g, first.id), first.need <= 1 ? 'open' : 'locked');
  assert.equal(perkState(g, second.id), 'locked');
  assert.equal(perksToPick(g), PERKS.filter(p => p.need <= 1).length);
  assert.equal(pickPerk(g, first.id, 'c'), false, 'only side a or b');
  const L = 3; t.buildings.camp = L;
  const plain = output(t, 'camp');
  assert.ok(pickPerk(g, first.id, 'a'));
  assert.equal(perkState(g, first.id), 'a');
  assert.equal(pickPerk(g, first.id, 'b'), false, 'the pick stays until the next charter');
  assert.ok(Math.abs(output(t, 'camp') / plain - first.a.effects[0].mul) < 1e-9);
  assert.ok(t.mods.explain('prod').parts.some(p => p.source === first.a.name + ' perk'));
  t.lifetime = DEEDS.coins; signCharter(g, t); // 2 deeds held
  assert.equal(perkState(g, first.id), 'open', 'cleared: pick again');
  assert.equal(t.mods.explain('prod').parts.length, 0, 'the old pick no longer counts');
  assert.equal(perkState(g, second.id), 'open');
  assert.ok(pickPerk(g, first.id, 'b'));
  assert.ok(Math.abs(t.mods.factor('towerDmg') - first.b.effects[0].mul) < 1e-9);
});

test('Big Guns makes upgrades cheaper and Many Hands makes new towers cheaper', () => {
  const { g, t } = ready('c6');
  const build = towerCost(t, 'crossbow', 0).coins, up = towerCost(t, 'crossbow', 2).coins;
  g.shared.charter.deeds = 2;
  pickPerk(g, 'guns', 'a');
  assert.equal(towerCost(t, 'crossbow', 0).coins, build);
  assert.ok(towerCost(t, 'crossbow', 2).coins < up * .75);
  g.shared.charter.perks = {}; pickPerk(g, 'guns', 'b');
  assert.ok(towerCost(t, 'crossbow', 0).coins < build * .65);
  assert.equal(towerCost(t, 'crossbow', 2).coins, up);
});

test('every perk side has a name, a short line and effects on stats with caps', () => {
  const names = new Set();
  for (const p of PERKS) for (const s of ['a', 'b']) {
    const x = p[s];
    assert.ok(x.name && x.about && x.effects.length, p.id + s);
    assert.ok(!names.has(x.name), 'names are never reused'); names.add(x.name);
    const { t } = ready('c7');
    for (const e of x.effects) t.mods.check(e.stat);
  }
  assert.ok(PERKS.every((p, i) => i === 0 || p.need >= PERKS[i - 1].need), 'pairs open in order');
});

test('save v6: deeds, picks and the offer survive a save, and an older save gets an empty charter', () => {
  assert.ok(SAVE_VERSION >= 6);
  const { g, t } = ready('c8');
  t.lifetime = DEEDS.coins; g.step(.25); signCharter(g, t); pickPerk(g, 'trade', 'b');
  const back = loadGame(decode(encode(g, 0)).game);
  assert.deepEqual(back.shared.charter.perks, { trade: 'b' });
  assert.equal(deedsHeld(back), 1); assert.equal(charterOffered(back), true);
  assert.equal(back.town.mods.factor('income'), 1 + DEEDS.income);
  assert.equal(back.town.charters, 1);
  const old = migrate({ v: 5, at: 0, game: { shared: { seen: {} }, towns: {} } });
  assert.equal(old.v, SAVE_VERSION);
  assert.deepEqual(old.game.shared.charter, { deeds: 0, signed: 0, offered: false, perks: {}, last: null });
});
