// Review of 2026.11.19-6: the map labels' rates add up to the top bar's, and a town on hold still shows what it earns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeRates } from '../src/ui/map.js';

const num = t => { const m = /\+([\d.]+)(K)?\/s/.exec(t); return m ? +m[1] * (m[2] ? 1e3 : 1) : 0; };

test('the labels add up to the total the top bar writes', () => {
  const infos = { gulch: { income: 4.76, won: false, inPlay: true }, ridge: { income: .66, won: false, inPlay: false, alert: 'lost' }, drycreek: { income: .04, won: true, inPlay: false }, falls: null };
  const r = badgeRates(5.46, infos);
  assert.equal(r.total, '+5.4/s');
  assert.equal(r.words.drycreek, 'Sends goods'); // a won outpost that only sends goods takes no share
  assert.equal(r.words.falls, undefined); // locked: no label rate
  assert.ok(Math.abs(num(r.words.gulch) + num(r.words.ridge) - 5.4) < 1e-9, r.words.gulch + ' + ' + r.words.ridge);
  assert.match(r.words.ridge, /^\+0\.\d\/s$/); // on hold, it still shows its rate
});

test('a big total splits in the steps of its last digit', () => {
  const r = badgeRates(12345, { a: { income: 6000 }, b: { income: 6000 }, c: { income: 345 } });
  assert.equal(r.total, '+12.3K/s');
  assert.ok(Math.abs(Object.values(r.words).reduce((s, w) => s + num(w), 0) - 12300) < 1e-6, JSON.stringify(r.words));
});

test('a place too small for one step reads under, never +0', () => {
  const r = badgeRates(5, { a: { income: 4.99 }, b: { income: .01 } });
  assert.equal(r.words.b, '+1/min');
  assert.equal(r.words.a, '+5.0/s');
});

test('from 10 to 999 a second the rows are whole numbers, as the top bar writes them', () => {
  const r = badgeRates(37.4, { a: { income: 25.2 }, b: { income: 9.1 }, c: { income: 2.6 }, d: { income: .5 } });
  assert.equal(r.total, '+37/s');
  assert.deepEqual(Object.values(r.words).filter(w => /\./.test(w)), []);
  assert.equal(r.words.d, '+30/min'); // under one step and under 1 a second: a minute's worth (clarity fix 8a)
  assert.equal(Object.values(r.words).reduce((s, w) => s + num(w), 0), 37);
});
