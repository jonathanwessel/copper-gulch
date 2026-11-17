// Lane entrances: every town's road comes out of a real entrance with a model, and raiders stay hidden inside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapRules } from '../tools/audit.js';
import { TOWNS, TOWN_ORDER } from '../src/data/towns/index.js';
import { makePath, pointAt } from '../src/core/path.js';

test('every town names an entrance that has a model', () => {
  for (const id of TOWN_ORDER) assert.ok(TOWNS[id].board.entrance && TOWNS[id].board.entrance.kind, id);
  assert.deepEqual(mapRules(), []);
  const b = TOWNS.gulch.board;
  const none = { x: { board: { ...b, entrance: undefined } } }, odd = { x: { board: { ...b, entrance: { ...b.entrance, kind: 'nowhere' } } } };
  assert.ok(mapRules(none, ['x']).some(p => /no entrance/.test(p)));
  assert.ok(mapRules(odd, ['x']).some(p => /no model for the entrance/.test(p)));
});

test('the Gulch: raiders appear inside the canyon, past the portal, and ride out of its mouth', () => {
  const b = TOWNS.gulch.board, e = b.entrance, road = makePath([...b.road, b.vault]);
  const [, zStart] = pointAt(road, 0), [, zShow] = pointAt(road, e.hide);
  assert.ok(zStart < e.portal[1], 'they start behind the portal');
  assert.ok(zShow > e.portal[1] && zShow < e.mouth[1], 'they show between the portal and the mouth');
  assert.ok(Math.abs(pointAt(road, 0)[0] - e.mouth[0]) < .01, 'the road runs through the mouth');
});
