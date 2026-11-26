// Clarity fix 8p (PLAN.md M6b): a good a workshop waits on stays on the goods strip, made here or shipped in. The
// Mesa's Motor Works said "Not enough wire" while wire sat behind "5 more" on the strip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame } from '../src/core/setup.js';
import { foundTown } from '../src/core/empire.js';
import { stripFit, stripGoods, blockGoods } from '../src/core/reveal.js';
import { STEP } from '../src/core/clock.js';
import { TOWNS } from '../src/data/towns/index.js';

const F = TOWNS.mesa.found;
function mesa() {
  const g = newGame('p8', 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  g.towns.falls.bestWave = F.wave; g.town.coins = F.coins * 1.1;
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = 3; g.shared.charter.deeds = F.deeds || 0;
  foundTown(g, 'mesa'); g.go('mesa');
  return g;
}

test('a workshop short of an imported good keeps that good on a full goods strip', () => {
  const g = mesa(), t = g.town;
  // every Mesa workshop up, with fuel and aluminum in stock and no wire, so the Motor Works waits on wire
  for (const id of ['derrick', 'bauxitepit', 'rubberfarm', 'refinery', 'aluminum', 'tireworks', 'motorworks', 'autoplant', 'airshipworks']) t.buildings[id] = 3;
  Object.assign(t.goods, { oil: 50, bauxite: 50, rubber: 50, fuel: 500, aluminum: 500, tires: 50, steel: 5, dynamos: 5, motors: 5, autos: 5, wire: 0 });
  for (let i = 0; i < 40; i++) g.step(STEP);
  assert.equal(t.starved.motorworks, true, 'the Motor Works waits');
  assert.ok(blockGoods(t).has('wire'), 'wire is what it waits on');
  const all = stripGoods(t);
  assert.ok(all.includes('wire'), 'wire is a strip good');
  for (const max of [3, 4, 6, 8]) {
    const f = stripFit(t, max);
    assert.ok(f.list.includes('wire'), max + ' chips: wire shows (' + f.list.join(', ') + ')');
    assert.ok(f.more > 0 || f.list.length === all.length);
  }
  // once wire is in, the strip goes back to its usual order: the town's own goods first
  t.goods.wire = 999; for (let i = 0; i < 40; i++) g.step(STEP);
  assert.ok(!blockGoods(t).has('wire'));
});

// Clarity fix 8q: one wave number on the bar and the strip, and the Capital's map label asks for what the strip asks.
import { goalNow, meterWords, capitalAsk } from '../src/core/goals.js';
import { waveTitle } from '../src/ui/wave.js';

test('a new town: the strip counts the same wave the bar shows', () => {
  const g = mesa(), t = g.town;
  g.shared.goals.done = Object.fromEntries(Object.keys(g.shared.goals.done || {}).map(k => [k, true]));
  const x = goalNow(g, false);
  // any wave count on the strip here names the bar's number
  for (const step of [x, { meter: g2 => [g2.towns.mesa.bestWave || 0, 10], pre: 'wave ', meterTown: 'mesa' }].filter(s => s && s.pre === 'wave ')) {
    assert.equal(meterWords(step, g), 'wave ' + t.wave + ' / ' + step.meter(g)[1]);
    assert.equal(waveTitle(t), 'Wave ' + t.wave);
  }
  t.bestWave = 4; t.wave = 5;
  assert.equal(meterWords({ meter: g2 => [g2.towns.mesa.bestWave, 10], pre: 'wave ', meterTown: 'mesa' }, g), 'wave 5 / 10');
});

test('the Capital label names the Rail Office step while the strip asks for it', () => {
  const g = newGame('p8q', 'gulch');
  g.addTown('ridge'); g.addTown('falls');
  for (const id of Object.keys(g.towns)) g.towns[id].bestWave = 60;
  g.shared.capital.open = true; g.shared.charter.deeds = F.deeds || 0;
  g.shared.tree.founded.push('market', 'transport'); g.shared.tree.nodes.transport = 1;
  g.go('falls');
  g.shared.goals.done = new Proxy({}, { get: () => true }); // every town goal done, so the empire's step leads
  const s = goalNow(g);
  assert.equal(s.id, 'next:mesa:nodes', s.text);
  assert.equal(capitalAsk(g), 'Upgrade the Rail Office');
  g.shared.tree.founded = g.shared.tree.founded.filter(i => i !== 'transport'); g.shared.tree.nodes.transport = 0;
  assert.equal(goalNow(g).id, 'next:mesa:inst');
  assert.equal(capitalAsk(g), 'Build the Rail Office');
  g.shared.tree.founded.push('transport'); g.shared.tree.nodes.transport = 1;
  // with the step there, the label says it; with no Capital step, the label keeps its own words (null)
  g.shared.tree.nodes.transport = 3;
  const s2 = goalNow(g);
  if (!(s2 && (s2.inst || s2.next === 'institution'))) assert.equal(capitalAsk(g), null);
});
