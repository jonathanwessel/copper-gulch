// The release plumbing: the audit is clean, the offline list covers the game, and the files the page needs exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audit } from '../tools/audit.js';
import { shellFiles } from '../tools/bump-version.js';

test('the audit finds no problems', () => {
  assert.deepEqual(audit().problems, []);
});

test('the offline list has the page, the boot module and three.js', () => {
  const s = shellFiles();
  for (const f of ['./index.html', './manifest.webmanifest', './src/main.js', './vendor/three/three.module.min.js']) assert.ok(s.includes(f), f);
});

test('package.json is an ES module package with no dependencies', () => {
  const p = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(p.type, 'module');
  assert.equal(p.dependencies, undefined);
  assert.equal(p.devDependencies, undefined);
});
