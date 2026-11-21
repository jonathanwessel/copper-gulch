// Gate margins (roadmap review, 2026-11-20): the bots print a "close" line for every gate within 5% of its limit, so
// the next change that tips one is expected, not a surprise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MARGIN, CLOSE, nearMax, nearMin, nearWin, SHARE_MAX, STRATEGY_SLACK } from '../tools/balance.js';

test('a gate within 5% of its limit is close, one further away or past it is not', () => {
  CLOSE.length = 0;
  assert.equal(MARGIN, .05);
  nearMax('share 35.4%', .354, SHARE_MAX); // the economy Cannon before the pads
  nearMax('share 30%', .30, SHARE_MAX);
  nearMax('share 37%', .37, SHARE_MAX); // a miss, reported as a FAIL, not a close
  nearMax('22% behind', 1.22, STRATEGY_SLACK);
  nearMin('grew 3%', 1.03, 1);
  nearMin('grew 10%', 1.10, 1);
  nearWin('7.2 min', 7.2 * 60, [7 * 60, 10 * 60]);
  nearWin('8.5 min', 8.5 * 60, [7 * 60, 10 * 60]);
  nearWin('9.8 min', 9.8 * 60, [7 * 60, 10 * 60]);
  nearMax('never', NaN, 1);
  assert.deepEqual(CLOSE, ['share 35.4%', '22% behind', 'grew 3%', '7.2 min', '9.8 min']);
  CLOSE.length = 0;
});

test('balance and idle print the close lines', () => {
  const b = fs.readFileSync(new URL('../tools/balance.js', import.meta.url), 'utf8'), i = fs.readFileSync(new URL('../tools/idle.js', import.meta.url), 'utf8');
  assert.ok(b.includes('printClose();') && i.includes('printClose();'));
  for (const s of ['nearMax(`${where', 'Silver Falls wave 10 ${', 'Iron Ridge founded at', 'Silver Falls founded at', 'the Capital built at']) assert.ok(b.includes(s), s);
  for (const s of ['nearWin(', 'nearMin(', 'nearMax(']) assert.ok(i.includes(s), s);
});
