/* The explainer cards (src/data/explainers.js): one at a time, a dimmed screen with a spotlight on the thing being
   explained and a short card with "Got it". The game waits while a card is open. Each card shows once; what has been
   seen is kept in the save (game.shared.seen). startCoach returns { frame(dt), current, dismiss(), skipAll() }. */
import { EXPLAINERS } from '../data/explainers.js';
import { unlocked } from '../core/economy.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* What explainers read: a small view of the town. */
export function helper(town) {
  const ws = town.waves || {}, levels = Object.entries(town.buildings);
  const top = levels.reduce((a, b) => (b[1] > a[1] ? b : a), ['camp', 0]);
  return {
    t: town.t, towers: town.towers || [], flags: town.flags || {}, phase: ws.phase, wave: town.wave, vault: town.vault,
    breaches: town.breaches || 0, made: town.made || {}, anyLevel: top[1], topBuilding: top[0],
    unlocked: id => unlocked(town, id),
    starved: Object.keys(town.starved || {}).find(id => town.level(id) > 0) || null,
    towerAtLevel: L => { const t = (town.towers || []).find(x => x.level === L); return t ? t.spot : null; },
  };
}

/* locate(target) gives a screen point { x, y } for a 3D target, or null. */
export function startCoach({ game, town, root, locate = () => null, pause = () => {}, onSeen = () => {}, off = false }) {
  const seen = game.shared.seen || (game.shared.seen = {});
  let cur = null, wait = 1.2, acc = 0;
  const layer = el('div', 'coach'); layer.hidden = true; layer.id = 'coach';
  const hole = el('div', 'hole'), card = el('div', 'coachcard'), title = el('b'), text = el('p'), ok = el('button', 'btn primary', 'Got it');
  ok.id = 'coachOk'; card.append(title, text, ok); layer.append(hole, card); root.append(layer);
  ok.addEventListener('click', () => api.dismiss());

  function show(e) {
    cur = { e }; title.textContent = e.title; text.textContent = e.text; layer.hidden = false; layer.dataset.id = e.id;
    pause(true); place();
  }
  function place() {
    const h = helper(town), target = cur.e.at ? cur.e.at(h) : null;
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
      const h = helper(town), next = EXPLAINERS.find(e => !seen[e.id] && e.when(h));
      if (next) show(next);
    },
    dismiss() {
      if (!cur) return;
      seen[cur.e.id] = true; cur = null; layer.hidden = true; pause(false); wait = 1.2; onSeen();
    },
    /* Mark every card seen (for players who know the game, and for tools). */
    skipAll() { for (const e of EXPLAINERS) seen[e.id] = true; api.dismiss(); },
  };
  return api;
}
