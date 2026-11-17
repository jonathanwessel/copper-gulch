/* Where the game is kept on this device: three save slots, plus export and import as text. Only cg-* keys (the old
   game shares this origin and uses its own key).
     slot 1: cg-save (the key the single autosave used before slots, so those saves stay slot 1)
     slot 2, 3: cg-save-2, cg-save-3
     cg-slot: the slot in play.
   Every function takes the storage as an optional last argument, so the tests can pass a stand-in. */
import { encode, decode } from '../core/save.js';

export const SLOTS = 3;
export const SAVE_KEY = 'cg-save';
export const SLOT_KEY = 'cg-slot';
export const slotKey = n => (n === 1 ? SAVE_KEY : SAVE_KEY + '-' + n);
const ls = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };
const okSlot = n => Number.isInteger(n) && n >= 1 && n <= SLOTS;

export function activeSlot(store = ls()) {
  let n = 1;
  try { n = parseInt(store && store.getItem(SLOT_KEY), 10); } catch (e) { /* private mode */ }
  return okSlot(n) ? n : 1;
}
export function setActiveSlot(n, store = ls()) {
  if (!okSlot(n)) throw new Error('No slot ' + n);
  try { store.setItem(SLOT_KEY, String(n)); return true; } catch (e) { return false; }
}

/* The save in a slot as { v, at, game }, or null when the slot is empty or damaged. */
export function readSave(n = activeSlot(), store = ls()) {
  try { const s = store && store.getItem(slotKey(n)); return s ? decode(s) : null; } catch (e) { console.warn('Save not loaded:', e.message); return null; }
}
export function writeSave(game, n = activeSlot(), store = ls(), at = Date.now()) {
  try { store.setItem(slotKey(n), encode(game, at)); return true; } catch (e) { return false; }
}
export function clearSave(n = activeSlot(), store = ls()) { try { store.removeItem(slotKey(n)); } catch (e) { /* private mode */ } }

/* What a slot holds, for the slot list: { n, empty, damaged, town, wave, coins, at }. */
export function slotSummary(n, store = ls()) {
  let raw = null;
  try { raw = store && store.getItem(slotKey(n)); } catch (e) { /* private mode */ }
  if (!raw) return { n, empty: true };
  let s;
  try { s = decode(raw); } catch (e) { return { n, empty: false, damaged: true }; }
  const g = s.game || {}, t = (g.towns || {})[g.active] || Object.values(g.towns || {})[0] || {};
  return { n, empty: false, town: t.id || '', wave: t.wave || 0, best: t.bestWave || 0, coins: t.coins || 0, at: s.at || 0 };
}

/* Export: the game as one line of text to copy or keep in a file. */
export const exportText = (game, at = Date.now()) => encode(game, at);

/* Import: check pasted text and turn it into save text for a slot. load(data) builds the game (it throws on a save
   it cannot read). The time stamp is set to now, so an old save does not pay out the time since it was copied. */
export function importText(text, load, at = Date.now()) {
  const t = String(text || '').trim();
  if (!t) throw new Error('Paste a save first.');
  let s;
  try { s = decode(t); } catch (e) { throw new Error(/newer/.test(e.message) ? 'That save is from a newer version. Update the game first.' : 'That is not a Copper Gulch save.'); }
  let game;
  try { game = load(s.game); } catch (e) { throw new Error('That save is damaged.'); }
  if (!game || !game.town) throw new Error('That save is damaged.');
  return { text: encode(game, at), game };
}

/* Put save text straight into a slot (after importText). */
export function writeText(text, n = activeSlot(), store = ls()) {
  try { store.setItem(slotKey(n), text); return true; } catch (e) { return false; }
}
