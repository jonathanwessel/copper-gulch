// Words and layout from the review of 2026.11.20-5.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { goodsLine } from '../src/ui/format.js';
import { priceWord } from '../src/ui/sheets.js';
import { bestLine } from '../src/ui/wave.js';
import { liftBadges, BADGE_GAP } from '../src/ui/map.js';
import { INSTITUTIONS } from '../src/data/institutions.js';
import { TOWERS } from '../src/data/towers.js';
import { newGame } from '../src/core/setup.js';
import { textIssues } from '../tools/audit.js';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('a price of almost 0 is said once, by the price bar', () => {
  const line = goodsLine({ have: 40, kept: 5, selling: true, price: .001 });
  assert.equal(line, '40 in stock · 5 for towers · 35 spare');
  assert.doesNotMatch(line, /almost/);
  assert.equal(priceWord(.02), 'Down 98%'); // since 2026.11.20-9 the front says "Under 1 coin each" and the end how low
});

test('no dot stands where a colon would go, and raider names are lowercase in a sentence', () => {
  const g = newGame(1), t = g.towns.gulch || g.town;
  assert.equal(bestLine(t, 'raider'), 'Best tower · Any');
  for (const i of INSTITUTIONS) assert.doesNotMatch(i.about, /·/, i.name);
  const cap = read('src/ui/capital.js');
  assert.doesNotMatch(cap, /'(Now|Next) · '/);
  assert.match(cap, /labeled\('Next', say\(node\.about\)\)/);
  for (const T of Object.values(TOWERS)) assert.doesNotMatch(T.about, /Best against [A-Z]/, T.name);
});

test('plain status lines on the map, the Makes row and the Income sheet', async () => {
  const play = read('src/ui/play.js'), ex = read('src/ui/explain.js'), lost = read('src/ui/lost.js');
  assert.match(play, /'Nothing right now'/);
  assert.doesNotMatch(play, /'None right now'/);
  assert.match(ex, /'Bonuses included'/);
  assert.doesNotMatch(lost, /Auto-towers will raise a tower\. Then/);
  for (const s of ['Tries again once Auto-towers upgrades a tower.', 'Bonuses included', 'Best tower · Any']) assert.deepEqual(textIssues(s), []);
});

test('Perks reads as short rows, the unpicked perk is left out, and Sign the charter is a normal size', () => {
  const s = read('src/ui/sheets.js');
  assert.match(s, /btn\('Sign the charter', 'btn small primary'/);
  assert.match(s, /else if \(st !== 'locked'\) continue;/);
  assert.doesNotMatch(s, /coins earned here give /);
  assert.doesNotMatch(s, /, so you earn /);
});

test('map labels keep a clear gap, wider than a red dot sticks out', () => {
  assert.ok(BADGE_GAP >= 8);
  const rs = [{ x: 100, y: 200, w: 80, h: 40 }, { x: 100, y: 205, w: 80, h: 40 }];
  liftBadges(rs, [], BADGE_GAP);
  const [a, b] = rs.slice().sort((p, q) => q.y - p.y);
  assert.ok(a.y - a.h - b.y >= BADGE_GAP - .01 || Math.abs(a.x - b.x) >= 80 + BADGE_GAP - .01);
});

test('level pills step aside for raiders instead of fading, and toasts from the Capital stay on the map', () => {
  const css = read('index.html');
  assert.doesNotMatch(css, /\.play\.fighting \.tag\.quiet \.tl \{ opacity/);
  assert.match(css, /\.tag\.quiet\.overfoe \.tl \{ opacity: 0; \}/);
  assert.match(read('src/render/town-view.js'), /foePoints: \(\) =>/);
  assert.match(read('src/main.js'), /dropToasts\('capital'\)/);
  assert.match(css, /\.goal\.new \{ animation: slideIn/); // the goal strip slides in solid
  assert.match(read('src/render/camera.js'), /q\.x > r\.left \+ SIDE_GAP && q\.x < W - SIDE_GAP/); // a selection stays well inside the sides
  assert.match(read('src/ui/play.js'), /head\.getBoundingClientRect\(\)\.bottom/); // an opened breakdown stays below the card's title
});
