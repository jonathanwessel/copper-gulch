/* The save format. A save is JSON: { v, at, game }. `v` is the shape's version: any change to the shape bumps it and
   adds a migration from the version before, so every old save still loads. `at` is the wall-clock time of the save
   in ms (passed in; the core never reads the clock), used for offline catch-up.
   Storage itself (cg-* keys, slots, export and import) belongs to the interface; this module only encodes. */

export const SAVE_VERSION = 1;

/* MIGRATIONS[n] turns a version-n save into version n+1. Version 0 is the bare game object with no wrapper. */
export const MIGRATIONS = {
  0: s => ({ v: 1, at: s.at || 0, game: s.game || s }),
};

export function migrate(save) {
  let s = save && typeof save === 'object' ? save : null;
  if (!s) throw new Error('Not a save');
  if (s.v === undefined) s = { v: 0, game: s };
  if (s.v > SAVE_VERSION) throw new Error('This save is from a newer version of the game');
  while (s.v < SAVE_VERSION) {
    const step = MIGRATIONS[s.v];
    if (!step) throw new Error('No migration from save version ' + s.v);
    s = step(s);
  }
  return s;
}

export function encode(game, at) { return JSON.stringify({ v: SAVE_VERSION, at, game: game.toJSON() }); }

/* Parse and migrate a saved string; returns { v, at, game } with game as plain data (Game.fromJSON builds it). */
export function decode(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { throw new Error('The save is damaged (not JSON)'); }
  return migrate(raw);
}
