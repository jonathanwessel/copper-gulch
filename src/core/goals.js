/* The goal strip (GDD.md, Onboarding): one short goal at a time through the first 30 minutes (src/data/goals.js).
   An eighth system: every step it marks the goals whose done() has come true, in any order, and remembers the towns
   the player has been to. What is done is kept in the save (game.shared.goals = { done, visited, off }).
   goalNow(game) is the goal the strip shows: the first goal of the town in play that is not done and is ready.
   Events: 'goal:done' { id, town }. */
import { GOALS } from '../data/goals.js';
import { unlocked } from './economy.js';
import { towerOpen, isPit, towerAt, fitsSpot, towerCost, canPay } from './defense.js';
import { GOODS } from '../data/goods.js';
import { researchOpen } from './research.js';
import { canFound, nextTowns } from './empire.js';
import { TOWNS } from '../data/towns/index.js';

/* What a goal reads: a small view of one town. */
export function goalContext(game, town) {
  const sh = game.shared.goals || { visited: {} }, towers = town.towers || [], spots = town.def.board.spots;
  const free = pit => { for (let i = 0; i < spots.length; i++) if (isPit(town, i) === pit && !towerAt(town, i) && (pit || fitsSpot(town, i, 'crossbow'))) return i; return null; };
  const by = (better, filter = () => true) => { let b = null; for (const t of towers) if (filter(t) && (!b || better(t, b))) b = t; return b ? b.spot : null; };
  return {
    towers, won: !!town.won, bestWave: town.bestWave || 0, researchOpen: researchOpen(town),
    lv: id => town.level(id), unlocked: id => unlocked(town, id), open: kind => towerOpen(town, kind),
    built: kind => towers.some(t => t.kind === kind), pathed: () => towers.some(t => t.path),
    topLevel: () => towers.reduce((a, t) => Math.max(a, t.level), 0),
    called: () => !!(town.flags && town.flags.called),
    wonIn: id => !!(game.towns[id] && game.towns[id].won), inPlay: game.active === town.id,
    founded: id => !!game.towns[id], lvIn: (tid, id) => game.towns[tid] ? game.towns[tid].level(id) : 0, canFound: id => canFound(game, id), held: () => !!(town.waves && town.waves.hold), heldByPlayer: () => !!(town.waves && town.waves.hold && !town.waves.autoHold),
    researched: () => !!town.lab || Object.values(town.research || {}).some(n => n > 0),
    visited: id => !!sh.visited[id] || game.active === id,
    back: game.back, // the place the back button goes to (src/core/game.js)
    freeSpot: () => free(false), freePit: () => free(true),
    canBuild: kind => canPay(town, towerCost(town, kind)),
    // what is still missing to pay for a tower, as words that count down ("5 more coins and 3 more timber")
    shortText: kind => {
      const c = towerCost(town, kind), more = (n, name) => Math.ceil(n - 1e-9) + ' more ' + name, out = [];
      if (town.coins < c.coins) out.push(more(c.coins - town.coins, 'coins'));
      for (const [k, n] of Object.entries(c.goods)) { const have = town.goods[k] || 0; if (have < n) out.push(more(n - have, GOODS[k].name.toLowerCase())); }
      return out.join(' and ');
    },
    lowTower: () => by((a, b) => a.level < b.level),
    topTower: () => by((a, b) => a.level > b.level, t => !t.path),
  };
}

export const goalsOf = id => GOALS.filter(g => g.town === id);

/* Waves on hold (Evaluation 2, 2026-11-19): the newcomer bot held the Gulch's waves to save for Iron Ridge as the
   strip said, never resumed them, and the Ridge's vault fell while it was in the Gulch, so from about an hour in both
   towns sat on hold for two hours, the strip asking for a Toolsmith it could not open yet. So before any other goal the
   strip asks for Resume waves in the town in play (unless it holds to save for its next town), then sends the player
   to a town that lost while away. These are never marked done: they show while the waves are held. resume: the tap
   the bots make. */
export const RESUME = { id: 'resume', text: 'Tap Resume waves', resume: true, at: () => ({ el: '#holdWaves' }), done: () => false };
/* After a loss the lost card says to build more towers first (review of 2026.11.19-1), so the strip says the same. */
export const RESUME_LOST = { ...RESUME, text: 'Build more towers, then tap Resume waves' };
const goResume = id => {
  const name = (TOWNS[id] && TOWNS[id].name) || id;
  return { id: 'resume-' + id, away: true, text: 'Go to ' + name + ' and tap Resume waves', at: c => ({ el: c.back === id ? '#backBtn' : '#mapBtn', go: id }), done: () => false };
};
/* The town in play holds its waves for no reason the strip gave: not saving for, or about to found, the town it opens next. */
const heldHere = (game, town) => !!(town.waves && town.waves.hold && !town.won && !nextTowns(game).some(n => n.from === town.id && n.waveOk));
/* Another town that lost while the player was away and waits for them (Keep trying the boss off). */
const heldAway = game => Object.values(game.towns).find(t => t.id !== game.active && t.waves && t.waves.autoHold && t.lost && t.lost.away && !t.won
  && !(game.shared.auto && game.shared.auto[t.id] && game.shared.auto[t.id].retry));

/* The goal the strip shows for the town in play, or null when its goals are all done (or the strip is off).
   held false: leave out the Resume waves steps (the careful bots tap Resume waves by their own rules and read the
   strip only for what to build). */
/* A goal that takes the player to another town (review 2026-11-18: "Go to Copper Gulch and build a Smelter there"
   showed during a boss wave in the town in play). The play screen keeps such a goal off the strip during a boss wave. */
export const sendsAway = g => !!(g && (g.there || g.away));

export function goalNow(game, held = true) {
  const sh = game.shared.goals, town = game.town;
  if (!sh || sh.off || !town) return null;
  if (held && heldHere(game, town)) return town.waves.autoHold ? RESUME_LOST : RESUME;
  const away = held && heldAway(game);
  if (away) return goResume(away.id);
  let c = null;
  for (const g of GOALS) {
    if (g.town !== town.id || sh.done[g.id]) continue;
    c = c || goalContext(game, town);
    if (!g.ready || g.ready(c)) return g;
  }
  return null;
}

/* The words the strip shows for a goal: its text, or, for a goal with wait: kind while that tower can't be paid yet,
   what is still missing ("Wait for 5 more coins and 3 more timber, then tap a stone pad"), counting down as it comes. */
/* heldText: the words once the waves are held. need: coins the goal saves for; the screen adds have / need. */
export function goalText(game, town, g) {
  if (g.heldText && town.waves && town.waves.hold) return g.heldText;
  if (!g.wait) return g.text;
  const c = goalContext(game, town);
  return c.canBuild(g.wait) ? g.text : 'Wait for ' + c.shortText(g.wait) + ', then tap a stone pad';
}

/* Mark every goal done (for players already past the start; the save migration uses the list too). */
export const ALL_GOALS = () => GOALS.map(g => g.id);

export const goals = {
  id: 'goals',
  setup(game) { game.shared.goals = { done: {}, visited: {}, off: false }; },
  tick(dt, game) {
    const sh = game.shared.goals;
    if (!sh || sh.off) return;
    if (game.active && !sh.visited[game.active]) sh.visited[game.active] = true;
    for (const town of Object.values(game.towns)) {
      let c = null;
      for (const g of GOALS) {
        if (g.town !== town.id || sh.done[g.id]) continue;
        c = c || goalContext(game, town);
        if (g.done(c)) { sh.done[g.id] = true; game.bus.emit('goal:done', { id: g.id, town: town.id }); }
      }
    }
  },
};
