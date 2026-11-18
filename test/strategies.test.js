// The strategy bots (tools/balance.js): each plays its own way, and none falls over early.
import test from 'node:test';
import assert from 'node:assert/strict';
import { play, STRATEGIES } from '../tools/balance.js';

const runs = Object.fromEntries(Object.keys(STRATEGIES).map(k => [k, play(1, 20, k)]));

test('there are five strategies, the ones the design claims work', () => {
  assert.deepEqual(Object.keys(STRATEGIES).sort(), ['active', 'defense', 'economy', 'minmax', 'swarm']);
});

test('every strategy builds its first tower in time and holds waves 1-3', () => {
  for (const [k, r] of Object.entries(runs)) {
    assert.ok(r.firstTower !== null && r.firstTower < 60, k + ' first tower at ' + r.firstTower);
    assert.ok(!r.breaches.some(w => w <= 3), k + ' breached early: ' + r.breaches);
    assert.ok(r.wave10 !== null, k + ' never cleared wave 10');
  }
});

test('min-max keeps few towers high, swarm spreads many low', () => {
  const lv = r => r.final.towers.map(s => +s.match(/\d+/)[0]);
  const mm = lv(runs.minmax), sw = lv(runs.swarm);
  // its rule: no more than STRATEGIES.minmax.most of a kind and one Cannon (seven on the Gulch's four kinds; it reached
  // seven once foremen stopped spending on flooded timber, 2026-11-18)
  const kinds = runs.minmax.final.towers.map(s => s.match(/^[a-z]+/)[0]), count = k => kinds.filter(x => x === k).length;
  for (const k of new Set(kinds)) assert.ok(count(k) <= (k === 'cannon' ? 1 : STRATEGIES.minmax.most), 'min-max has ' + count(k) + ' ' + k);
  assert.ok(mm.length <= 7, 'min-max has ' + mm.length + ' towers');
  assert.ok(sw.length > mm.length, 'swarm has no more towers than min-max');
  assert.ok(Math.max(...mm) > Math.max(...sw), 'min-max top level is not above swarm');
  // on the stone pads (a Mortar in a far pit may have just been built)
  const pads = runs.swarm.final.towers.filter(s => !s.startsWith('mortar')).map(s => +s.match(/\d+/)[0]);
  assert.ok(Math.max(...pads) - Math.min(...pads) <= 1, 'swarm levels are uneven: ' + pads);
});

test('the bots play Dry Creek first: the active player calls waves early and wins it in 8-12 min, then plays the Gulch with Dry Creek running', async () => {
  const { campaign } = await import('../tools/balance.js');
  const { dc, gulch, game } = campaign(1, 'active', 10);
  assert.ok(dc.firstTower !== null && dc.firstTower < 60);
  assert.ok(dc.won >= 480 && dc.won <= 720, 'won at ' + dc.won);
  assert.ok(dc.calls > 0, 'it called a wave early');
  assert.ok(gulch && game.active === 'gulch');
  assert.ok(game.towns.drycreek.won);
  assert.ok(gulch.firstTower !== null);
});
