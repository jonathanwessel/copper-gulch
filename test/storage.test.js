// Save slots, export and import (src/ui/storage.js), against a stand-in for localStorage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, slotKey, SLOT_KEY, activeSlot, setActiveSlot, readSave, writeSave, clearSave, slotSummary, exportText, importText, writeText } from '../src/ui/storage.js';
import { newGame, loadGame } from '../src/core/setup.js';
import { decode, SAVE_VERSION } from '../src/core/save.js';

const fakeStore = () => {
  const m = new Map();
  return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
};

test('slot keys are cg-* and slot 1 keeps the old single-save key', () => {
  assert.equal(slotKey(1), 'cg-save');
  for (let n = 1; n <= SLOTS; n++) assert.ok(slotKey(n).startsWith('cg-'));
  assert.ok(SLOT_KEY.startsWith('cg-'));
  assert.equal(new Set(Array.from({ length: SLOTS }, (_, i) => slotKey(i + 1))).size, SLOTS);
});

test('the active slot defaults to 1, is remembered, and refuses a slot that does not exist', () => {
  const s = fakeStore();
  assert.equal(activeSlot(s), 1);
  setActiveSlot(3, s); assert.equal(activeSlot(s), 3);
  assert.throws(() => setActiveSlot(4, s)); assert.throws(() => setActiveSlot(0, s));
  s.setItem(SLOT_KEY, 'junk'); assert.equal(activeSlot(s), 1);
});

test('each slot keeps its own game', () => {
  const s = fakeStore(), a = newGame('a', 'gulch'), b = newGame('b', 'gulch');
  a.town.coins = 111; b.town.coins = 222; b.town.wave = 7;
  writeSave(a, 1, s, 1000); writeSave(b, 2, s, 2000);
  assert.equal(readSave(1, s).game.towns.gulch.coins, 111);
  assert.equal(readSave(2, s).game.towns.gulch.coins, 222);
  assert.equal(readSave(3, s), null);
  const sum = slotSummary(2, s);
  assert.deepEqual([sum.empty, sum.town, sum.wave, sum.coins, sum.at], [false, 'gulch', 7, 222, 2000]);
  assert.deepEqual(slotSummary(3, s), { n: 3, empty: true });
  clearSave(1, s); assert.equal(readSave(1, s), null); assert.equal(readSave(2, s).game.towns.gulch.coins, 222);
  s.setItem(slotKey(3), '{broken'); assert.equal(slotSummary(3, s).damaged, true); assert.equal(readSave(3, s), null);
});

test('export and import round-trip a game, and import stamps the time as now', () => {
  const g = newGame('x', 'gulch'); g.town.coins = 4321; g.town.buildings.camp = 9;
  const text = exportText(g, 5);
  const { text: out, game } = importText('  ' + text + '\n', loadGame, 9999);
  assert.equal(game.town.coins, 4321); assert.equal(game.town.level('camp'), 9);
  const s = decode(out); assert.equal(s.at, 9999); assert.equal(s.v, SAVE_VERSION);
  const st = fakeStore(); writeText(out, 2, st);
  assert.equal(readSave(2, st).game.towns.gulch.coins, 4321);
});

test('import explains what is wrong in plain words', () => {
  assert.throws(() => importText('', loadGame), /Paste a save first/);
  assert.throws(() => importText('hello there', loadGame), /not a Copper Gulch save/);
  assert.throws(() => importText(JSON.stringify({ v: SAVE_VERSION + 1, game: {} }), loadGame), /newer version/);
  assert.throws(() => importText(JSON.stringify({ v: SAVE_VERSION, at: 0, game: { towns: {} } }), loadGame), /damaged/);
  for (const t of ['', 'hello', '{"v":99}']) { try { importText(t, loadGame); } catch (e) { assert.ok(!/[:;]/.test(e.message), e.message); } }
});
