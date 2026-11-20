// Owner feedback, 2026-11-19: building tags are quiet by default, and the wave bar keeps one width with only the wave
// number, a timer and Call now (the raiders moved to a card the wave number opens).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newGame } from '../src/core/setup.js';
import { waveTimer, waveLines } from '../src/ui/wave.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the wave timer says one short thing in its fixed box', () => {
  assert.equal(waveTimer({ phase: 'break', hold: false, timer: 27.2 }), 'in 28s');
  assert.equal(waveTimer({ phase: 'break', hold: true, timer: 5 }), 'On hold');
  assert.equal(waveTimer({ phase: 'wave', queue: ['raider'], foes: [] }), 'Fighting');
  for (const t of ['in 120s', 'On hold', 'Fighting']) assert.ok(t.length <= 8);
});

test('the raiders card says when the wave comes, a boss, and which raiders can ride', () => {
  const g = newGame('tb1', 'gulch'), t = g.town;
  t.wave = 10;
  const lines = waveLines(t);
  assert.match(lines[0], /^It comes in \d+ seconds\.$/);
  assert.ok(lines.some(l => /A boss wave\. The war wagon comes last/.test(l)));
  assert.ok(lines.some(l => /^Can bring Bandits, Riders and Brutes\.$/.test(l)));
  Object.assign(t.waves, { phase: 'wave', type: 'swarm', queue: ['raider', 'raider', 'runner'], foes: [{ kind: 'raider' }] });
  assert.deepEqual(waveLines(t), ['4 raiders left.', '3 Bandits', '1 Rider']);
  Object.assign(t.waves, { queue: ['raider', 'raider'], foes: [] });
  assert.deepEqual(waveLines(t), ['2 Bandits left.']);
  for (const l of waveLines(t)) assert.deepEqual(textIssues(l), []);
});

test('the bar has no foe list and keeps Call now in its place; tags are a quiet pill unless they matter', () => {
  const play = read('src/ui/play.js'), css = read('index.html');
  assert.doesNotMatch(play, /' left · ' \+ \(WAVE_TYPES/);
  assert.match(play, /call\.classList\.toggle\('away', away\)/);
  assert.match(css, /\.wave \.call\.away \{ visibility: hidden; \}/);
  assert.match(play, /const full = !!\(flat \|\| marked \|\| openId === id\)/);
  assert.match(css, /\.tag\.quiet \.tl \{/);
  assert.doesNotMatch(css, /\.tag\.quiet[^{]*\{[^}]*border-left/); // no gold stripe on a quiet tag
});
