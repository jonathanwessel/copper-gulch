/* The explainer cards (src/data/explainers.js): one at a time, a dimmed screen with a spotlight on the thing being
   explained and a short card with "Got it". The game waits while a card is open. Each card shows once; what has been
   seen is kept in the save (game.shared.seen). An explainer with `town` shows only in that town. One with `go` (a town
   id) and `button` gets a second button that takes the player there. startCoach returns
   { frame(dt), current, dismiss(), skipAll(), destroy() }. */
import { EXPLAINERS } from '../data/explainers.js';
import { lostBoss, autoOpen, autoOf } from '../core/automation.js';
import { unlocked } from '../core/economy.js';
import { BUILDINGS } from '../data/buildings.js';
import { charterOffered, perksToPick } from '../core/charter.js';
import { isOutpost } from '../core/economy.js';
import { towerIn } from '../core/defense.js';
import { tabs, dots } from '../core/reveal.js';
import { nextTowns } from '../core/empire.js';
import { capitalNext, capitalOpen } from '../core/capital.js';
import { foundCost } from '../core/tree.js';
import { NODE_COST } from '../data/institutions.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* What explainers read: a small view of the town. */
export function helper(town, game = null) {
  const ws = town.waves || {}, levels = Object.entries(town.buildings);
  const top = levels.reduce((a, b) => (b[1] > a[1] ? b : a), ['camp', 0]);
  const outposts = game ? Object.values(game.towns).filter(isOutpost) : [];
  return {
    id: town.id, outpost: isOutpost(town), tabs: game ? tabs(game, town) : {}, dots: game ? dots(game, town) : { towns: {} }, won: !!town.won, towns: game ? Object.keys(game.towns).length : 1,
    outpostWon: outposts.some(o => o.won), can: kind => towerIn(town, kind),
    t: town.t, towers: town.towers || [], flags: town.flags || {}, phase: ws.phase, wave: town.wave, vault: town.vault,
    autoHold: !!ws.autoHold, // this town lost while away and holds its waves (src/core/defense.js, fall)
    // it lost a boss wave and Keep trying the boss could take the next try (src/core/automation.js)
    bossLost: !!game && lostBoss(town) && autoOpen(game, 'retry') && !autoOf(game, town).retry,
    // another town (not a won outpost) with towers keeps fighting out of sight
    awayFighting: !!game && Object.values(game.towns).some(o => o !== town && !o.won && (o.towers || []).length && o.waves && !o.waves.hold),
    breaches: town.breaches || 0, made: town.made || {}, bestWave: town.bestWave || 0, anyLevel: top[1], topBuilding: top[0],
    unlocked: id => unlocked(town, id), level: id => town.level(id),
    back: game ? game.back : null, // the place the back button goes to
    next: game ? nextTowns(game).map(n => n.id) : [], // towns in sight but not founded (src/core/empire.js)
    capitalSight: !!game && !!capitalNext(game), capitalOpen: !!game && capitalOpen(game), // src/core/capital.js
    // the Capital can found an institution or buy an upgrade (src/core/tree.js)
    treeReady: !!game && capitalOpen(game) && !!game.shared.tree && (game.shared.purse.coins >= foundCost(game) || (game.shared.capital.influence >= NODE_COST[0] && game.shared.tree.founded.length > 0)),
    starved: Object.keys(town.starved || {}).find(id => town.level(id) > 0) || null,
    firstPit: town.def && town.def.board && town.def.board.far < town.def.board.spots.length ? town.def.board.far : null,
    // a building whose good the town is holding back for towers right now
    keptPlot: Object.keys(town.buildings).find(id => town.level(id) > 0 && town.def && town.def.board && town.def.board.plots[id] && BUILDINGS[id] && ((town.keep || {})[BUILDINGS[id].makes] || 0) > 0 && (town.goods[BUILDINGS[id].makes] || 0) >= town.keep[BUILDINGS[id].makes] - 1e-6 && town.sell[BUILDINGS[id].makes] !== false) || null,
    // a building on the board that can get a foreman, while the town has none yet
    foremanPlot: Object.keys(town.foremen || {}).length ? null : Object.keys(town.buildings).find(id => town.level(id) >= 10 && town.def && town.def.board && town.def.board.plots[id]) || null,
    offered: !!(game && game.shared.charter && charterOffered(game)), toPick: game && game.shared.charter ? perksToPick(game) : 0,
    drew: Object.keys(town.flags || {}).some(k => k.startsWith('drew:')), // the town has drawn goods from an outpost
    record: town.record || 0, oldGround: town.wave <= (town.record || 0) && (town.record || 0) > 0,
    // a tower of each kind on the board: kind -> spot (the first one built)
    kinds: Object.fromEntries([...(town.towers || [])].reverse().map(t => [t.kind, t.spot])),
    towerAtLevel: L => { const t = (town.towers || []).find(x => x.level === L); return t ? t.spot : null; },
  };
}

/* locate(target) gives a screen point { x, y } for a 3D target, or null. */
export function startCoach({ game, town, root, locate = () => null, pause = () => {}, onSeen = () => {}, onGo = () => {}, off = false }) {
  const seen = game.shared.seen || (game.shared.seen = {});
  let cur = null, wait = 1.2, acc = 0;
  const layer = el('div', 'coach'); layer.hidden = true; layer.id = 'coach';
  const hole = el('div', 'hole'), card = el('div', 'coachcard'), title = el('b'), text = el('p'), ok = el('button', 'btn primary', 'Got it');
  const go = el('button', 'btn primary', ''), btns = el('div', 'coachbtns');
  ok.id = 'coachOk'; go.id = 'coachGo'; go.hidden = true; btns.append(ok, go); card.append(title, text, btns); layer.append(hole, card); root.append(layer);
  ok.addEventListener('click', () => api.dismiss());
  go.addEventListener('click', () => { const to = cur && cur.e.go; api.dismiss(); if (to) onGo(to); });

  function show(e) {
    cur = { e }; title.textContent = e.title; text.textContent = e.text; layer.hidden = false; layer.dataset.id = e.id;
    go.hidden = !e.go; go.textContent = e.button || ''; ok.textContent = e.go ? 'Stay here' : 'Got it'; ok.classList.toggle('primary', !e.go);
    pause(true); place();
  }
  function place() {
    const h = helper(town, game), target = cur.e.at ? cur.e.at(h) : null;
    let r = null;
    if (target && target.el) { const n = document.querySelector(target.el); if (n && n.offsetParent !== null) { const b = n.getBoundingClientRect(); r = { x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 }; } }
    else if (target) { const p = locate(target); if (p) r = { x: p.x - 48, y: p.y - 48, w: 96, h: 96 }; }
    hole.hidden = !r;
    if (r) Object.assign(hole.style, { left: Math.round(r.x) + 'px', top: Math.round(r.y) + 'px', width: Math.round(r.w) + 'px', height: Math.round(r.h) + 'px' });
    // the card goes in the half of the screen away from the spotlight
    const low = r && r.y + r.h / 2 > innerHeight / 2;
    card.classList.toggle('top', !!low);
  }
  const api = {
    get current() { return cur ? cur.e.id : null; },
    frame(dt) {
      if (off) return;
      if (cur) { place(); return; }
      if ((wait -= dt) > 0 || (acc += dt) < .25) return;
      acc = 0;
      const h = helper(town, game), next = EXPLAINERS.find(e => !seen[e.id] && (!e.town || e.town === h.id) && e.when(h));
      if (next) show(next);
    },
    dismiss() {
      if (!cur) return;
      seen[cur.e.id] = true; cur = null; layer.hidden = true; pause(false); wait = 1.2; onSeen();
    },
    /* Mark every card seen (for players who know the game, and for tools). */
    skipAll() { for (const e of EXPLAINERS) seen[e.id] = true; api.dismiss(); },
    /* Take the cards down without marking the open one seen (switching towns); it shows again later. */
    destroy() { off = true; if (cur) { cur = null; pause(false); } layer.remove(); },
  };
  return api;
}
