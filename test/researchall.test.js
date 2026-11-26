// Owner bug (2026-11-20): "I got auto research somehow..but the research menu is gone? How do I see what's being
// researched?" Research opened per town, outposts have none, and the University opens Auto-research for the whole
// empire. Once any town researches, the Research button is in every town and outpost, its sheet lists what runs in the
// other towns and says what to build where research is not open, and the Auto sheet names the running item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { tabs } from '../src/core/reveal.js';
import { researchAnywhere, labsRunning, startResearch } from '../src/core/research.js';
import { researchClosedLine, elsewhereLines, otherLabs } from '../src/ui/sheets.js';
import { EXPLAINERS } from '../src/data/explainers.js';
import { textIssues, requiredFeatures } from '../tools/audit.js';

const sp = s => s.replace(/\u00a0/g, ' '); // place names keep a no-break space
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const empire = () => {
  const g = newGame('ra1');
  for (const id of ['gulch', 'pinehollow', 'ridge']) if (!g.towns[id]) g.addTown(id);
  return g;
};

test('the Research button stays hidden until research opens somewhere, then shows in every town and outpost', () => {
  const g = empire();
  assert.equal(researchAnywhere(g), false);
  for (const t of Object.values(g.towns)) assert.equal(tabs(g, t).research, false, t.id);
  const gulch = g.towns.gulch; gulch.flags['open:research'] = true;
  assert.equal(researchAnywhere(g), true);
  for (const t of Object.values(g.towns)) assert.equal(tabs(g, t).research, true, t.id + ' shows Research');
});

test('where research is not open, the sheet says the one thing to do', () => {
  const g = empire(); g.towns.gulch.flags['open:research'] = true;
  assert.equal(researchClosedLine(g, g.towns.gulch), '');
  assert.equal(researchClosedLine(g, g.towns.ridge), 'Build the Blast Furnace to start research here.');
  // owner, 2026-11-22: in Dry Creek the other towns' research read as shared; an outpost says it has none of its own
  assert.equal(sp(researchClosedLine(g, g.towns.drycreek)), 'Dry Creek has no research. Each town researches on its own.');
  g.towns.ridge.flags['open:research'] = true;
  assert.equal(sp(researchClosedLine(g, g.towns.pinehollow)), 'Pine Hollow has no research. Each town researches on its own.');
  for (const t of Object.values(g.towns)) assert.deepEqual(textIssues(researchClosedLine(g, t)), [], t.id);
});

test('the sheet lists the research running in the other towns, never this town\'s own again', () => {
  const g = empire(), gulch = g.towns.gulch; gulch.flags['open:research'] = true; gulch.coins = 1e6; g.shared.purse.coins = 1e6;
  assert.ok(startResearch(g, gulch, 'saws'));
  assert.equal(labsRunning(g).length, 1);
  gulch.lab.left = 13;
  assert.deepEqual(elsewhereLines(g, g.towns.drycreek).map(sp), ['Copper Gulch · Sharp Saws · 0:13 left']);
  g.towns.ridge.flags['open:research'] = true; // a town that can research and runs nothing shows too, so an idle one is seen
  assert.deepEqual(elsewhereLines(g, g.towns.drycreek).map(sp), ['Copper Gulch · Sharp Saws · 0:13 left', 'Iron Ridge · Not researching']);
  assert.deepEqual(elsewhereLines(g, gulch).map(sp), ['Iron Ridge · Not researching'], 'never its own, its row says it');
  assert.deepEqual(otherLabs(g, g.towns.drycreek).map(x => x.id), ['gulch', 'ridge'], 'each row knows its town, so a tap goes there');
});

test('the Auto sheet names what Auto-research runs and opens Research, and Auto-research teaches itself once', () => {
  const sheets = read('src/ui/sheets.js'), play = read('src/ui/play.js');
  assert.ok(sheets.includes("RESEARCH[town.lab.id].name + ' · ' + leftWord(town.lab.left)"));
  assert.ok(sheets.includes("btn('See research', 'btn small')"));
  assert.ok(play.includes("autoSheet(game, town, () => openResearch())"));
  const e = EXPLAINERS.find(x => x.id === 'auto-research');
  assert.ok(e && e.covers.includes('auto-research') && requiredFeatures().includes('auto-research'));
  assert.equal(e.when({ autoResearch: true, tabs: { auto: true, research: true }, t: 5 }), true);
  assert.equal(e.when({ autoResearch: false, tabs: { auto: true, research: true }, t: 5 }), false);
  assert.deepEqual(e.at(), { el: '#autoBtn' });
  assert.deepEqual(textIssues(e.text), []);
});
