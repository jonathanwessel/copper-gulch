// Clarity fixes 8j and 8k (fresh-eyes reads of 2026.11.25-8 and 2026.11.25-10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { explainTower, explainOutput } from '../src/core/explain.js';
import { addsShown } from '../src/ui/explain.js';
import { fmtDmg } from '../src/ui/format.js';
import { TOWERS, PATHS } from '../src/data/towers.js';
import { BUILDINGS } from '../src/data/buildings.js';

// 8j (1): no why row is a bare factor, and the start plus the rows add up to the total as written
test('a why row says what it adds, never a bare factor, and the rows add up to the total', () => {
  const g = newGame('8j1', 'gulch'), t = g.town;
  t.mods.set('towerDmg', 'Gunsmith research', { mul: 1.3 });
  let checked = 0;
  for (const k of Object.keys(TOWERS)) for (const path of [null, 'a', 'b']) for (let L = 1; L <= 30; L++) {
    if (path && !PATHS[k][path]) continue;
    const ex = explainTower(t, { kind: k, level: L, path: L >= 5 ? path : null });
    for (const e of [ex.dmg, ex.poison].filter(Boolean)) {
      const adds = addsShown(e);
      let sum = 0;
      for (const [i, r] of e.rows.entries()) {
        if (r.base !== undefined) { sum = r.base; continue; }
        assert.ok(!/×|÷/.test(adds[i]), k + ' ' + L + ' ' + adds[i]);
        assert.match(adds[i], /^[+-][0-9.]+[KMBT]?$|% (more|less)$/, k + ' ' + L + ' ' + r.label + ' ' + adds[i]);
        if (/^[+-][0-9.]+$/.test(adds[i])) sum += +adds[i]; else sum = NaN;
      }
      if (e.value < 999 && !Number.isNaN(sum)) { assert.ok(Math.abs(sum - +fmtDmg(e.value)) < 1e-6, k + ' level ' + L + ' ' + path + ' ' + sum + ' ' + fmtDmg(e.value)); checked++; }
    }
    for (const s of ['rate', 'range']) for (const a of addsShown(ex[s])) if (a !== null) assert.match(a, /^\d+% (more|less)$/, k + ' ' + s + ' ' + a);
  }
  assert.ok(checked > 200, 'checked ' + checked);
});

test('a building output row reads as the amount it adds a second', () => {
  const g = newGame('8j1b', 'gulch'), t = g.town, id = Object.keys(BUILDINGS).find(k => t.def.buildings.includes(k));
  t.buildings[id] = 26;
  const ex = explainOutput(t, id), adds = addsShown(ex);
  const row = ex.rows.findIndex(r => /^Level/.test(r.label));
  assert.ok(row > 0, ex.rows.map(r => r.label).join());
  assert.match(adds[row], /^\+[0-9.]+[KMBT]?\/s$/, adds[row]);
});

// 8j (2): one timer, one form: the wave bar's countdown is the map label's clock
test('the wave bar and the map label write a countdown the same way', async () => {
  const { waveTimer } = await import('../src/ui/wave.js');
  const { stateWord, clock } = await import('../src/ui/state.js');
  for (const t of [3, 28, 59.2, 117, 240, 599]) {
    assert.equal(waveTimer({ phase: 'break', hold: false, timer: t }), 'in ' + clock(t));
    assert.ok(stateWord({ state: 'raids', timer: t }).endsWith(clock(t)));
  }
});

// 8k (1): a boom over a good sold low never says the price is up
test('the boom line follows the price now, not the event alone', async () => {
  const { boomWords } = await import('../src/ui/sheets.js');
  assert.doesNotMatch(boomWords(1.6, '1:00', .01), /Price up/);
  assert.match(boomWords(1.6, '1:00', 1.6), /^Price up/);
  assert.match(boomWords(.6, '1:00', .6), /^Price down/);
});

// 8k (2): the lost card says once that the boss loses the wave even with hits left
test('a boss that gets through: the card says it loses the wave with hits left', async () => {
  const { lostCard } = await import('../src/ui/lost.js');
  const g = newGame('8k2', 'gulch'), t = g.town;
  t.lost = { why: 'boss', wave: 10, back: 8, coins: 100 };
  const lines = lostCard(t).lines.join(' ');
  assert.equal(lines.match(/hits left/g).length, 1, lines);
  t.lost = { why: 'vault', wave: 10, back: 8, coins: 100 };
  assert.doesNotMatch(lostCard(t).lines.join(' '), /hits left/);
});

// 8k (6): Weak to names a tower the player has here before one they could build
test('Weak to names a tower the town has before one it could build', async () => {
  const { bestTower } = await import('../src/ui/wave.js');
  const { FOES } = await import('../src/data/foes.js');
  const g = newGame('8k6', 'gulch'), t = g.town;
  t.flags = { ...(t.flags || {}) };
  for (const k of Object.keys(TOWERS)) t.flags['open:' + k] = true;
  const boss = Object.keys(FOES).find(k => FOES[k].boss && FOES[k].armor > 0) || 'wagon';
  const top = bestTower(t, boss);
  assert.ok(top, 'some tower hits ' + boss + ' harder');
  const other = Object.keys(TOWERS).find(k => k !== top && TOWERS[k].best && (TOWERS[k].best.armored > 1 || TOWERS[k].best.boss > 1));
  if (!other) return;
  t.towers = [{ kind: other, spot: 0, level: 1 }];
  assert.equal(bestTower(t, boss), other, 'the one the town has');
  t.towers = [];
  assert.equal(bestTower(t, boss), top);
});
