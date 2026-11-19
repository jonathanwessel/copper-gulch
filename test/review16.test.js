// M5, fresh-eyes fixes from 2026.11.18-16: a tower's damage breakdown adds up as written (it read 59 when its lines
// multiplied to 60), and a tower sells back a share of every coin spent on it, its upgrades too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { buildTower, upgradeTower, sellTower, towerAt, towerCost, fitsSpot } from '../src/core/defense.js';
import { explainTower } from '../src/core/explain.js';
import { mulShown, mulText } from '../src/ui/explain.js';
import { fmt, fmtDmg } from '../src/ui/format.js';
import { TOWERS, PATHS, SELL_BACK } from '../src/data/towers.js';

const written = (ex, vals) => fmtDmg(ex.rows.reduce((v, x, i) => (x.base !== undefined ? x.base : v * (vals ? vals[i] : +mulText(x.mul).slice(2))), 1));

test('every damage breakdown multiplies, as written, to the total as written', () => {
  const g = newGame('rv1', 'gulch'), t = g.town;
  t.mods.set('towerDmg', 'Gunsmith research', { mul: 1.3 });
  let checked = 0, fixed = 0;
  for (const k of Object.keys(TOWERS)) for (const path of [null, 'a', 'b']) for (let L = 1; L <= 20; L++) {
    if (path && !PATHS[k][path]) continue;
    const ex = explainTower(t, { kind: k, level: L, path: L >= 5 ? path : null });
    for (const e of [ex.dmg, ex.poison].filter(Boolean)) {
      const vals = mulShown(e);
      assert.equal(written(e, vals), fmtDmg(e.value), k + ' level ' + L + ' ' + path);
      for (const [i, x] of e.rows.entries()) if (x.base === undefined) assert.ok(Math.abs(vals[i] - x.mul) <= .0501, k + ' ' + L + ' ' + x.label + ' ' + x.mul + ' shown ' + vals[i]);
      if (written(e) !== fmtDmg(e.value)) fixed++;
      checked++;
    }
  }
  assert.ok(checked > 100 && fixed > 0, 'the short factors alone miss some, ' + fixed + ' of ' + checked);
  assert.equal(fmt(.57 * 100), '57', '56.99999999999999 from float math reads 57');
});

test('selling a raised tower gives back a share of its upgrades too', () => {
  const g = newGame('rv2', 'gulch'), t = g.town;
  t.coins = 1e9; for (const gd of Object.keys(t.goods)) t.goods[gd] = 1e6;
  for (const k of Object.keys(TOWERS)) for (const gd of Object.keys(TOWERS[k].goods[t.id] || {})) t.goods[gd] = 1e6;
  const spot = t.def.board.spots.findIndex((_, i) => fitsSpot(t, i, 'cannon'));
  assert.ok(buildTower(g, t, spot, 'cannon'));
  let spent = towerCost(t, 'cannon', 0).coins;
  for (let L = 1; L < 6; L++) { spent += towerCost(t, 'cannon', L).coins; assert.ok(upgradeTower(g, t, spot, 'a')); }
  assert.equal(towerAt(t, spot).level, 6);
  const before = t.coins, back = sellTower(g, t, spot);
  assert.equal(back, Math.floor(spent * SELL_BACK));
  assert.ok(back > 3 * Math.floor(towerCost(t, 'cannon', 0).coins * SELL_BACK), 'more than a level 1 sells for');
  assert.equal(t.coins, before + back);
});
