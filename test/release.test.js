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

test('the manifest makes the game installable: relative paths, standalone, any and maskable icons at 192 and 512', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  for (const k of ['id', 'start_url', 'scope']) assert.equal(m[k], './', k);
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.short_name && m.description && m.theme_color && m.background_color);
  for (const want of ['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable']) {
    const i = m.icons.find(x => x.sizes + ' ' + x.purpose === want);
    assert.ok(i, want);
    assert.ok(!i.src.startsWith('/') && fs.existsSync(new URL('../' + i.src, import.meta.url)), i.src);
  }
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon.png"/);
  assert.match(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /addEventListener\('fetch'/);
});
