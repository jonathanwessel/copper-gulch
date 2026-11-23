// M5, words and layout from the screenshot review of 2026.11.20-11: the top-left block never moves, goals name the lit
// back button, one verb (Play) to switch places, nothing said twice on one card, towers name the town's boss, the Rail
// Office names the outposts, Power is on the goods strip and each town's own goods lead it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { goalText } from '../src/core/goals.js';
import { stripGoods } from '../src/core/reveal.js';
import { oldWavesLabel } from '../src/core/explain.js';
import { TOWERS } from '../src/data/towers.js';
import { GOODS } from '../src/data/goods.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { INSTITUTION, outpostWords, boughtText } from '../src/data/institutions.js';
import { priceNote } from '../src/ui/format.js';
import { foremanLine } from '../src/ui/explain.js';
import { STOCK_LABEL, stockWords } from '../src/ui/sheets.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the top-left block sits at the top, never centered on the side column', () => {
  const html = read('index.html');
  assert.match(html, /\.hud \{\n\s*position: absolute;[^}]*align-items: flex-start;/);
  assert.match(html, /\.hudleft \{[^}]*align-self: start;/);
  assert.ok(read('tools/shots.js').includes('the wave bar moves between'), 'shots.js fails a wave bar that moves');
});

test('a goal that goes where the back button goes names that button', () => {
  const g = newGame('r11', 'gulch'), t = g.town;
  const away = { text: 'Tap Map, Copper Gulch, then build a Smelter', at: () => ({ el: '#backBtn', go: 'gulch' }) };
  assert.equal(goalText(g, t, away), 'Tap ◂ Copper Gulch, then build a Smelter');
  assert.equal(goalText(g, t, { ...away, text: 'Tap Map, Copper Gulch, then Play Copper Gulch' }), 'Tap ◂ Copper Gulch');
  assert.equal(goalText(g, t, { ...away, text: 'Tap Map, then tap Copper Gulch' }), 'Tap ◂ Copper Gulch');
  assert.equal(goalText(g, t, { ...away, text: 'Tap Map, then tap Copper Gulch', at: () => ({ el: '#mapBtn', go: 'gulch' }) }), 'Tap Map, then tap Copper Gulch');
  assert.equal(goalText(g, t, { ...away, at: () => ({ el: '#mapBtn', go: 'gulch' }) }), away.text, 'through the map: unchanged');
});

test('one verb switches places, Play, and Start opens a new one', () => {
  assert.equal(EXPLAINERS.find(e => e.id === 'dc-won').button, 'Play Copper Gulch');
  for (const f of ['src/ui/sheets.js', 'src/ui/lost.js', 'src/core/goals.js']) assert.ok(!/'Go to '/.test(read(f)), f);
});

test('nothing said twice: the price note, Perks, the Boiler Shop', () => {
  assert.equal(priceNote({ have: 0, price: .00005 }), 'The price comes back over time.'); // "Down 99%" says the rest
  assert.doesNotMatch(priceNote({ have: 50, price: .00005 }), /almost nothing/);
  const sheets = read('src/ui/sheets.js'), play = read('src/ui/play.js');
  assert.ok(sheets.includes("'After signing'") && !sheets.includes('Sign now and you have'));
  assert.ok(!sheets.includes('saves by itself'));
  assert.match(play, /if \(imp\.length && !\(town\.starved\[id\] && L && shortImp\.length/, 'come by wagon only when not short');
  assert.ok(play.includes("' in a moment.'"));
});

test('plainer words for the old-wave bonus, the foreman, the hold goal and the stock switch', () => {
  assert.ok(oldWavesLabel({ record: 120 }).length <= 20 && oldWavesLabel({}).length <= 20);
  assert.equal(foremanLine('flooded', 'timber'), 'Foreman paused while the timber price is low.');
  assert.equal(stockWords({ stock: 'lots' }), '4 upgrades');
  assert.ok(read('src/ui/play.js').includes('STOCK_LABEL'), 'the building card uses the same name');
  for (const s of ['Foreman paused while the timber price is low.', 'Tap Hold waves while you save for Iron Ridge', 'Won last time']) assert.deepEqual(textIssues(s), []);
});

test('towers name the town\'s own boss, and the Rail Office names the outposts', () => {
  for (const k of ['mortar', 'still']) assert.ok((TOWERS[k].about + TOWERS[k].bestText).includes('{boss}'), k);
  assert.match(read('src/ui/play.js'), /bossWords\([^;]*bestText/, 'Best against goes through bossWords (a fork can bring its own, 2026.11.21-9)');
  assert.equal(outpostWords(INSTITUTION.transport.nodes[0].about, ['Dry Creek']), 'Dry Creek make 25% more goods.'.replace('make', 'make'));
  assert.equal(outpostWords('{outposts} make 25% more goods.', ['Dry Creek', 'Pine Hollow', 'Sandy Bend']), 'Dry Creek, Pine Hollow and Sandy Bend make 25% more goods.');
  assert.match(boughtText(INSTITUTION.transport, 1), /^\{outposts\} make/);
  assert.ok(read('src/ui/capital.js').includes("labeled('Once built', say(inst.about))"));
});

test('each town\'s own goods lead its strip, and Power has a chip once the town makes it', () => {
  const g = newGame('r11b', 'gulch'), G = g.town;
  G.bestWave = 20; G.coins = 2e5; foundTown(g, 'ridge'); g.go('ridge');
  const r = g.towns.ridge; r.goods.bricks = 5; r.goods.tools = 5; r.goods.stone = 5;
  const s = stripGoods(r), firstAway = s.findIndex(x => GOODS[x].town !== 'ridge');
  assert.ok(firstAway > 0 && s.slice(firstAway).every(x => GOODS[x].town !== 'ridge'), s.join());
  assert.ok(read('src/ui/play.js').includes("powerChip.id = 'stripPower'"));
});
