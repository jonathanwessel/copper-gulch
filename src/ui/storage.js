/* Where the game is kept on this device. Only cg-* keys (the old game shares this origin and uses its own key).
   Save slots, export and import arrive with the phone shell; for now one autosave. */
import { encode, decode } from '../core/save.js';

export const SAVE_KEY = 'cg-save';

export function readSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? decode(s) : null; } catch (e) { console.warn('Save not loaded:', e.message); return null; }
}
export function writeSave(game) {
  try { localStorage.setItem(SAVE_KEY, encode(game, Date.now())); return true; } catch (e) { return false; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* private mode */ } }
