// The release plumbing: the audit is clean, the offline list covers the game, and the files the page needs exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { audit } from '../tools/audit.js';
import { shellFiles } from '../tools/bump-version.js';

test('the audit finds no problems', () => {
  assert.deepEqual(audit().problems, []);
});

test('every feature has an explainer, and the audit notices one that is missing', async () => {
  const { requiredFeatures, explainerRules } = await import('../tools/audit.js');
  const { EXPLAINERS } = await import('../src/data/explainers.js');
  assert.ok(requiredFeatures().includes('tower:crossbow'));
  assert.deepEqual(explainerRules(), []);
  const keep = EXPLAINERS.splice(EXPLAINERS.findIndex(e => e.id === 'boss'), 1);
  try { assert.ok(explainerRules().some(p => p.includes('feature boss'))); } finally { EXPLAINERS.push(...keep); }
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

test('the text guard catches narrator lines, bare decimals and repeated facts', async () => {
  const { textIssues, textRules } = await import('../tools/audit.js');
  assert.ok(textIssues('This upgrade makes you pick one of two paths. You can\'t switch later.').length >= 2);
  assert.ok(textIssues('It can\'t hit raiders closer than 1.4.').some(p => /decimal/.test(p)));
  assert.ok(textIssues('It can\'t hit raiders closer than this. Raiders closer than this are safe from it.').some(p => /same thing/.test(p)));
  assert.deepEqual(textIssues('Drag to move the map. Pinch to zoom. Twist two fingers to turn it.'), []);
  assert.deepEqual(textIssues('Slows raiders 45%'), []);
  assert.deepEqual(textRules(), []);
});

test('What\'s new lists every entry since the version a device last saw, newest first', async () => {
  const { unseen } = await import('../src/ui/news.js');
  const list = [{ v: '2026.11.17-2', lines: ['b'] }, { v: '2026.11.17-1', lines: ['a'] }, { v: '2026.11.16-9', lines: ['old'] }];
  assert.deepEqual(unseen('2026.11.16-9', list, '2026.11.17-2').map(n => n.v), ['2026.11.17-2', '2026.11.17-1']);
  assert.deepEqual(unseen('2026.11.17-2', list, '2026.11.17-2'), []);
  assert.deepEqual(unseen(null, list, '2026.11.17-1').map(n => n.v), ['2026.11.17-1', '2026.11.16-9'], 'never seen: everything up to this version');
});
