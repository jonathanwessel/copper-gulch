// Release versions: YYYY.MM.DD-N, compared by date and then by number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newer } from '../src/ui/update.js';
import { GAME_VERSION } from '../src/version.js';

test('newer compares dates first, then the release number', () => {
  assert.equal(newer('2026.11.17-1', '2026.11.16-9'), true);
  assert.equal(newer('2026.11.16-10', '2026.11.16-9'), true);
  assert.equal(newer('2026.11.16-2', '2026.11.16-2'), false);
  assert.equal(newer('2026.11.15-5', '2026.11.16-1'), false);
});

test('the game version has the release format', () => {
  assert.match(GAME_VERSION, /^\d{4}\.\d{2}\.\d{2}-\d+$/);
});
