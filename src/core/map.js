/* The empire map (GDD.md, Empire map), worked out from the game: the sites it shows, each town's badges, the routes
   that carry goods between towns, and how fast goods and coins flow. Pure: no DOM, no three.js, no Math.random.
     mapSites(game)        every site: open towns and outposts, towns not open yet (surveyed land) and the Capital's site
     siteInfo(game, id, m) what a town's badges and card show: wave, vault, income, alert
     lockedRules(game, id) what a town not open yet takes, as rules the card lists
     mapRoutes(game)       links { from, to, goods } that have carried goods
     FlowMeter             samples coins earned and goods moved, by simulated time, into rates per second
     wagonsFor(rate)       how many wagons a route shows and how fast they roll */
import { TOWNS, TOWN_ORDER } from '../data/towns/index.js';
import { SITES, CAPITAL } from '../data/empire.js';
import { BUILDINGS } from '../data/buildings.js';
import { GOODS } from '../data/goods.js';
import { isOutpost, gridOf } from './economy.js';
import { canFound, nextTowns, deedsOf } from './empire.js';
import { capitalOpen, capitalNext, canFoundCapital } from './capital.js';
import { CAPITAL_DEF } from '../data/capital.js';
import { treeCalls } from './tree.js';
import { retryState } from './automation.js';
import { waitsAway, atWall } from './defense.js';
import { savingFor } from './goals.js';

/* Why a place wants the player now, or null. One source for the Map button's dot, the back button's dot, the map
   label's red word or dot and the goal strip's step to go there (clarity fix 5, one state one source):
     'lost'    it lost its vault or boss and holds its waves, and does not try again by itself;
     'hold'    the player held its waves, and no goal asks to save there;
     'stuck'   Keep trying the boss is on, but no tower here can go up a level by itself;
     'wait'    out of play with no tower, so its clock waits;
     'raided'  raiders broke in while the player was elsewhere, until the player looks. */
export function needsYou(game, id) {
  const t = game.towns[id];
  if (!t || !t.waves) return null;
  const r = retryState(game, t);
  if (r === 'stuck') return 'stuck';
  // a town at its wall (atWall) holds with no dot: the strip no longer sends the player back to resume it, and its card
  // says to upgrade its towers first (the Gulch's loss loop, PLAN.md M6a)
  if (t.waves.hold && r !== 'again' && r !== 'climb') return t.waves.autoHold ? (atWall(t) ? null : 'lost') : savingFor(game, t) ? null : 'hold';
  if (waitsAway(game, t)) return 'wait';
  if (game.active !== id && (t.breaches || 0) > ((t.flags && t.flags.breachSeen) || 0)) return 'raided';
  return null;
}
/* The Map button's dot: another place needs you, or something on the map wants a tap. */
export const mapDot = (game, here) => Object.keys(game.towns).some(id => id !== here && !!needsYou(game, id)) || mapCalls(game);

/* The map is open once a second town is, or a town to start is in sight (its Start card lives on the map). */
export const mapOpen = game => Object.keys(game.towns).length > 1 || nextTowns(game).length > 0;
/* Something on the map wants the player: a town ready to start, the Capital ready to build, or the Capital open with no
   contract running. */
export const mapCalls = game => nextTowns(game).some(n => n.ready) || canFoundCapital(game) || (capitalOpen(game) && !game.shared.capital.active) || treeCalls(game);

/* [{ id, at: [x, z], open, outpost, capital }] in the order towns open, the Capital's site first. */
export function mapSites(game) {
  const out = [{ id: 'capital', at: CAPITAL, open: capitalOpen(game), outpost: false, capital: true }];
  for (const id of TOWN_ORDER) {
    if (!SITES[id]) continue;
    out.push({ id, at: SITES[id], open: !!game.towns[id], outpost: TOWNS[id].kind === 'outpost', capital: false });
  }
  return out;
}

/* The goods a town's buildings make, in the goods list's order. */
export function makesOf(id) {
  const d = TOWNS[id], set = new Set(Object.keys(d.board.plots).map(p => BUILDINGS[p] && BUILDINGS[p].makes).filter(Boolean));
  return Object.keys(GOODS).filter(g => set.has(g));
}

/* What a town that is not open yet takes: [{ kind: 'wave', town, wave, done } | { kind: 'coins', coins, done } |
   { kind: 'deeds', deeds, have, done } (deeds the empire holds) | { kind: 'with', town } (it opens with that town) | { kind: 'win', town } (winning that outpost opens it) |
   { kind: 'later' }], and ready: it can be founded now. The Capital lists Iron Ridge's wave and the coins. */
export function lockedRules(game, id) {
  if (id === 'capital') {
    const f = CAPITAL_DEF.found, from = game.towns[f.from];
    return {
      rules: [{ kind: 'wave', town: f.from, wave: f.wave, done: !!from && (from.bestWave || 0) >= f.wave }, { kind: 'coins', coins: f.coins, done: !!from && from.coins + 1e-9 >= f.coins }],
      ready: canFoundCapital(game), seen: !!capitalNext(game),
    };
  }
  const d = TOWNS[id], f = d.found;
  if (f) {
    const from = game.towns[f.from];
    return {
      rules: [{ kind: 'wave', town: f.from, wave: f.wave, done: !!from && (from.bestWave || 0) >= f.wave },
        ...(f.deeds ? [{ kind: 'deeds', deeds: f.deeds, have: deedsOf(game), done: deedsOf(game) >= f.deeds }] : []),
        { kind: 'coins', coins: f.coins, done: !!from && from.coins + 1e-9 >= f.coins }],
      ready: canFound(game, id),
    };
  }
  const parent = TOWN_ORDER.find(t => TOWNS[t].outpost === id);
  if (parent) return { rules: [{ kind: 'with', town: parent }], ready: false };
  const opener = TOWN_ORDER.find(t => TOWNS[t].opens === id);
  if (opener) return { rules: [{ kind: 'win', town: opener }], ready: false };
  return { rules: [], ready: false };
}

/* A town's badges: { wave, best, won, vault (0 to 1), income (coins a second), inPlay, alert, short } where alert is
   'lost' (it lost its vault or its boss while away and holds its waves, and is not trying again by itself), 'retry' (Keep
   trying the boss is on and it waits for a tower to go up a level), 'retrying' (it plays back up to its boss), 'raided' (raiders broke in while the player
   was elsewhere, until the player goes there), 'vault' (its vault or stockpile is under half), 'short' (a workshop is short of goods; short names it and needs the
   input it has least of) or null. */
export function siteInfo(game, id, meter = null) {
  const t = game.towns[id];
  if (!t) return null;
  const v = t.vault || { hp: 1, max: 1 };
  const vault = v.max > 0 ? Math.max(0, Math.min(1, v.hp / v.max)) : 1;
  const short = Object.keys(t.starved || {}).find(b => t.starved[b] === true && t.level(b) > 0) || null;
  const ins = short && BUILDINGS[short] ? Object.entries(BUILDINGS[short].inputs || {}).filter(([g]) => !GOODS[g].grid || gridOf(t).share < 1) : [];
  const needs = ins.length ? ins.reduce((a, b) => ((t.goods[b[0]] || 0) / b[1] < (t.goods[a[0]] || 0) / a[1] ? b : a))[0] : null;
  return {
    wave: t.wave || 0, best: t.bestWave || 0, won: !!t.won, vault, inPlay: game.active === id,
    income: meter ? meter.income[id] || 0 : 0,
    alert: retryState(game, t) === 'again' ? 'retry' : retryState(game, t) === 'climb' ? 'retrying' : retryState(game, t) === 'stuck' || (t.waves && t.waves.autoHold) ? 'lost' : game.active !== id && (t.breaches || 0) > ((t.flags && t.flags.breachSeen) || 0) ? 'raided' : vault < .5 ? 'vault' : short ? 'short' : null, short, needs,
  };
}

/* What a town's waves are doing, the same words in every town (owner, 2026-11-20: "In map view it's hard to see the
   status of the waves in each city"): { state, timer, left, size, wave, raid }, where state is
     'fight'  a wave (or a won outpost's raid) is on the road: left raiders of size still to come or riding;
     'next'   counting down to the next wave: timer seconds;
     'raids'  a won outpost counting down to its next light raid (raid: seconds between raids);
     'hold'   its waves are held: by the player, or after a loss (needs: the player must go there; Keep trying the
              boss never holds, it plays the last wave it beat again);
     'wait'   out of play with no tower yet, so its clock waits for the player (src/core/defense.js, waitsAway).
   null for a place not open. */
export function siteState(game, id) {
  const t = game.towns[id];
  if (!t || !t.waves) return null;
  const ws = t.waves, raid = t.won ? (t.def.raid || 120) : 0, base = { wave: t.wave || 0, won: !!t.won, raid };
  if (ws.phase !== 'break') {
    const left = (ws.queue || []).length + (ws.foes || []).filter(f => f.hp > 0).length;
    return { ...base, state: 'fight', left, size: Math.max(left, ws.size || 0), timer: 0 };
  }
  if (ws.hold) return { ...base, state: 'hold', needs: !!needsYou(game, id), retry: retryState(game, t) === 'again', timer: ws.timer, left: 0, size: 0 };
  if (waitsAway(game, t)) return { ...base, state: 'wait', needs: true, timer: ws.timer, left: 0, size: 0 };
  return { ...base, state: t.won ? 'raids' : 'next', timer: Math.max(0, ws.timer), left: 0, size: 0 };
}

/* The outposts that make a good (an outpost's goods go to the towns that use them). */
const outpostsMaking = (game, g) => Object.values(game.towns).filter(o => isOutpost(o) && makesOf(o.id).includes(g)).map(o => o.id);

/* Links that have carried goods: town to town by route (to.shipped) and outpost to town (to.drawn).
   [{ key: 'from>to', from, to, goods: [good], total }] sorted by key. */
export function mapRoutes(game) {
  const links = new Map();
  const add = (from, to, g, n) => {
    if (!(n > 0) || !game.towns[from] || from === to) return;
    const key = from + '>' + to, l = links.get(key) || { key, from, to, goods: [], total: 0 };
    if (!l.goods.includes(g)) l.goods.push(g);
    l.total += n; links.set(key, l);
  };
  for (const to of Object.values(game.towns)) {
    if (isOutpost(to)) continue;
    for (const [g, n] of Object.entries(to.shipped || {})) add(GOODS[g] && GOODS[g].town, to.id, g, n);
    for (const [g, n] of Object.entries(to.drawn || {})) {
      const from = outpostsMaking(game, g);
      for (const o of from) add(o, to.id, g, n / from.length);
    }
  }
  return [...links.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/* Coins earned by each town and goods moved on each link, as rates per second of simulated time. Sampled every
   SAMPLE simulated seconds and smoothed, so a catch-up after time away counts at its real pace. A town whose charter
   starts it over (its lifetime drops) starts again from there. */
export const SAMPLE = 2;
export class FlowMeter {
  constructor() { this.last = null; this.income = {}; this.flow = {}; }
  snap(game) {
    const life = {}, moved = {};
    for (const [id, t] of Object.entries(game.towns)) life[id] = t.lifetime || 0;
    for (const l of mapRoutes(game)) moved[l.key] = l.total;
    return { t: game.clock.t, life, moved };
  }
  /* Call as often as you like; it samples once SAMPLE simulated seconds have passed. Returns true when it did. */
  update(game) {
    if (this.last && game.clock.t - this.last.t < SAMPLE) return false; // (the snapshot walks every route: not every frame)
    const now = this.snap(game);
    if (!this.last) { this.last = now; return false; }
    const secs = now.t - this.last.t;
    // a short wait weighs less than a long one (a catch-up of an hour replaces the old rate outright)
    const k = Math.min(1, secs / (SAMPLE * 4));
    const rate = (a, b) => Math.max(0, (a - (b || 0)) / secs);
    for (const [id, n] of Object.entries(now.life)) {
      const was = this.last.life[id];
      const r = was === undefined || n < was ? 0 : rate(n, was);
      this.income[id] = this.income[id] === undefined || n < (was ?? 0) ? r : this.income[id] + (r - this.income[id]) * k;
    }
    for (const [key, n] of Object.entries(now.moved)) {
      const r = rate(n, this.last.moved[key]);
      this.flow[key] = this.flow[key] === undefined ? r : this.flow[key] + (r - this.flow[key]) * k;
    }
    for (const key of Object.keys(this.flow)) if (!(key in now.moved)) delete this.flow[key];
    this.last = now;
    return true;
  }
  get total() { return Object.values(this.income).reduce((a, b) => a + b, 0); }
}

/* A route's wagons: none while nothing moves, then one more for each doubling of the goods a second, up to 6; they
   roll faster as the route gets busier. speed is in map units a second. */
export function wagonsFor(rate) {
  if (!(rate > .01)) return { count: 0, speed: 0 };
  return { count: Math.min(6, 1 + Math.floor(Math.log2(1 + rate))), speed: .9 + Math.min(1.1, rate * .08) };
}
