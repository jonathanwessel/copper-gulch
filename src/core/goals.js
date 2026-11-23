/* The goal strip (GDD.md, Onboarding): one short goal at a time through the first 30 minutes (src/data/goals.js).
   An eighth system: every step it marks the goals whose done() has come true, in any order, and remembers the towns
   the player has been to. What is done is kept in the save (game.shared.goals = { done, visited, off }).
   goalNow(game) is the goal the strip shows: the first goal of the town in play that is not done and is ready.
   Events: 'goal:done' { id, town }. */
import { GOALS } from '../data/goals.js';
import { unlocked, missing, cost, isOutpost } from './economy.js';
import { towerOpen, isPit, towerAt, fitsSpot, towerCost, canPay, bossWave } from './defense.js';
import { FOES } from '../data/foes.js';
import { GOODS } from '../data/goods.js';
import { BUILDINGS } from '../data/buildings.js';
import { CAPITAL_DEF } from '../data/capital.js';
import { researchOpen } from './research.js';
import { canFound, nextTowns, deedsOf } from './empire.js';
import { capitalOpen, capitalNext as capitalAhead } from './capital.js';
import { treeOf, foundCost } from './tree.js';
import { TOWNS, TOWN_ORDER } from '../data/towns/index.js';

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
    upTo: lvl => by((a, b) => a.level > b.level, t => t.level < lvl), // the highest tower still under that level
    // the tower whose next level costs the fewest coins: the quickest help in a fight
    cheapUp: () => by((a, b) => towerCost(town, a.kind, a.level).coins < towerCost(town, b.kind, b.level).coins),
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
  return { id: 'resume-' + id, away: true, text: 'Tap Map, ' + name + ', then tap Resume waves', at: c => ({ el: c.back === id ? '#backBtn' : '#mapBtn', go: id }), done: () => false };
};
/* The Capital's save is on: the empire's next step is the Capital and only its coins are missing, or it can be built
   now. Returns that step, or null. */
const capitalNext = game => { const s = nextStep(game); return s && s.next === 'capital' && (s.need || s.id.endsWith(':go')) ? s : null; };
/* A town saving for the Capital: the town that pays for it once past its wave, and while the save is on, every town
   but an outpost. A player who holds its waves to save is not asked to resume them until the Capital stands (clarity
   fix 3), and neither is one that lost while saving (clarity fix 3b part 2: on seed 2 "Build more towers, then tap
   Resume waves" in the Gulch spent the save on its towers). */
export const capitalSaving = (game, town) => {
  const f = CAPITAL_DEF.found;
  if (!town || capitalOpen(game)) return false;
  if (town.id === f.from) return (town.bestWave || 0) >= f.wave;
  // once the Capital is in sight, a town that lost while away stays held until it stands (clarity fix 3b part 2b: on
  // seed 2 the Gulch lost at its own wall four times during the Ridge's climb to wave 30, and each time the strip sent
  // the newcomer there to spend the climb's coins on the Gulch's towers)
  if (!isOutpost(town) && town.waves && town.waves.autoHold && town.lost && town.lost.away && capitalAhead(game)) return true;
  return !isOutpost(town) && !!capitalNext(game);
};
/* The town in play holds its waves for no reason the strip gave: not saving for, or about to found, the town it opens
   next or the Capital. */
export const savingFor = (game, town) => nextTowns(game).some(n => n.from === town.id && n.waveOk) || capitalSaving(game, town);
// while the Capital's save is on, a town held after a loss stays held too: its waves would only cost the save
const heldHere = (game, town) => !!(town.waves && town.waves.hold && !town.won && !nextTowns(game).some(n => n.from === town.id && n.waveOk) && !(capitalSaving(game, town) && (!town.waves.autoHold || capitalNext(game))));
/* Another town that lost while the player was away and waits for them (Keep trying the boss off). */
const heldAway = game => Object.values(game.towns).find(t => t.id !== game.active && t.waves && t.waves.autoHold && t.lost && t.lost.away && !t.won
  && !(game.shared.auto && game.shared.auto[t.id] && game.shared.auto[t.id].retry) && !capitalSaving(game, t));

/* The goal the strip shows for the town in play, or null when its goals are all done (or the strip is off).
   held false: leave out the Resume waves steps (the careful bots tap Resume waves by their own rules and read the
   strip only for what to build). */
/* A goal that takes the player to another town (review 2026-11-18: "Go to Copper Gulch and build a Smelter there"
   showed during a boss wave in the town in play). The play screen keeps such a goal off the strip during a boss wave. */
export const sendsAway = g => !!(g && (g.there || g.away));
/* The first step of the Capital's save in the town that pays for it (clarity fix 3b part 2). */
export const CAPITAL_HOLD = { id: 'next:capital:hold', next: 'capital', text: 'Tap Hold waves while you save for the Capital', at: () => ({ el: '#holdWaves' }), done: () => false };

/* A boss fight in the town in play with few hits left (clarity fix 5; review 5: "2 hearts left in a boss fight while the
   strip talks about Iron Ridge"): the strip stays on the fight and names a tap that helps now, the tower whose next
   level costs the fewest coins. Never marked done: it goes when the fight does. */
export const FIGHT_LOW = .4;
export const bossFight = (game, town) => !!town && game.active === town.id && !town.won && !!town.waves && town.waves.phase !== 'break'
  && bossWave(town, town.wave) && (town.towers || []).length > 0 && town.vault.hp <= FIGHT_LOW * town.vault.max;
const bossNameOf = town => ((FOES[(town.def && town.def.boss) || 'wagon'] || FOES.wagon).name).toLowerCase();
/* spot: the tower the town's own goal names, so the strip never asks for two towers in turn (on seed 1 the fight's
   cheapest tower took the coins saved for the goal's level 15); else the cheapest to raise. */
export const fightStep = (town, spot = null) => ({ id: 'fight', fight: true, text: 'Stop the ' + bossNameOf(town) + '. Tap a tower and upgrade it', at: c => ({ tower: spot != null ? spot : c.cheapUp() }), done: () => false });

/* The tower the town's own next goal names, or null. */
function ownTower(game, town) {
  const sh = game.shared.goals; let c = null;
  for (const g of GOALS) {
    if (g.town !== town.id || sh.done[g.id]) continue;
    c = c || goalContext(game, town);
    if (g.ready && !g.ready(c)) continue;
    if (g.away || g.there || typeof g.at !== 'function') return null;
    try { const at = g.at(c) || {}; return at.tower != null ? at.tower : null; } catch (e) { return null; }
  }
  return null;
}

export function goalNow(game, held = true) {
  const sh = game.shared.goals, town = game.town;
  if (!sh || sh.off || !town) return null;
  if (held && heldHere(game, town)) return town.waves.autoHold ? RESUME_LOST : RESUME;
  if (held && bossFight(game, town)) return fightStep(town, ownTower(game, town));
  // the Capital comes first once only its coins are missing (clarity fix 3): the newcomer of seed 1 reached the Ridge's
  // wave 30 at 93 min and then followed the Ridge's own goals (a Rolling Mill to level 5 for 23 minutes), which spend
  // the same purse, and never saw the Capital's count. Not in an outpost still being won, and not for the careful bots
  // (held false), which save for it by their own rule. No step asks to hold the waves for it: tried, the newcomer of
  // seed 1 then went to the Gulch with the Ridge held and never came back (190 minutes with nothing new).
  // It also comes before going to resume another town that lost while away (clarity fix 3b part 2): on seed 2 the
  // strip sent the newcomer to the Gulch five times during the save, where "Build more towers, then tap Resume waves"
  // spent 124K of the 130K it earned, and the save took 35 minutes. A town on hold loses nothing more, and the Map's
  // dot still shows it; the strip sends the player back there once the Capital stands.
  // In every town but an outpost the save starts with Hold waves, as the save for Iron Ridge does: climbing on while
  // saving, the newcomer of seed 1 lost its vault every 7 minutes at the Ridge's waves 37-42 and spent 712K on towers
  // before the Capital stood at 216 min, and on seed 2 it sat in the Gulch for 167 minutes doing the same there. (Fix 3 tried this step before the order above and dropped it, since a resume elsewhere
  // then took the player away for good.)
  if (held && !(isOutpost(town) && !town.won)) {
    const cap = capitalNext(game);
    if (cap) return cap.need && !isOutpost(town) && !(town.waves && town.waves.hold) ? CAPITAL_HOLD : cap;
  }
  const away = held && heldAway(game);
  if (away) return goResume(away.id);
  let c = null;
  for (const g of GOALS) {
    if (g.town !== town.id || sh.done[g.id]) continue;
    c = c || goalContext(game, town);
    if (!g.ready || g.ready(c)) return stepFor(game, town, g);
  }
  return firstInstitution(game) || nextStep(game);
}

/* Once the Capital stands, the empire's next steps are its first contract, then its first building (clarity fix 3b part
   2: nothing sent the newcomer there, so it never took a contract or built one, and the 20 minutes after the Capital had
   nothing new). A contract is free to take and its goods go by themselves; the building counts its price as have / need,
   and the Capital's card has a Buildings tab with a Build button for each. Never marked done. */
export function firstInstitution(game) {
  const tr = game.shared.tree, cp = game.shared.capital;
  if (!capitalOpen(game) || !tr || tr.founded.length) return null;
  // while the building's coins are short, a contract always runs: each one pays coins toward it (clarity fix 3b part
  // 2b: after the first contract the newcomer saved 10-12 minutes for 50K with nothing new)
  const short = game.shared.purse.coins + 1e-9 < foundCost(game);
  if (cp && !cp.active && (!cp.filled || short) && cp.offers.length) return { id: 'next:contract', next: 'contract', text: 'Tap Map, then tap the Capital and take a contract', at: () => ({ el: '#mapBtn' }), done: () => false };
  return { id: 'next:institution', next: 'institution', text: 'Tap Map, then add a building to the Capital', need: foundCost(game), at: () => ({ el: '#mapBtn' }), done: () => false };
}

/* The clarity pass (PLAN.md M6a, 2026.11.23-2): a newcomer's play showed goals the player could not act on for 15-25
   minutes (a Smelter with no count of the 500 coins it takes, a Mortar whose bricks no building made, a Toolsmith lot
   still locked) and a blank strip from about an hour in. So a goal names the step that can be taken now:
     - a goal to build a new lot carries its price as need (the strip adds have / need); an upgrade goal does not,
     since its level and one level's price side by side read as one count (review of 2026.11.23-2: "level 3 · 172 / 12");
     - a locked lot asks for the level that opens it ("Tap the Sawmill and upgrade it to level 10 to open the Toolsmith");
     - a tower goal whose goods no building here makes yet asks for that building first.
   A derived step keeps the goal's done and gets its own id, so the strip changes as each step is taken. */
const bname = id => (BUILDINGS[id] && BUILDINGS[id].name) || id;
function stepFor(game, town, g, depth = 0) {
  if (depth > 4 || !g.at || g.away || g.there || g.resume) return g;
  const c = goalContext(game, town);
  let at = null; try { at = g.at(c) || {}; } catch (e) { return g; }
  if (at.plot && BUILDINGS[at.plot]) {
    const m = missing(town, at.plot)[0];
    if (m) {
      const text = (town.level(m.id) > 0 ? 'Tap the ' + bname(m.id) + ' and upgrade it to level ' + m.level : 'Tap the ' + bname(m.id) + ' lot, then tap Build') + ' to open the ' + bname(at.plot);
      return stepFor(game, town, { id: g.id + '>' + m.id, town: g.town, text, done: g.done, step: true, at: () => ({ plot: m.id }) }, depth + 1);
    }
    return g.need || town.level(at.plot) > 0 ? g : { ...g, need: cost(town, at.plot) };
  }
  if (g.kind && at.spot != null) {
    const tc = towerCost(town, g.kind, 0);
    for (const [good, n] of Object.entries(tc.goods || {})) {
      if ((town.goods[good] || 0) >= n || ((town.def && town.def.imports) || []).includes(good)) continue;
      const makers = ((town.def && town.def.buildings) || []).filter(id => BUILDINGS[id] && BUILDINGS[id].makes === good);
      if (!makers.length || makers.some(id => town.level(id) > 0)) continue;
      return stepFor(game, town, { id: g.id + '>' + makers[0], town: g.town, text: 'Tap the ' + bname(makers[0]) + ' lot, then tap Build', done: g.done, step: true, at: () => ({ plot: makers[0] }) }, depth + 1);
    }
  }
  return g;
}

/* When the town in play has no goal left, the strip shows the empire's next step: the next town or the Capital, the
   one that takes the lowest wave, with what it still needs (a wave, deeds, coins) counted as have / need by meter(game).
   These are never marked done; they change as each need is met. */
/* The strip's count for a goal with a meter: "wave 9 / 30", "2 / 5 deeds". */
/* A wave count shows only in the town that must climb, beside its own wave bar: in another town "9 / 30" and then
   "wave 9 / 30" were both read as that town's wave (two reviews of 2026.11.23-2), so there the line alone says it. */
export const meterWords = (g, game) => { if (g.meterTown && g.meterTown !== game.active) return ''; const [a, b] = g.meter(game); return (g.pre || '') + Math.floor(a) + ' / ' + b + (g.post || ''); };
export function nextStep(game) {
  const out = [];
  for (const id of TOWN_ORDER) {
    const f = TOWNS[id] && TOWNS[id].found;
    if (!f || game.towns[id] || !game.towns[f.from]) continue;
    out.push({ id, name: TOWNS[id].name, f });
  }
  const cf = CAPITAL_DEF.found;
  if (!capitalOpen(game) && game.towns[cf.from]) out.push({ id: 'capital', name: 'the ' + CAPITAL_DEF.name, f: cf });
  if (!out.length) return null;
  const s = out.sort((a, b) => a.f.wave - b.f.wave)[0], from = game.towns[s.f.from], fromName = TOWNS[s.f.from].name;
  const best = () => (game.towns[s.f.from] || from).bestWave || 0;
  // the Capital's card says Build the Capital and a town's card says Start, so the strip uses the same word (fresh-eyes read of 2026.11.23-4)
  const verb = s.id === 'capital' ? 'build' : 'open';
  // the count names what it counts ("wave 9 / 30"): a bare "9 / 30" in another town read as that town's wave (review of 2026.11.23-2)
  // in another town the step sends the player to the town that must climb (clarity fix 3: the newcomer of seed 1 sat
  // in the Gulch for 2 hours under "Reach wave 30 in Iron Ridge" while the Ridge climbed slowly in the background)
  if (best() < s.f.wave && game.active !== s.f.from) return { id: 'next:' + s.id + ':there', next: s.id, away: true, text: 'Tap Map, ' + fromName + ', then reach wave ' + s.f.wave + ' there to ' + verb + ' ' + s.name, at: () => ({ el: game.back === s.f.from ? '#backBtn' : '#mapBtn', go: s.f.from }), done: () => false };
  if (best() < s.f.wave) return { id: 'next:' + s.id + ':wave', next: s.id, text: 'Reach wave ' + s.f.wave + ' in ' + fromName + ' to ' + verb + ' ' + s.name, meter: () => [best(), s.f.wave], pre: 'wave ', meterTown: s.f.from, done: () => false };
  if (s.f.deeds && deedsOf(game) < s.f.deeds) return { id: 'next:' + s.id + ':deeds', next: s.id, text: 'Sign a charter in Perks for the deeds to ' + verb + ' ' + s.name, meter: g2 => [deedsOf(g2), s.f.deeds], post: ' deeds', done: () => false };
  if (from.coins + 1e-9 < s.f.coins) return { id: 'next:' + s.id + ':coins', next: s.id, text: 'Save coins to ' + verb + ' ' + s.name, need: s.f.coins, at: () => ({ el: '#coins' }), done: () => false };
  return { id: 'next:' + s.id + ':go', next: s.id, text: 'Tap Map, then tap ' + (s.id === 'capital' ? 'the Capital' : s.name) + (s.id === 'capital' ? ' to build it' : ' to start it'), at: () => ({ el: '#mapBtn' }), done: () => false };
}

/* Saving for a coin goal (clarity fix 2, PLAN.md M6a): a newcomer saw "136 / 500" for 20 minutes and spent every coin
   as it came, since nothing said the goal was near if they saved. The strip adds how long is left at the empire's income
   over the last minute, and the newcomer bot saves the same way. One rate for both: earnRate. */
export const EARN_WINDOW = 60, READY_MAX = 36000;
/* Coins a second the empire earned over the last EARN_WINDOW seconds of play; hist is the caller's own list. */
export function earnRate(game, hist, span = EARN_WINDOW) {
  const t = game.stats.steps * .25, e = game.earned;
  if (hist.length && (e < hist[hist.length - 1][1] || t < hist[hist.length - 1][0])) hist.length = 0; // a charter or a load starts it over
  hist.push([t, e]);
  while (hist.length > 2 && t - hist[1][0] >= span) hist.shift();
  const [t0, e0] = hist[0];
  return t - t0 >= 5 ? Math.max(0, (e - e0) / (t - t0)) : 0;
}
/* Seconds until have reaches need at perSec, or null (ready already, or nothing comes in). */
export const readyIn = (have, need, perSec) => need > have + 1e-9 && perSec > 0 ? (need - have) / perSec : null;
/* "about 4 min to go": the time left to the goal's count. Whole minutes (it changes at most once a minute), hours and
   minutes past an hour in steps of 5 minutes, "over 10 hours to go" past that; "" when there is no time to show. The
   first words, "ready in about 1:20", were read as having no subject and "over an hour" as too vague to act on (review
   of 2026.11.23-3), so the time counts down to the coins the strip just showed. */
export function readyWords(s) {
  if (s == null) return '';
  if (s < 60) return 'under a minute to go';
  if (s < 3600) return 'about ' + Math.ceil(s / 60) + ' min to go';
  if (s > READY_MAX) return 'over 10 hours to go';
  const m = Math.ceil(s / 300) * 5, h = Math.floor(m / 60), r = m % 60;
  return 'about ' + h + ' h' + (r ? ' ' + r + ' min' : '') + ' to go';
}

/* The words the strip shows for a goal: its text, or, for a goal with wait: kind while that tower can't be paid yet,
   what is still missing ("Wait for 5 more coins and 3 more timber, then tap a stone pad"), counting down as it comes. */
/* heldText: the words once the waves are held. need: coins the goal saves for; the screen adds have / need. */
export function goalText(game, town, g) {
  if (g.heldText && town.waves && town.waves.hold) return g.heldText;
  if (!g.wait) return viaBack(game, town, g);
  const c = goalContext(game, town);
  return c.canBuild(g.wait) ? g.text : 'Wait for ' + c.shortText(g.wait) + ', then tap a stone pad';
}

/* A goal that sends the player to the place the back button goes to names that button, so the strip and the lit
   button agree (review of 2026.11.20-11: "Tap Map, Copper Gulch, then build a Smelter" beside a lit ◂ Copper Gulch).
   The back button plays there at once, so "then Play Copper Gulch" drops out. */
function viaBack(game, town, g) {
  // "Tap Map, then tap Pine Hollow": the map card's Play button is the last step, so the strip never repeats it
  // (review of 2026.11.23-6: "then Play Pine Hollow" above a card with Play)
  const short = /^Tap Map, then tap ([^,]+)$/.exec(g.text || '');
  if (short && typeof g.at === 'function') {
    const at = g.at(goalContext(game, town)), t = at && TOWNS[at.go];
    return at && at.el === '#backBtn' ? 'Tap ◂ ' + ((t && (t.short || t.name)) || short[1]) : g.text;
  }
  const m = /^Tap Map, ([^,]+), then (.+)$/.exec(g.text || '');
  if (!m || typeof g.at !== 'function') return g.text;
  const at = g.at(goalContext(game, town));
  if (!at || at.el !== '#backBtn') return g.text;
  const t = TOWNS[at.go], label = '◂ ' + ((t && (t.short || t.name)) || m[1]);
  return /^Play /.test(m[2]) ? 'Tap ' + label : 'Tap ' + label + ', then ' + m[2];
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
