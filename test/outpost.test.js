// Outposts (GDD.md, Outposts): the game starts in Dry Creek Outpost, winning wave 10 opens Copper Gulch, and the won
// outpost keeps working on its own and feeds the town in play.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, loadGame } from '../src/core/setup.js';
import { encode, decode, migrate, SAVE_VERSION } from '../src/core/save.js';
import { build, unlocked, output } from '../src/core/economy.js';
import { buildTower, upgradeTower, towerCost, towerIn, pitSpots, setHold, RAID_LOSS } from '../src/core/defense.js';
import { winOutpost, isOutpost } from '../src/core/outpost.js';
import { signCharter } from '../src/core/charter.js';
import { mapRules } from '../tools/audit.js';
import { TOWNS } from '../src/data/towns/index.js';
import { FOES } from '../src/data/foes.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.step(.25); };
/* Dry Creek with a Crossbow on every pad, raised to level 4. */
function fortify(g, t) {
  t.coins = 1e7; t.goods.stone = 1e5; t.sell.stone = false;
  for (let i = 0; i < t.def.board.spots.length; i++) { assert.ok(buildTower(g, t, i, 'crossbow')); for (let L = 1; L < 7; L++) assert.ok(upgradeTower(g, t, i, 'a')); } // strong enough to kill the bandit wagon (boss waves are gates)
}

test('a new game starts in Dry Creek Outpost with a Stone Camp, and the Gulch is not open yet', () => {
  const g = newGame('o1'), t = g.town;
  assert.equal(g.active, 'drycreek');
  assert.ok(isOutpost(t));
  assert.equal(t.won, false);
  assert.deepEqual(Object.keys(g.towns), ['drycreek']);
  assert.equal(t.level('quarry'), 1);
  assert.equal(t.coins, TOWNS.drycreek.start.coins);
});

test('the outpost chain: the Stone Camp cuts stone, the Copper Camp opens at Stone Camp level 2 and digs copper ore', () => {
  const g = newGame('o2'), t = g.town;
  t.coins = 1000;
  assert.equal(unlocked(t, 'dmine'), false);
  assert.ok(build(g, t, 'quarry'));
  assert.equal(unlocked(t, 'dmine'), true);
  assert.ok(build(g, t, 'dmine'));
  t.sell = { stone: false, ore: false };
  run(g, 10);
  assert.ok(t.goods.stone > 10 && t.goods.ore > 3, JSON.stringify(t.goods));
  assert.ok(output(t, 'dmine') > 0);
});

test('only the Crossbow, paid with coins and stone, and no mortar pits', () => {
  const g = newGame('o3'), t = g.town;
  t.coins = 1e4; t.goods.stone = 100;
  assert.deepEqual(towerCost(t, 'crossbow', 0).goods, { stone: 6 });
  for (const k of ['cannon', 'frost', 'still', 'mortar']) { assert.equal(towerIn(t, k), false, k); assert.equal(buildTower(g, t, 0, k), false, k); }
  assert.ok(buildTower(g, t, 0, 'crossbow'));
  assert.deepEqual(pitSpots(t), []);
  assert.deepEqual(mapRules({ drycreek: TOWNS.drycreek }, ['drycreek']), []);
  const noLoop = { x: { kind: 'outpost', board: { ...TOWNS.drycreek.board, road: TOWNS.drycreek.board.road.slice(0, 4) } } };
  assert.ok(mapRules(noLoop, ['x']).some(p => /does not loop/.test(p)));
});

test('wave 10 brings the bandit wagon, and clearing it wins the outpost and opens Copper Gulch', () => {
  const g = newGame('o4'), t = g.town, ev = g.bus.record();
  fortify(g, t);
  t.wave = 10; t.waves.timer = 0;
  run(g, 1);
  assert.ok(t.waves.queue.includes('bandits') || t.waves.foes.some(f => f.kind === 'bandits'), 'the bandit wagon rides');
  assert.ok(FOES.bandits.boss && FOES.bandits.hp < FOES.wagon.hp, 'a smaller boss than the war wagon');
  for (let i = 0; i < 600 && !t.won; i++) g.step(.25);
  assert.equal(t.won, true);
  assert.ok(ev.some(([n, e]) => n === 'outpost:won' && e.town === 'drycreek' && e.opens === 'gulch'));
  assert.ok(ev.some(([n, e]) => n === 'town:open' && e.town === 'gulch'));
  assert.ok(g.towns.gulch, 'the Gulch is open');
  assert.equal(g.active, 'drycreek', 'the player stays until they go');
  assert.ok(g.go('gulch'));
  assert.equal(g.town.id, 'gulch');
});

test('once won, the outpost fights light raids every 2 minutes at wave-10 strength, with no boss', () => {
  const g = newGame('o5'), t = g.town, ev = g.bus.record();
  fortify(g, t);
  winOutpost(g, t);
  g.go('gulch');
  run(g, 400);
  const starts = ev.filter(([n, e]) => n === 'wave:start' && e.town === 'drycreek').map(([, e]) => e);
  assert.ok(starts.length >= 3 && starts.length <= 4, 'about one raid every 2 minutes: ' + starts.length);
  assert.ok(starts.every(e => e.wave === 10 && !e.boss));
  assert.equal(t.wave, 10);
  assert.equal(t.bestWave, 10);
});

test('a breach in a won outpost takes part of its stockpile and never drops its waves back', () => {
  const g = newGame('o6'), t = g.town, ev = g.bus.record();
  winOutpost(g, t); g.go('gulch');
  t.towers = []; t.coins = 500; t.goods.stone = 100; t.sell.stone = false;
  t.waves.timer = 0;
  for (let i = 0; i < 2000 && !ev.some(([n]) => n === 'breach'); i++) g.step(.25);
  const b = ev.find(([n]) => n === 'breach');
  assert.ok(b, 'raiders broke in');
  assert.equal(t.wave, 10);
  assert.ok(t.coins >= 500, 'coins are not taken');
  assert.ok(b[1].goods.stone > 0 && Math.abs(b[1].goods.stone - b[1].goods.stone / RAID_LOSS * RAID_LOSS) < 1e-9);
  assert.ok(t.goods.stone < 100);
  assert.equal(t.waves.phase, 'break');
});

test('the Gulch draws copper ore from Dry Creek before the market, and the outpost sells the rest into the purse', () => {
  const g = newGame('o7'), d = g.town, ev = g.bus.record();
  d.buildings.dmine = 8; d.buildings.quarry = 8;
  winOutpost(g, d);
  setHold(g, d, true); d.waves.timer = 999;           // no raids in this test
  const gu = g.towns.gulch;
  g.go('gulch');
  setHold(g, gu, true); gu.waves.timer = 999;
  Object.assign(gu.buildings, { camp: 10, mine: 0, smelter: 3 }); // a Smelter and no mine of its own
  const dLife = d.lifetime;
  run(g, 20);
  assert.ok(gu.drawn.ore > 5, 'the Smelter drew ore: ' + gu.drawn.ore);
  assert.ok((gu.made.copper || 0) > 1, 'and made copper with it');
  assert.ok(gu.flags['drew:drycreek']);
  assert.ok(ev.some(([n, e]) => n === 'outpost:draw' && e.town === 'gulch' && e.from === 'drycreek'));
  assert.ok(d.lifetime > dLife + 20 && (d.tally['sale:stone'] || 0) > 0, 'the outpost earns for the stone and the ore no town needs');
  assert.equal(gu.fromOutposts, 0, 'nothing is counted as the Gulch\'s');
  assert.ok(d.goods.stone <= (d.keep.stone || 0) + 1 && d.goods.ore < 1, 'the outpost keeps only its tower stone');
});

test('while the outpost is in play it sells for itself', () => {
  const g = newGame('o8'), t = g.town;
  setHold(g, t, true);
  const c0 = t.coins;
  run(g, 60); // past the stone kept for its towers
  assert.ok(t.coins > c0 + 5);
});

test('outposts have no charter', () => {
  const g = newGame('o9'), t = g.town;
  t.lifetime = 1e9; t.bestWave = 100;
  run(g, 1);
  assert.equal(g.shared.charter.offered, false);
  assert.equal(signCharter(g, t), 0);
});

test('save v8: a game already in Copper Gulch gets Dry Creek won and running', () => {
  const g = newGame('o10', 'gulch'); g.town.coins = 321;
  const old = JSON.parse(encode(g, 5)); old.v = 7; delete old.game.shared.grant;
  const s = migrate(old);
  assert.equal(s.v, SAVE_VERSION);
  assert.ok(SAVE_VERSION >= 8);
  const back = loadGame(s.game), d = back.towns.drycreek;
  assert.equal(back.active, 'gulch');
  assert.equal(back.town.coins, 321);
  assert.ok(d && d.won);
  assert.equal(d.level('quarry'), 5); assert.equal(d.level('dmine'), 5);
  assert.equal(d.towers.length, 2);
  assert.ok(d.towers.every(x => x.kind === 'crossbow'));
  assert.equal(d.wave, 10);
  assert.equal(back.shared.grant, undefined);
  // it stays granted once (a second load does not add more)
  const again = loadGame(decode(encode(back, 6)).game);
  assert.equal(again.towns.drycreek.towers.length, 2);
  // a new game saves and loads in Dry Creek, not yet won, without the Gulch
  const n = loadGame(decode(encode(newGame('o11'), 0)).game);
  assert.equal(n.active, 'drycreek'); assert.equal(n.towns.drycreek.won, false); assert.equal(n.towns.gulch, undefined);
});
