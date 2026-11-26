// Clarity fix 8n (fresh-eyes read of 2026.11.26-2): the boss bar's stage says itself once and shows its armor as a
// fill, the vault's start row never reads as a buy, To arms names what it costs, research levels are pips, and a
// count on the strip is have / need like every other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOES, STAGE_LINES } from '../src/data/foes.js';
import { textIssues } from '../tools/audit.js';
import { explainVault } from '../src/core/explain.js';
import { newGame } from '../src/core/setup.js';

// 8n (1): a new stage says itself once in a toast, the raider card's own words, two short plain sentences (the bar
// keeps the boss's name: words in its place read as a narrator, fresh-eyes read of 2026.11.26-4)
test('each boss stage has a short toast line that passes the words check', () => {
  for (const [kind, F] of Object.entries(FOES)) for (const st of F.stages || []) {
    const parts = STAGE_LINES[st.key].split(/(?<=[.]) /);
    assert.ok(parts.length >= 1 && parts.length <= 2, kind + ' ' + parts.length + ' sentences');
    for (const p of parts) { assert.match(p, /[.]$/); assert.deepEqual(textIssues(p), [], p); }
  }
});

// 8n (1): no pace arrow on the bar (green down read as health falling, then the triangle read as a dropdown)
test('the boss bar draws no pace arrow', () => {
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8'), js = readFileSync(new URL('../src/ui/boss.js', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /[.]sarrow/);
  assert.doesNotMatch(js, /'sarrow/);
});

// 8n (2): the bar's armor is a fill like the card's, from the same view
test('the boss bar gives its armor as a fill, and none once the boss is down', async () => {
  const { bossView } = await import('../src/ui/boss.js');
  const g = newGame('8n2', 'gulch'), t = g.town;
  const f = { id: 1, kind: 'wagon', lane: 0, hp: 50, max: 100, s: 3, slow: 0, slowT: 0, frozenT: 0, poison: 0, poisonT: 0, rot: 0, eat: 0, brittle: 0 };
  t.waves.foes = [f];
  const v = bossView(t, f);
  assert.ok(v.armorFill && v.armorFill.share > 0 && v.armorFill.full >= v.armorFill.share);
  f.hp = 0;
  assert.equal(bossView(t, f).armorFill, null);
});

// 8n (3): a primary button that cannot be pressed is not orange
test('a disabled primary button has its own flat look', () => {
  const css = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const rule = css.match(/[.]btn[.]primary:disabled \{[^}]*\}/);
  assert.ok(rule, 'a rule for it');
  assert.doesNotMatch(rule[0], /--copper/);
  assert.match(rule[0], /background/);
});

// 8n (4): "New vault" read like a vault to buy
test('the vault start row says what it was built with, for a vault and a stockpile', () => {
  for (const id of ['gulch', undefined]) { // undefined: Dry Creek's stockpile, where a new game starts
    const g = id ? newGame('8n4', id) : newGame('8n4'), t = g.town, row = explainVault(t).rows[0];
    assert.equal(row.label, 'Starts with');
    assert.doesNotMatch(row.label, /New/);
  }
});
