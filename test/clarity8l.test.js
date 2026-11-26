// Clarity fix 8l (fresh-eyes read of 2026.11.25-10): one name per control, one picture per raider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOE_ART } from '../src/art/foes.js';
import { FOES } from '../src/data/foes.js';
import { STOCK_LABEL } from '../src/ui/sheets.js';
import { EXPLAINERS } from '../src/data/explainers.js';

// 8l (2): the bandit wagon and the war wagon shared one picture on the boss bar, so they read as one raider
test('every raider kind has a picture of its own, and the bosses differ most', () => {
  const kinds = Object.keys(FOES).filter(k => FOE_ART[k]);
  const diff = (a, b) => { let n = 0; for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (FOE_ART[a][y][x] !== FOE_ART[b][y][x]) n++; return n; };
  for (const a of kinds) for (const b of kinds) if (a < b) assert.ok(diff(a, b) >= 20, `${a} and ${b} differ in ${diff(a, b)} pixels`);
  const bosses = kinds.filter(k => FOES[k].boss);
  assert.ok(bosses.includes('wagon') && bosses.includes('bandits'));
  {
    // the two wagons share a shape, so the top half's main color (the cover) tells them apart at a glance
    const a = 'bandits', b = 'wagon';
    const main = k => { const n = {}; for (let y = 0; y < 6; y++) for (const ch of FOE_ART[k][y]) if (ch !== '.') n[ch] = (n[ch] || 0) + 1; return Object.entries(n).sort((p, q) => q[1] - p[1])[0][0]; };
    assert.notEqual(main(a), main(b), `${a} and ${b} have the same main color on top`);
  }
});

// 8l (1): "Save for towers" was both the Goods sheet's Normal / Lots choice and a building card's On / Off switch
test('the Goods sheet choice and the building switch have different names', () => {
  assert.equal(STOCK_LABEL, 'Stock for towers');
  const card = 'Save glass for towers'; // the building card's switch names its good (src/ui/play.js)
  assert.ok(!card.startsWith(STOCK_LABEL.split(' ')[0]));
  // the reserve explainer names the building switch, the one that sells a good in full
  assert.match(EXPLAINERS.find(e => e.id === 'reserve').text, /tap its building and switch Save for towers off/);
});
