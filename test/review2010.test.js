// M5, words and layout from the screenshot review of 2026.11.20-10: goals name the empty lot, one name for each place
// and for the boss retry, Goods rows always say what is spare, price words say how far down, the bridges arch over the
// river so the steamer passes under, and raiders face along the road again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GOALS } from '../src/data/goals.js';
import { TOWNS } from '../src/data/towns/index.js';
import { CAPITAL_DEF as CAPITAL } from '../src/data/capital.js';
import { TOWERS } from '../src/data/towers.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { priceWord } from '../src/ui/sheets.js';
import { goodsLine } from '../src/ui/format.js';
import { foremanLine } from '../src/ui/explain.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('a build goal names the empty lot to tap', () => {
  const builds = GOALS.filter(g => / then tap Build$/.test(g.text));
  assert.ok(builds.length >= 15);
  for (const g of builds) assert.match(g.text, /^Tap the [A-Z][A-Za-z ]+ lot, then tap Build$/, g.id);
});

test('one name for each place and one phrase for the boss retry', () => {
  assert.equal(TOWNS.drycreek.name, TOWNS.drycreek.short);
  assert.equal(CAPITAL.name, 'Capital');
  const sheets = read('src/ui/sheets.js'), lost = read('src/ui/lost.js'), map = read('src/ui/map.js');
  assert.ok(sheets.includes("'Fight the ' + bossName(town) + ' again'"));
  assert.ok(!sheets.includes('Keep trying') && !sheets.includes('Starts the waves again'));
  assert.ok(lost.includes("'Tries again once Auto-towers upgrades a tower.'") && map.includes("info.alert === 'retry' ? ' · On hold'"));
  const ex = EXPLAINERS.find(e => e.id === 'retry' || e.title === 'Try again');
  assert.ok(ex && ex.title === 'Try again' && /tries again/.test(ex.text));
  assert.ok(!map.includes("'Back to ' : 'Play '"), 'the map card says Play for every town');
  const back = EXPLAINERS.find(e => e.id === 'back');
  assert.equal(back.title, 'Jump back');
  assert.equal(back.say({ back: 'drycreek' }), 'Tap ◂ Dry Creek to play there again.');
});

test('the Mortar and the Still are best against bosses, not the wagons the Gulch makes', () => {
  for (const k of ['still', 'mortar']) {
    const d = TOWERS[k]; if (!d) continue;
    assert.doesNotMatch(d.about + ' ' + (d.bestText || ''), /wagon/i, k);
  }
});

test('every Goods row says what is kept and what is spare, and the price word says how far down', () => {
  assert.equal(goodsLine({ have: 1330, kept: 0, selling: false }), '1.33K in stock · 0 for towers · 1.33K spare');
  assert.equal(goodsLine({ have: 84, kept: 84, selling: true }), '84 in stock · 84 for towers · 0 spare');
  assert.equal(priceWord(1), 'Full price');
  assert.equal(priceWord(.4), 'Down 60%');
  assert.equal(priceWord(.001), 'Down 99%');
  for (let s = 0; s <= 1; s += .01) assert.ok(priceWord(s).length <= 10);
});

test('the old-wave bonus says how long it lasts, and the foreman line says who is paused', () => {
  assert.equal(oldWavesLabel({ record: 22 }), 'Won before signing');
  assert.ok(oldWavesLabel({ record: 120 }).length <= 20);
  assert.equal(foremanLine('flooded', 'timber'), 'Foreman paused while the timber price is low.');
  assert.ok(read('src/ui/play.js').includes('Not enough power, so it works slower.')); // said for that card since 2026.11.20-13
  for (const s of ['Foreman paused while the timber price is low.', 'Tap Perks in a town to sign a charter. That town starts over at wave 1 and you get deeds.', 'After a loss, tries again once a tower goes up a level.']) assert.deepEqual(textIssues(s), []);
});

test('the bridges arch high enough for boats, and raiders turn along the road and hide in the entrance', async () => {
  const board = read('src/render/board.js'), battle = read('src/render/battle.js');
  const BRIDGE = Number(board.match(/export const BRIDGE = ([.\d]+);/)[1]);
  assert.ok(BRIDGE - .07 > .26 * 1.4 + .02, 'the steamer hull clears the deck');
  // the two statements once lost inside a comment run as code
  const line = battle.split('\n').find(l => l.includes('u.obj.rotation.y = Math.atan2(x2 - x, z2 - z)'));
  assert.ok(line && !line.trimStart().startsWith('//') && !line.includes('//'));
  assert.ok(/u\.obj\.visible = s >= this\.hideS/.test(line));
  assert.ok(read('src/assets/models/units.js').includes('root.userData.stack = stack'));
});

test('Influence shows under the map coins, and the selected building has no tag over its card', () => {
  assert.ok(read('src/ui/map.js').includes("infl.id = 'influence'"));
  assert.ok(read('src/ui/play.js').includes("if (p && !marked && openId === id) { t.hidden = true; continue; }"));
});

test('Auto-towers names the good it waits for, not "its goods"', async () => {
  const { autoWait } = await import('../src/ui/sheets.js');
  const town = { has: (g, n) => g !== 'copper' };
  assert.equal(autoWait(town, { coins: 75, goods: { timber: 4, copper: 12 } }), 'Waiting for 12 copper');
  assert.equal(autoWait({ has: () => true }, { coins: 75, goods: { timber: 4 } }), 'Waiting for 150 coins');
});
