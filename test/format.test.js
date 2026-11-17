// Numbers on screen: short, with K, M, B suffixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt } from '../src/ui/play.js';

test('fmt keeps small numbers exact enough and shortens big ones', () => {
  assert.equal(fmt(0), '0');
  assert.equal(fmt(3.14159), '3.1');
  assert.equal(fmt(42.9), '42');
  assert.equal(fmt(999), '999');
  assert.equal(fmt(1234), '1.23K');
  assert.equal(fmt(56789), '56.8K');
  assert.equal(fmt(2.5e6), '2.50M');
  assert.equal(fmt(7.1e9), '7.10B');
  assert.equal(fmt(Infinity), '0');
});
