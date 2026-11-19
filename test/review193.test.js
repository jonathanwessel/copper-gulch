/* The review of 2026.11.19-3: rates with a unit, the research button's time left, what deeds are for. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { perSecond } from '../src/ui/format.js';
import { leftWord } from '../src/ui/sheets.js';
import { GOODS } from '../src/data/goods.js';

test('a building output names its good as the unit, singular for exactly 1', () => {
  assert.equal(perSecond(1, GOODS.planks), '1 plank a second');
  assert.equal(perSecond(2.4, GOODS.planks), '2.4 planks a second');
  assert.equal(perSecond(1, GOODS.glass), '1 glass a second');
  assert.equal(perSecond(1, GOODS.lightbulbs || Object.values(GOODS).find(g => g.name === 'Light bulbs')), '1 light bulb a second');
  assert.equal(perSecond(.5, GOODS.ore || Object.values(GOODS).find(g => g.name === 'Copper ore')), '0.5 copper ore a second');
});

test('the research button counts down in short words', () => {
  assert.equal(leftWord(44.2), '45 sec left');
  assert.equal(leftWord(.2), '1 sec left');
  assert.equal(leftWord(600), '10 min left');
});
