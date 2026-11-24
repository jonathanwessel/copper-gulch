/* The explainer cards (src/data/explainers.js): one at a time, a dimmed screen with a spotlight on the thing being
   explained and a short card with "Got it". The game waits while a card is open. Each card shows once; what has been
   seen is kept in the save (game.shared.seen). An explainer with `town` shows only in that town. One with `go` (a town
   id) and `button` gets a second button that takes the player there. startCoach returns
   { frame(dt), current, dismiss(), skipAll(), destroy() }.
   The speaker button at the top right reads the card aloud (src/audio/speech.js, on-device voices only) and a second
   tap stops it. It is hidden when the device has no such voice. With Read cards aloud on (readAuto()), each new card
   reads itself. Speech stops when the card closes or the coach is taken down (switching places). */
import { sayable } from '../audio/speech.js';
import { EXPLAINERS } from '../data/explainers.js';
import { FOES } from '../data/foes.js';
import { militia } from '../core/arms.js';
import { lostBoss, autoOpen, autoOf } from '../core/automation.js';
import { unlocked } from '../core/economy.js';
import { BUILDINGS } from '../data/buildings.js';
import { charterOffered, perksToPick } from '../core/charter.js';
import { isOutpost } from '../core/economy.js';
import { towerIn, normalTowers, crowdOf, forkNext, foeStatus } from '../core/defense.js';
import { isPitSpot } from '../data/towns/index.js';
import { bossName } from './lost.js';
import { tabs, dots } from '../core/reveal.js';
import { nextTowns } from '../core/empire.js';
import { capitalNext, capitalOpen } from '../core/capital.js';
import { foundCost } from '../core/tree.js';
import { NODE_COST } from '../data/institutions.js';
import { ordersOf } from '../core/orders.js';
import { cardDue, playTime } from '../core/cards.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* What explainers read: a small view of the town. */
export function helper(town, game = null) {
  const ws = town.waves || {}, levels = Object.entries(town.buildings);
  const top = levels.reduce((a, b) => (b[1] > a[1] ? b : a), ['camp', 0]);
  const outposts = game ? Object.values(game.towns).filter(isOutpost) : [];
  return {
    id: town.id, boss: bossName(town), outpost: isOutpost(town), tabs: game ? tabs(game, town) : {}, dots: game ? dots(game, town) : { towns: {} }, won: !!town.won, towns: game ? Object.keys(game.towns).length : 1,
    outpostWon: outposts.some(o => o.won), can: kind => towerIn(town, kind),
    t: town.t, towers: town.towers || [], flags: town.flags || {}, phase: ws.phase, wave: town.wave, vault: town.vault,
    autoHold: !!ws.autoHold, // this town lost while away and holds its waves (src/core/defense.js, fall)
    // it lost a boss wave and Keep trying the boss could take the next try (src/core/automation.js)
    crowded: normalTowers(town) >= crowdOf(town), // a new tower here now costs more (src/core/defense.js, crowdFactor)
    towerCount: normalTowers(town),
    // a raider out of its entrance, for the raider card's explainer: one with an effect on it when there is one
    foeOut: (() => {
      const B = town.def && town.def.board, hide = [(B && B.entrance && B.entrance.hide) || 0, (B && B.river && B.river.entrance && B.river.entrance.hide) || 0];
      const out = (ws.foes || []).filter(f => f.hp > 0 && f.s > hide[f.lane || 0] + 1.5);
      if (!out.length) return null;
      const fx = out.find(f => foeStatus(town, f).effects.length);
      return { id: (fx || out[0]).id, fx: !!fx };
    })(),
    // a building whose workers are out on the road (Call to arms), for the workers' card explainer
    workerOut: town.arms && town.arms.t > 1 ? (militia(town)[0] || {}).id || null : null,
    // a boss on the road, with its bar showing, for the boss bar's explainer
    bossUp: (ws.foes || []).some(f => FOES[f.kind] && FOES[f.kind].boss && f.hp > 0) && (typeof document === 'undefined' || !!(document.getElementById('bossBar') && !document.getElementById('bossBar').hidden)),
    autoResearch: !!game && autoOpen(game, 'research'), // the University stands: Auto-research is open in every town (owner, 2026-11-20)
    bossLost: !!game && lostBoss(town) && autoOpen(game, 'retry') && !autoOf(game, town).retry,
    // another town (not a won outpost) with towers keeps fighting out of sight
    awayFighting: !!game && Object.values(game.towns).some(o => o !== town && !o.won && (o.towers || []).length && o.waves && !o.waves.hold),
    breaches: town.breaches || 0, made: town.made || {}, bestWave: town.bestWave || 0, anyLevel: top[1], topBuilding: top[0],
    unlocked: id => unlocked(town, id), level: id => town.level(id),
    back: game ? game.back : null, // the place the back button goes to
    next: game ? nextTowns(game).map(n => n.id) : [], // towns in sight but not founded (src/core/empire.js)
    capitalSight: !!game && !!capitalNext(game), capitalOpen: !!game && capitalOpen(game), // src/core/capital.js
    // the contract kinds the Capital has opened (rush, big; clarity fix 3b part 3a)
    contractKinds: (game && capitalOpen(game) && game.shared.capital.opened) || {},
    // the Capital can found an institution or buy an upgrade (src/core/tree.js)
    treeReady: !!game && capitalOpen(game) && !!game.shared.tree && (game.shared.purse.coins >= foundCost(game) || (game.shared.capital.influence >= NODE_COST[0] && game.shared.tree.founded.length > 0)),
    starved: Object.keys(town.starved || {}).find(id => town.level(id) > 0 && town.starved[id] === true) || null,
    firstPit: (() => { const B = town.def && town.def.board, i = B ? B.spots.findIndex((_, k) => isPitSpot(B, k)) : -1; return i >= 0 ? i : null; })(), // the first mortar pit (board.pits), null where there is none
    // a building whose good the town is holding back for towers right now
    keptPlot: Object.keys(town.buildings).find(id => town.level(id) > 0 && town.def && town.def.board && town.def.board.plots[id] && BUILDINGS[id] && ((town.keep || {})[BUILDINGS[id].makes] || 0) > 0 && (town.goods[BUILDINGS[id].makes] || 0) >= town.keep[BUILDINGS[id].makes] - 1e-6 && town.sell[BUILDINGS[id].makes] !== false) || null,
    // a building on the board that can get a foreman, while the town has none yet
    foremanPlot: Object.keys(town.foremen || {}).length ? null : Object.keys(town.buildings).find(id => town.level(id) >= 10 && town.def && town.def.board && town.def.board.plots[id]) || null,
    offered: !!(game && game.shared.charter && charterOffered(game)), toPick: game && game.shared.charter ? perksToPick(game) : 0,
    drew: Object.keys(town.flags || {}).some(k => k.startsWith('drew:')), // the town has drawn goods from an outpost
    record: town.record || 0, oldGround: town.wave <= (town.record || 0) && (town.record || 0) > 0,
    // a tower of each kind on the board: kind -> spot (the first one built)
    kinds: Object.fromEntries([...(town.towers || [])].reverse().map(t => [t.kind, t.spot])),
    // a boom or bust on now (src/core/market.js), and whether its good has a chip on this town's goods strip
    boom: game && game.shared.market ? game.shared.market.boom || null : null,
    ordersOpen: !!game && !!ordersOf(game, town), // this town has an order board (src/core/orders.js)
    boomChip: (() => { const b = game && game.shared.market && game.shared.market.boom; if (!b || typeof document === 'undefined') return false; const n = document.querySelector('#goodsStrip [data-good="' + b.good + '"]'); return !!n && n.offsetParent !== null; })(),
    stockOpen: typeof document !== 'undefined' && !!document.getElementById('stockTowers') && !!document.getElementById('stockTowers').offsetParent, // the Goods sheet shows its Keep for towers · Normal / Lots switch
    towerAtLevel: L => { const t = (town.towers || []).find(x => x.level === L); return t ? t.spot : null; },
    // a tower one level from its second fork, by kind (each kind's card names its own two sides)
    forkReady: (() => { const t = (town.towers || []).find(x => x.kind === 'still' && forkNext(x)); return t ? t.spot : null; })(),
    forkCannon: (() => { const t = (town.towers || []).find(x => x.kind === 'cannon' && forkNext(x)); return t ? t.spot : null; })(),
    forkCrossbow: (() => { const t = (town.towers || []).find(x => x.kind === 'crossbow' && forkNext(x)); return t ? t.spot : null; })(),
    forkFrost: (() => { const t = (town.towers || []).find(x => x.kind === 'frost' && forkNext(x)); return t ? t.spot : null; })(),
  };
}

/* locate(target) gives a screen point { x, y } for a 3D target, or null. */
// a pixel speaker, with sound waves while it reads
const SPEAKER = '<svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 6h3v4H2zM5 5h2v6H5zM7 3h2v10H7z"/><path class="wave" fill="currentColor" d="M11 6h1v4h-1zM13 4h1v8h-1z"/></svg>';
export function startCoach({ game, town, root, locate = () => null, pause = () => {}, onSeen = () => {}, onGo = () => {}, off = false, speech = null, readAuto = () => false, spaced = true }) {
  const seen = game.shared.seen || (game.shared.seen = {});
  let cur = null, wait = 1.2, acc = 0;
  const layer = el('div', 'coach'); layer.hidden = true; layer.id = 'coach';
  const hole = el('div', 'hole'), card = el('div', 'coachcard'), title = el('b'), text = el('p'), ok = el('button', 'btn primary', 'Got it');
  const go = el('button', 'btn primary', ''), btns = el('div', 'coachbtns'), head = el('div', 'coachhead'), speak = el('button', 'btn speak');
  ok.id = 'coachOk'; go.id = 'coachGo'; go.hidden = true; speak.id = 'coachSpeak'; speak.type = 'button'; speak.innerHTML = SPEAKER;
  head.append(title, speak); btns.append(ok, go); card.append(head, text, btns); layer.append(hole, card); root.append(layer);
  const words = () => sayable(title.textContent, text.textContent);
  const paintSpeak = () => {
    const can = !!speech && speech.available(), on = can && speech.speaking();
    speak.hidden = !can; speak.setAttribute('aria-pressed', String(on)); speak.classList.toggle('on', on);
    speak.setAttribute('aria-label', on ? 'Stop reading' : 'Read aloud'); speak.title = on ? 'Stop reading' : 'Read aloud';
  };
  const offSpeech = speech ? speech.onChange(paintSpeak) : () => {};
  paintSpeak();
  speak.addEventListener('click', () => { if (!speech) return; if (speech.speaking()) speech.stop(); else speech.speak(words()); paintSpeak(); });
  const hush = () => { if (speech && speech.speaking()) speech.stop(); };
  ok.addEventListener('click', () => api.dismiss());
  go.addEventListener('click', () => { const to = cur && cur.e.go; api.dismiss(); if (to) onGo(to); });

  // a two-word name (Cold Snap, Frost Lens, Iron Ridge) never breaks across two lines (review of 2026.11.24-2)
  const keepNames = s => String(s).replace(/\b([A-Z][a-z]+) (?=[A-Z][a-z]+\b)/g, '$1' + String.fromCharCode(160));
  function show(e) {
    cur = { e }; title.textContent = e.title; text.textContent = keepNames((e.say && e.say(helper(town, game))) || e.text); layer.hidden = false; layer.dataset.id = e.id;
    go.hidden = !e.go; go.textContent = e.button || ''; ok.textContent = e.go ? 'Stay here' : 'Got it'; ok.classList.toggle('primary', !e.go);
    pause(true); place();
    hush(); paintSpeak();
    if (speech && speech.available() && readAuto()) speech.speak(words());
  }
  /* The part of the screen a spotlit pad can sit in: below the top bar (--hudtop on the play screen), above the card
     at the foot (or below it when the card sits at the top) and in from the sides. */
  function freeArea() {
    const ui = document.getElementById('play-ui'), top = ui ? parseFloat(getComputedStyle(ui).getPropertyValue('--hudtop')) || 0 : 0;
    const c = card.getBoundingClientRect(), m = 48;
    const foot = c.height && c.top > innerHeight / 2 ? c.top : innerHeight; // a card left at the top from the last one is no floor
    return { l: m, r: innerWidth - m, t: Math.max(top, 0) + m, b: Math.max(Math.max(top, 0) + 2 * m + 1, foot - m) };
  }
  function place() {
    const h = helper(town, game), target = cur.e.at ? cur.e.at(h) : null;
    let r = null;
    if (target && target.el) { const n = document.querySelector(target.el); if (n && n.offsetParent !== null) { const b = n.getBoundingClientRect(); r = { x: b.left - 6, y: b.top - 6, w: b.width + 12, h: b.height + 12 }; } }
    else if (target) {
      const p = locate(target);
      // a pad or building under the top bar, the card or the screen's edge: the map slides it into the free part
      // once per card, so the box lies on it and never on a button (clarity fix 10, review 10: the Mortar card's box
      // lay on Hold waves). Not after the player moves the map.
      if (p && !cur.slid && locate.bring) {
        cur.slid = true;
        const f = freeArea();
        if (p.x < f.l || p.x > f.r || p.y < f.t || p.y > f.b) locate.bring(target, (f.l + f.r) / 2, (f.t + f.b) / 2);
      }
      if (p) r = { x: p.x - 48, y: p.y - 48, w: 96, h: 96 };
    }
    hole.hidden = !r;
    if (r) Object.assign(hole.style, { left: Math.round(r.x) + 'px', top: Math.round(r.y) + 'px', width: Math.round(r.w) + 'px', height: Math.round(r.h) + 'px' });
    // the card sits at the foot of the screen, over the goods strip, unless it would cover the spotlight; at the top
    // it covers the top bar (review of 2026.11.23-10: the workers card lay over the boss bar and the goal, with its
    // spotlight in the middle of the screen)
    const low = r && r.y + r.h > innerHeight - card.offsetHeight - 32;
    // on a wide screen it moves to the side away from the spotlight instead, so it covers neither the spotlight nor
    // the top bar (review of 2026.11.24-2: on a short landscape screen the tip card covered "Dry" of Dry Creek)
    const w = card.offsetWidth + 32, mid = r ? r.x + r.w / 2 : 0, left = mid > innerWidth / 2;
    const side = low && innerWidth > innerHeight && (left ? r.x >= w : r.x + r.w <= innerWidth - w);
    card.classList.toggle('top', !!low && !side);
    card.classList.toggle('left', !!side && left);
    card.classList.toggle('right', !!side && !left);
  }
  const api = {
    get current() { return cur ? cur.e.id : null; },
    frame(dt) {
      if (off) return;
      if (cur) { place(); return; }
      if ((wait -= dt) > 0 || (acc += dt) < .25) return;
      acc = 0;
      // spaced in the first minutes, and a card about what to do now before a tip (src/core/cards.js; clarity fix 7)
      const h = helper(town, game), next = cardDue(EXPLAINERS, h, seen, playTime(game), spaced ? game.cardAt ?? null : null);
      if (next) { game.cardAt = playTime(game); show(next); }
    },
    dismiss() {
      if (!cur) return;
      hush(); seen[cur.e.id] = true; cur = null; layer.hidden = true; pause(false); wait = 1.2; onSeen();
    },
    /* Mark every card seen (for players who know the game, and for tools). */
    skipAll() { for (const e of EXPLAINERS) seen[e.id] = true; api.dismiss(); },
    /* Take the cards down without marking the open one seen (switching towns); it shows again later. */
    destroy() { off = true; hush(); offSpeech(); if (cur) { cur = null; pause(false); } layer.remove(); },
    /* What the open card spotlights ({ plot }, { spot }, { el }...), or null (for the tools). */
    target: () => (cur && cur.e.at ? cur.e.at(helper(town, game)) : null),
    /* Turn the cards on or off for a run started with ?coach=off (for the tools: the Ridge shots open one card). */
    wake(on = true) { off = !on; },
    /* What the speaker button reads for the open card (for the tools). */
    words: () => (cur ? words() : null),
  };
  return api;
}
