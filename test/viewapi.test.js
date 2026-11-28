// Clarity fix 8aa: the play screen reads the 3D view through the small viewApi that src/main.js fills in, and every call
// it makes is guarded ("viewApi.foePoints ? ..."), so a call main.js never wired fails quietly. foePoints was never wired:
// the level pills' step aside while a raider passes (review of 2026.11.20-5) and the goal tag's dimming never ran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('every view call the play screen makes is wired in main.js', () => {
  const play = fs.readFileSync('src/ui/play.js', 'utf8').replace(/export function foeBox[\s\S]*?\n}\n/, ''); // foeBox takes the real view as an argument
  const main = fs.readFileSync('src/main.js', 'utf8');
  const used = new Set([...play.matchAll(/viewApi\.([A-Za-z]+)/g)].map(m => m[1]));
  const start = main.match(/const viewApi = \{([^}]*)\}/);
  assert.ok(start, 'main.js builds viewApi');
  const wired = new Set([...start[1].matchAll(/([A-Za-z]+):/g)].map(m => m[1]).concat([...main.matchAll(/viewApi\.([A-Za-z]+) =/g)].map(m => m[1])));
  for (const k of used) assert.ok(wired.has(k), 'viewApi.' + k + ' is used by the play screen but never set in main.js');
});
