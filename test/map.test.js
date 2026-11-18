// The empire map (GDD.md, Empire map): its sites, each town's badges, the routes it draws, and the rates its wagons
// and income badges show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { winOutpost } from '../src/core/outpost.js';
import { foundTown } from '../src/core/empire.js';
import { mapOpen, mapSites, siteInfo, lockedRules, mapRoutes, FlowMeter, wagonsFor, makesOf } from '../src/core/map.js';
import { SITES, CAPITAL } from '../src/data/empire.js';
import { TOWNS } from '../src/data/towns/index.js';

const run = (g, seconds) => { for (let i = 0; i < seconds * 4; i++) g.advance(.25); };
const empire = () => {
  const g = newGame('m1'); winOutpost(g, g.town); g.go('gulch');
  const gu = g.towns.gulch; gu.bestWave = 20; gu.coins = 1e6;
  assert.ok(foundTown(g, 'ridge')); g.go('ridge');
  return g;
};

test('every town has a place on the map, apart from the others and from the Capital', () => {
  for (const id of Object.keys(TOWNS)) assert.ok(SITES[id], id + ' has a site');
  const pts = [CAPITAL, ...Object.values(SITES)];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) > 7, 'sites ' + i + ' and ' + j + ' are apart');
});

test('the map opens with the second town and shows open towns, surveyed land and the Capital site', () => {
  const g = newGame('m0');
  assert.equal(mapOpen(g), false, 'Dry Creek alone has no map');
  winOutpost(g, g.town);
  assert.equal(mapOpen(g), true);
  const s = Object.fromEntries(mapSites(g).map(x => [x.id, x]));
  assert.equal(s.capital.capital, true);
  assert.equal(s.drycreek.open, true); assert.equal(s.drycreek.outpost, true);
  assert.equal(s.gulch.open, true);
  assert.equal(s.ridge.open, false, 'Iron Ridge is surveyed land');
  assert.equal(s.pinehollow.open, false);
});

test('a town not open yet lists what it takes, and says when it can be started', () => {
  const g = newGame('m2'); winOutpost(g, g.town);
  const gu = g.towns.gulch;
  let r = lockedRules(g, 'ridge');
  assert.deepEqual(r.rules.map(x => [x.kind, x.done]), [['wave', false], ['coins', false]]);
  assert.equal(r.ready, false);
  gu.bestWave = 20; gu.coins = TOWNS.ridge.found.coins;
  r = lockedRules(g, 'ridge');
  assert.deepEqual(r.rules.map(x => x.done), [true, true]);
  assert.equal(r.ready, true);
  assert.deepEqual(lockedRules(g, 'pinehollow').rules, [{ kind: 'with', town: 'ridge' }]);
  assert.deepEqual(lockedRules(g, 'capital').rules, [{ kind: 'later' }]);
  assert.deepEqual(lockedRules(newGame('m3'), 'gulch').rules, [{ kind: 'win', town: 'drycreek' }]);
});

test('badges show the wave, the vault and an alert when the vault is low or a workshop is short', () => {
  const g = empire(), r = g.towns.ridge;
  let b = siteInfo(g, 'ridge');
  assert.equal(b.inPlay, true); assert.equal(b.vault, 1); assert.equal(b.alert, null);
  r.wave = 7; r.vault.hp = r.vault.max * .3;
  b = siteInfo(g, 'ridge');
  assert.equal(b.wave, 7); assert.ok(Math.abs(b.vault - .3) < 1e-9); assert.equal(b.alert, 'vault');
  r.vault.hp = r.vault.max; r.buildings.furnace = 3; r.starved = { furnace: true };
  b = siteInfo(g, 'ridge');
  assert.equal(b.alert, 'short'); assert.equal(b.short, 'furnace');
  r.goods.iron = 50; r.goods.coal = 0;
  assert.equal(siteInfo(g, 'ridge').needs, 'coal', 'the input it has least of');
  assert.equal(siteInfo(g, 'drycreek').won, true);
  assert.equal(siteInfo(newGame('m4'), 'ridge'), null, 'a town not open has no badges');
});

test('routes are the links that carried goods: outposts to towns, and the Gulch to Iron Ridge', () => {
  const g = empire();
  assert.deepEqual(makesOf('drycreek').sort(), ['ore', 'stone']);
  assert.deepEqual(mapRoutes(g), [], 'nothing moved yet');
  g.towns.gulch.drawn = { ore: 12 };
  g.towns.ridge.shipped = { bricks: 5, tools: 2 };
  g.towns.ridge.drawn = { timber: 4 };
  const r = mapRoutes(g);
  assert.deepEqual(r.map(l => l.key), ['drycreek>gulch', 'gulch>ridge', 'pinehollow>ridge']);
  assert.deepEqual(r[1].goods, ['bricks', 'tools']);
  assert.equal(r[1].total, 7);
});

test('the meter turns coins earned and goods moved into rates, by simulated time', () => {
  const g = empire(), m = new FlowMeter();
  assert.equal(m.update(g), false, 'the first call only takes a baseline');
  const gu = g.towns.gulch, r = g.towns.ridge;
  const t0 = g.clock.t;
  g.clock.t = t0 + 1; assert.equal(m.update(g), false, 'too soon');
  gu.lifetime += 40; r.shipped = { bricks: 20 }; g.clock.t = t0 + 4;
  assert.equal(m.update(g), true);
  assert.ok(Math.abs(m.income.gulch - 10) < 1e-9, '40 coins in 4 seconds');
  assert.equal(m.income.ridge, 0);
  assert.ok(Math.abs(m.flow['gulch>ridge'] - 5) < 1e-9, '20 bricks in 4 seconds');
  // a charter starts the town's count over: the rate starts again, never negative
  gu.lifetime = 0; g.clock.t = t0 + 8; m.update(g);
  assert.equal(m.income.gulch, 0);
  // a long catch-up counts at its real pace
  gu.lifetime = 3600; g.clock.t = t0 + 8 + 3600; m.update(g);
  assert.ok(Math.abs(m.income.gulch - 1) < 1e-9);
  assert.ok(m.total >= 1);
});

test('the meter follows a running empire', () => {
  const g = empire(), m = new FlowMeter();
  m.update(g);
  run(g, 30); m.update(g);
  assert.ok(m.total > 0, 'the empire earns');
  assert.ok(Object.values(m.income).every(x => x >= 0));
});

test('busier routes show more wagons, rolling faster', () => {
  assert.deepEqual(wagonsFor(0), { count: 0, speed: 0 });
  const a = wagonsFor(.5), b = wagonsFor(4), c = wagonsFor(1e4);
  assert.equal(a.count, 1);
  assert.ok(b.count > a.count && b.speed > a.speed);
  assert.equal(c.count, 6); assert.ok(c.speed <= 2);
});
