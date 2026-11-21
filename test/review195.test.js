import test from 'node:test';
import assert from 'node:assert/strict';
import { splitLive, fmtLive } from '../src/ui/format.js';

const num = s => { const m = /^([\d.]+)([KMBT]?)$/.exec(s); return +m[1] * { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2]]; };

test('income rows add up to the total as written (review of 2026.11.19-5)', () => {
  const r = splitLive(5.49, [4.79, 0.66, 0.04]);
  assert.equal(r.total, '5.4');
  assert.deepEqual(r.rows, ['4.8', '0.6', 'a little']); // 4.7 + 0.6 + 0.0 under 5.4 was the bug
  assert.deepEqual(splitLive(1234, [1230, 4]).rows, ['1.23K', 'a little']);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2000; k++) {
    const scale = 10 ** Math.floor(rnd() * 9 - 1), vals = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => rnd() * scale);
    const tot = vals.reduce((s, v) => s + v, 0), sp = splitLive(tot, vals);
    assert.equal(sp.total, fmtLive(tot));
    assert.ok(sp.rows.every(Boolean));
    const sum = sp.rows.filter(v => v !== 'a little').reduce((s, v) => s + num(v), 0);
    assert.ok(Math.abs(sum - num(sp.total)) <= num(sp.total) * 1e-9 + 1e-9, `${vals} -> ${sp.rows} vs ${sp.total}`);
  }
});
