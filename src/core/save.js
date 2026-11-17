/* The save format. A save is JSON: { v, at, game }. `v` is the shape's version: any change to the shape bumps it and
   adds a migration from the version before, so every old save still loads. `at` is the wall-clock time of the save
   in ms (passed in; the core never reads the clock), used for offline catch-up.
   Storage itself (cg-* keys, slots, export and import) belongs to the interface; this module only encodes. */

import { GOALS } from '../data/goals.js';

export const SAVE_VERSION = 11;

/* MIGRATIONS[n] turns a version-n save into version n+1. Version 0 is the bare game object with no wrapper. */
export const MIGRATIONS = {
  0: s => ({ v: 1, at: s.at || 0, game: s.game || s }),
  // v2: waves can be held (town.waves.hold), and the explainers seen are kept (game.shared.seen)
  1: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) if (t.waves && t.waves.hold === undefined) t.waves.hold = false;
    g.shared = g.shared || {}; g.shared.seen = g.shared.seen || {};
    return { ...s, v: 2, game: g };
  },
  // v3: lobbed shells in the air and burning ground are part of a town's waves
  2: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) if (t.waves) { t.waves.shells = t.waves.shells || []; t.waves.fires = t.waves.fires || []; }
    return { ...s, v: 3, game: g };
  },
  // v4: each good has a "Keep for towers" switch, on unless the good is listed in town.reserveOff
  3: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) t.reserveOff = t.reserveOff || {};
    return { ...s, v: 4, game: g };
  },
  // v5: town research runs one item at a time (town.lab); a town that already has its Sawmill has research open
  4: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) {
      t.research = t.research || {}; t.lab = t.lab || null; t.flags = t.flags || {};
      if ((t.buildings || {}).saw > 0) t.flags['open:research'] = true;
    }
    return { ...s, v: 5, game: g };
  },
  // v6: charters and deeds (game.shared.charter); no deeds yet, the charter not yet offered, no perks picked
  5: s => {
    const g = s.game || {};
    g.shared = g.shared || {};
    g.shared.charter = { deeds: 0, signed: 0, offered: false, perks: {}, last: null, ...(g.shared.charter || {}) };
    return { ...s, v: 6, game: g };
  },
  // v7: a wave keeps its age (town.waves.age, seconds since it started), so the next one keeps the wave pace
  6: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) if (t.waves && t.waves.age === undefined) t.waves.age = 0;
    return { ...s, v: 7, game: g };
  },
  // v8: the game starts in Dry Creek Outpost. A game already in Copper Gulch gets the outpost as won and running
  // (its buildings at level 5 and two Crossbows); loadGame opens it from game.shared.grant.
  7: s => {
    const g = s.game || {}, towns = g.towns || {};
    if (towns.gulch && !towns.drycreek) { g.shared = g.shared || {}; g.shared.grant = { ...(g.shared.grant || {}), drycreek: true }; }
    return { ...s, v: 8, game: g };
  },
  // v9: a town counts the coins its outposts' sales paid in (town.fromOutposts), which deeds leave out
  8: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) if (t.fromOutposts === undefined) t.fromOutposts = 0;
    return { ...s, v: 9, game: g };
  },
  // v10: the goal strip (game.shared.goals). A game already in Copper Gulch has done Dry Creek's goals; one past the
  // Gulch's first war wagon, or one that signed a charter, needs no goals at all.
  9: s => {
    const g = s.game || {}, towns = g.towns || {}, sh = g.shared = g.shared || {};
    const goals = sh.goals = { done: {}, visited: {}, off: false, ...(sh.goals || {}) };
    if (towns.gulch) {
      goals.visited.gulch = true;
      for (const x of GOALS) if (x.town === 'drycreek') goals.done[x.id] = true;
      if ((towns.gulch.bestWave || 0) >= 10 || ((sh.charter || {}).signed || 0) > 0) goals.off = true;
    }
    return { ...s, v: 10, game: g };
  },
  // v11: a town remembers its best wave from before its last charter (town.record), so those waves can be called at
  // once. A town that signed a charter takes it from the last charter's wave when that charter was its own.
  10: s => {
    const g = s.game || {}, last = ((g.shared || {}).charter || {}).last;
    for (const [id, t] of Object.entries(g.towns || {})) if (t.record === undefined) t.record = last && last.town === id && t.charters ? last.wave || 0 : 0;
    return { ...s, v: 11, game: g };
  },
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
