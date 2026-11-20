// M5, words and layout from the screenshot review of 2026.11.20-12: power is its own line, not a good each one uses, the
// power warning is said for its card, a camp says where its good goes, "Either path", the deed bonus said once, the
// vault bar has its name, labels keep room side by side, and landscape cards keep to 46% unless they hold a path choice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { usedBy } from '../src/core/explain.js';
import { produce } from '../src/core/economy.js';
import { usedLine } from '../src/ui/play.js';
import { GOODS } from '../src/data/goods.js';
import { liftBadges, BADGE_GAP } from '../src/ui/map.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('a camp says which buildings use its good and how much', () => {
  const g = newGame('r12', 'gulch'), t = g.town;
  assert.deepEqual(usedBy(t, 'timber').ids, [], 'nothing built uses it yet');
  assert.equal(usedLine(usedBy(t, 'timber'), GOODS.timber), '');
  t.buildings.camp = 20; t.buildings.saw = 2; t.goods.timber = 1e4;
  for (let i = 0; i < 40; i++) produce(t, .25);
  const u = usedBy(t, 'timber');
  assert.deepEqual(u.ids, ['saw']);
  assert.ok(u.rate > 0);
  assert.match(usedLine(u, GOODS.timber), /^The Sawmill takes [\d.]+ timber a second\.$/);
  assert.equal(usedLine({ ids: ['saw', 'smelter', 'kiln'], rate: 4 }, GOODS.timber), 'The Sawmill, Smelter and Kiln take 4 timber a second.');
  assert.equal(usedLine({ ids: ['saw'], rate: 0 }, GOODS.timber), 'Timber goes to the Sawmill.');
  assert.deepEqual(usedBy(t, 'power'), { ids: [], rate: 0 }, 'power is never used up, so never listed');
  for (const s of ['The Sawmill takes 2 timber a second.', 'Glass goes to the Bulb Works.', 'Not enough power, so it works slower. Upgrade the Water Wheel.', 'Upgrade it so they run at full speed.']) assert.deepEqual(textIssues(s), [], s);
});

test('power has its own line, never in the list of goods each one uses', () => {
  const play = read('src/ui/play.js');
  assert.match(play, /goodsIn = ins\.filter\(\(\[k\]\) => !isGrid\(k\)\)/);
  assert.ok(play.includes("'Town power '"));
  assert.ok(!play.includes('Buildings that use power run slower'), 'the general rule left the cards');
});

test('the path price, the deeds and the vault bar each say what they are', () => {
  const play = read('src/ui/play.js'), sheets = read('src/ui/sheets.js'), html = read('index.html');
  assert.ok(!play.includes("'Either path'"), 'the path price has its own row (review of 2026.11.20-13)');
  assert.ok(sheets.includes('each.hidden = !!p.total'), 'the deed line hides while After signing says it');
  assert.ok(play.includes('vaultBtn.append(heart(), vault)'), 'the count keeps its mark, a heart since the review of 2026.11.20-14');
  assert.ok(!html.includes('.safe {'), 'the unlabeled strongbox left');
  assert.match(html, /\.card:has\(> \.pathbar\) \{ width: min\(54%, 480px\); \}/);
});

test('labels side by side keep the same room as above and below', () => {
  const a = { x: 100, y: 200, w: 80, h: 40 }, b = { x: 150, y: 200, w: 80, h: 40 };
  liftBadges([a, b], [], BADGE_GAP, { W: 400 });
  const apart = Math.abs(a.x - b.x) - 80, above = Math.abs(a.y - b.y) - 40;
  assert.ok(apart >= BADGE_GAP - .01 || above >= BADGE_GAP - .01, `${apart} ${above}`);
});
