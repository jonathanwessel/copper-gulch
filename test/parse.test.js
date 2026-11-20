// Every script parses, and no statement hides inside a line-end comment (review of 2026.11.20-10: a `//` comment in
// src/render/battle.js had swallowed two statements since the Silver Falls release, so raiders never turned along the
// road; the same slip in src/ui/capital.js broke the Play button before release).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const files = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name)] : []);
const ALL = [...files('src'), ...files('tools'), 'sw.js'].filter(f => fs.existsSync(path.join(root, f)));

/* A statement after a line's own `//`: an assignment to a property, ending in a semicolon. */
export const hidden = line => {
  const at = line.search(/[;)}]\s*\/\/ /); if (at < 0) return false;
  const rest = line.slice(line.indexOf('//', at) + 2);
  // an assignment, or two calls in a row ("r.append(...); stats.append(r);", the slip of 2026.11.20-14 that emptied the
  // tower card's stats in landscape)
  return /\b[A-Za-z_$][\w$]*(\.[\w$]+)+ = [^=;]+;/.test(rest) || /\b[A-Za-z_$][\w$]* = [^=;]+;\s*[A-Za-z_$][\w$.]*[.(]/.test(rest)
    || /\b[A-Za-z_$][\w$]*\.[\w$]+\(.*\);\s*[A-Za-z_$][\w$]*\.[\w$]+\(/.test(rest);
};

test('the hidden-statement check finds the slips it was made for', () => {
  assert.ok(hidden("  u.obj.position.set(x, 0, z); // up the ramp and over u.obj.rotation.y = Math.atan2(x2 - x, z2 - z); u.obj.visible = s >= 1;"));
  assert.ok(hidden("  const go = el('button', 'b', 'Play'); // the same on every card go.id = 'mapPlay';"));
  assert.ok(hidden("  { panel = make(game, { toast }); // no map here sig = 'open|' + panel.sig(); body.replaceChildren(panel.el); }"));
  assert.ok(hidden("      const r = el('div', 'statline'); // statline: laid out like the others r.append(el('span', null, a), el('b', null, b)); stats.append(r);"));
  assert.ok(!hidden("  const x = 1; // the price, a share of the best (review: \"High\" read as a price)"));
});

test('every script parses', () => {
  for (const f of ALL) {
    try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); }
    catch (e) { assert.fail(f + ' does not parse: ' + String(e.stderr).split('\n').slice(0, 4).join(' ')); }
  }
});

test('no statement hides inside a line-end comment', () => {
  const bad = [];
  for (const f of ALL) fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((l, i) => { if (hidden(l)) bad.push(f + ':' + (i + 1)); });
  assert.deepEqual(bad, []);
});
