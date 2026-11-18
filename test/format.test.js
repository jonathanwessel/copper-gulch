// Numbers on screen: short, with K, M, B suffixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtLive } from '../src/ui/play.js';

test('fmt keeps small numbers exact enough and shortens big ones', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(3.14159), '3.1');
  assert.equal(fmt(42.9), '42');
  assert.equal(fmt(999), '999');
  assert.equal(fmt(1234), '1.23K');
  assert.equal(fmt(1800), '1.8K');
  assert.equal(fmt(2000), '2K');
  assert.equal(fmt(.25), '0.25');
  assert.equal(fmt(56789), '56.8K');
  assert.equal(fmt(2.5e6), '2.5M');
  assert.equal(fmt(7.1e9), '7.1B');
  assert.equal(fmt(Infinity), '0');
});

test('fmtLive: a live count is never more than 5 characters, with fixed decimals, so its cell keeps one width', () => {
  const cases = [[0, '0'], [7, '7'], [8.16, '8.1'], [42, '42'], [999, '999'], [999.96, '999'], [1000, '1.00K'], [1234, '1.23K'], [1800, '1.80K'],
    [9999, '9.99K'], [10000, '10.0K'], [56789, '56.7K'], [99999, '99.9K'], [100000, '100K'], [999999, '999K'], [1e6, '1.00M'], [2.5e6, '2.50M'], [7.1e9, '7.10B'], [-3, '0'], [NaN, '0']];
  for (const [n, s] of cases) assert.equal(fmtLive(n), s, String(n));
  for (let n = 1; n < 1e15; n *= 1.37) assert.ok(fmtLive(n).length <= 5, n + ' gave ' + fmtLive(n));
});
