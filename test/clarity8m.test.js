// Clarity fix 8m (fresh-eyes read of 2026.11.26-1): one clock for To arms, research as a clock, no unit said twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { armsClock, armsLine, leftWord } from '../src/ui/sheets.js';
import { vaultHits } from '../src/ui/map.js';
import { hitsLeftWords } from '../src/ui/explain.js';
import { HITS_LEFT } from '../src/ui/format.js';

// 8m (1): the button said "Ready in 4:09" and its card "Ready again in 4:10"; both now read armsClock
test('the To arms button and its sheet read one clock', () => {
  const g = newGame('8m1', 'gulch'), t = g.town;
  t.flags['open:arms'] = true;
  for (const cd of [250, 249.6, 61, .3]) {
    t.arms = { t: 0, cd };
    assert.match(armsClock(t), /^Ready in [0-9]+:[0-5][0-9]$/);
    const line = armsLine(g, t);
    if (line.startsWith('Ready in')) assert.equal(line, armsClock(t) + '.');
  }
  t.arms = { t: 42, cd: 300 }; assert.equal(armsClock(t), 'Back in 0:42');
  t.arms = { t: 0, cd: 0 }; assert.equal(armsClock(t), '');
});

// 8m (2): research counts down as a clock, like every other running countdown
test('a running research reads as a clock', () => {
  assert.equal(leftWord(13), '0:13 left');
  assert.equal(leftWord(.2), '0:01 left');
  assert.equal(leftWord(725), '12:05 left');
});

// 8m (6): "Hits left · 16 hits" said hits twice; the label says hits, the value is the count
test('Hits left shows the count alone', () => {
  assert.equal(HITS_LEFT, 'Hits left');
  assert.equal(vaultHits({ vault: { hp: 15.2, max: 20 } }), '16');
  assert.equal(hitsLeftWords({ rows: [{}, {}], value: 25, left: 16 }), '16');
  assert.equal(hitsLeftWords({ rows: [{}, {}], value: 25, left: 25 }), 'Full');
});
