// The pixel font: every glyph is 7 rows of 5 bits, and text lays out 6 font pixels per letter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLYPHS, pixels } from '../src/art/pixfont.js';

test('every glyph fits 5 by 7 and lights at least one pixel (except space)', () => {
  for (const ch of GLYPHS) {
    const px = pixels(ch);
    for (const [x, y] of px) assert.ok(x >= 0 && x < 5 && y >= 0 && y < 7, ch);
    if (ch !== ' ') assert.ok(px.length > 0, ch);
  }
});

test('letters are 6 pixels apart, lower case maps to upper case', () => {
  const a = pixels('I'), b = pixels('aI').filter(([x]) => x >= 6).map(([x, y]) => [x - 6, y]);
  assert.deepEqual(b, a);
  assert.deepEqual(pixels('gulch'), pixels('GULCH'));
});

test('the alphabet and digits are all there', () => {
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') assert.ok(GLYPHS.includes(ch), ch);
});
