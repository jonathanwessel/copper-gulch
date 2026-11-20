/* The save format. A save is JSON: { v, at, game }. `v` is the shape's version: any change to the shape bumps it and
   adds a migration from the version before, so every old save still loads. `at` is the wall-clock time of the save
   in ms (passed in; the core never reads the clock), used for offline catch-up.
   Storage itself (cg-* keys, slots, export and import) belongs to the interface; this module only encodes. */

import { GOALS } from '../data/goals.js';

export const SAVE_VERSION = 19;

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
  // v12: one coin purse for the whole empire (game.shared.purse): every town's coins added up; recent earnings start at 0
  11: s => {
    const g = s.game || {}, sh = g.shared = g.shared || {};
    let n = (sh.purse && sh.purse.coins) || 0;
    for (const t of Object.values(g.towns || {})) { n += t.coins || 0; delete t.coins; if (t.recent === undefined) t.recent = 0; }
    sh.purse = { coins: n };
    return { ...s, v: 12, game: g };
  },
  // v13: game.prev, the last place in play before this one (the top bar's back button); old saves start with none
  12: s => {
    const g = s.game || {};
    if (g.prev === undefined) g.prev = null;
    return { ...s, v: 13, game: g };
  },
  // v14: the Capital (game.shared.capital, src/core/capital.js): not built yet in every old save; the game fills in the
  // rest of its state (the contract board, its random stream) when it loads
  13: s => {
    const g = s.game || {}, sh = g.shared = g.shared || {};
    if (!sh.capital) sh.capital = { open: false, influence: 0, earned: 0, filled: 0, offers: [], active: null };
    return { ...s, v: 14, game: g };
  },
  // v15: institutions and the Empire tree (game.shared.tree, src/core/tree.js): none founded in every old save
  14: s => {
    const g = s.game || {}, sh = g.shared = g.shared || {};
    if (!sh.tree) sh.tree = { founded: [], nodes: {}, spent: 0 };
    return { ...s, v: 15, game: g };
  },
  // v16: Automation (game.shared.auto, src/core/automation.js): every switch Off in every old save
  15: s => {
    const g = s.game || {}, sh = g.shared = g.shared || {};
    if (!sh.auto) sh.auto = {};
    return { ...s, v: 16, game: g };
  },
  // v17: Keep trying the boss (src/core/automation.js): the switch Off and no try running in every old save
  16: s => {
    const g = s.game || {}, sh = g.shared = g.shared || {};
    for (const a of Object.values(sh.auto || {})) { if (a.retry === undefined) a.retry = false; if (a.boss === undefined) a.boss = null; }
    return { ...s, v: 17, game: g };
  },
  // v18: Silver Falls has 3 mortar pits, not 4 (src/data/towns/falls.js): the east pit by the rock cut (old 13) is gone,
  // and pit 13 is now the pit by the vault (old 15). A Mortar by the vault keeps its place under its new number. A Mortar
  // on the east pit moves to the pit by the vault when that is free; when it is not, it comes down with every coin spent
  // on it back in the purse.
  17: s => {
    const g = s.game || {}, f = g.towns && g.towns.falls;
    if (f && Array.isArray(f.towers)) {
      const east = f.towers.find(t => t.spot === 13), south = f.towers.find(t => t.spot === 15);
      if (east && south) {
        f.towers = f.towers.filter(t => t !== east);
        const sh = g.shared = g.shared || {}; sh.purse = sh.purse || { coins: 0 }; sh.purse.coins = (sh.purse.coins || 0) + (east.spent || 0);
      }
      if (south) south.spot = 13; // the east Mortar alone keeps number 13, which is now the pit by the vault
    }
    return { ...s, v: 18, game: g };
  },
  // v19: the Goods sheet's "Keep for towers · Normal / Lots" (src/core/defense.js, towerReserve): every town of an old save on Normal
  18: s => {
    const g = s.game || {};
    for (const t of Object.values(g.towns || {})) if (t && t.stock !== 'lots') t.stock = 'normal';
    return { ...s, v: 19, game: g };
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
