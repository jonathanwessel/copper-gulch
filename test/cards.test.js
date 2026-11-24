// Tip cards are spaced and a card about what to do now goes first (clarity fix 7, review 7: 18 cards in the first
// 5 minutes, some a second apart). src/core/cards.js is what the coach and the playthrough both use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardDue, CARD_GAP, TIP_GAP, CARD_EARLY } from '../src/core/cards.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { record } from '../tools/playthrough.js';
import { cardsOf, cardStats } from '../tools/card-probe.js';

const tip = { id: 'tip', when: () => true }, now = { id: 'now', now: true, when: () => true }, first = { id: 'first', now: 1, when: () => true };

test('a card about what to do now goes before a tip, and rank 1 before the rest', () => {
  assert.equal(cardDue([tip, now], { t: 10 }, {}, 10).id, 'now');
  assert.equal(cardDue([tip, now, first], { t: 10 }, {}, 10).id, 'first');
  assert.equal(cardDue([tip], { t: 10 }, { tip: true }, 10), null);
});

test('cards wait CARD_GAP after the last one, a tip waits TIP_GAP in a town\'s first minutes, and later only CARD_GAP', () => {
  assert.equal(cardDue([now], { t: 30 }, {}, 30, 30 - CARD_GAP + 1), null);
  assert.equal(cardDue([now], { t: 30 }, {}, 30, 30 - CARD_GAP).id, 'now');
  assert.equal(cardDue([tip], { t: 100 }, {}, 100, 100 - CARD_GAP), null);
  assert.equal(cardDue([tip], { t: 100 }, {}, 100, 100 - TIP_GAP).id, 'tip');
  const late = CARD_EARLY + 60;
  assert.equal(cardDue([tip], { t: late }, {}, 5000, 5000 - CARD_GAP).id, 'tip');
  assert.equal(cardDue([tip], { t: late }, {}, 5000, 5000 - CARD_GAP + 1), null, 'never back to back, even late');
  assert.equal(cardDue([tip], { t: 5 }, {}, 5, null).id, 'tip', 'nothing to wait for after a load');
});

test('the newcomer sees at most 8 cards before 5:00, each at least 20 seconds apart, none twice (seeds 1-6)', () => {
  for (let s = 1; s <= 6; s++) {
    const c = cardsOf(record(s, 30).moments), st = cardStats(c);
    assert.ok(st.early <= 8, `seed ${s}: ${st.early} cards before 5:00`);
    assert.deepEqual(st.twice, [], `seed ${s}: shown twice`);
    for (let i = 1; i < c.length; i++) assert.ok(c[i].at - c[i - 1].at >= CARD_GAP - .01, `seed ${s}: ${c[i - 1].id} then ${c[i].id} ${(c[i].at - c[i - 1].at).toFixed(1)} s apart`);
  }
});

test('every now mark is true or a rank, and each town\'s welcome is rank 1', () => {
  for (const e of EXPLAINERS) if (e.now !== undefined) assert.ok(e.now === true || Number.isInteger(e.now), e.id);
  for (const e of EXPLAINERS.filter(x => x.town && x.when.length === 0)) assert.equal(e.now, 1, e.id + ' is a welcome');
});

test('the playthrough\'s own card check agrees on seed 1', async () => {
  const { cardCheck } = await import('../tools/playthrough.js');
  assert.deepEqual(cardCheck(record(1, 30).moments), []);
  assert.ok(cardCheck([{ cards: [{ at: 1, id: 'a' }, { at: 5, id: 'a' }] }]).length === 2, 'seen red on a made-up run');
});
