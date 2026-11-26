/* The boss bar (owner, 2026-11-22: "when a war wagon came, there was an indicator at the top of the screen that showed
   the health of that boss as well as the stage the boss was in"). While a boss is on the road a slim bar sits at the
   foot of the top bar's left column, so it moves nothing above it: the boss's picture and name, its health as a bar
   with have / most, its armor, and the stage it is in (a picture and a pace arrow, stagePic; its words are STAGE_WORDS). It keeps one
   width, and its numbers sit in fixed cells. When the boss falls it says "War wagon down!" for a moment, then goes. A
   tap opens the raider card for the boss. Every value comes from foeView (src/ui/foe.js), so the bar and the card always
   agree. */
import { FOES, STAGE_WORDS } from '../data/foes.js';
import { foeView } from './foe.js';
import { foeStatus } from '../core/defense.js';
import { drawFoe } from '../art/foes.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const pct = x => Math.round(x * 100) + '%';

/* The boss on the road now, or null: the one of this wave still standing. */
export const bossOn = town => (town.waves.foes || []).find(f => FOES[f.kind] && FOES[f.kind].boss && f.hp > 0 && !f.leaked) || null;

/* The stage as a picture (review of 2026.11.23-9: "Crew off, slower" and "Crew jumped off" before it were both
   flagged as shorthand, so by the twice-flagged rule the words left the bar): what fell off (the raiders it dropped,
   its armor plates, a puff of steam) and an arrow for its pace, down when it slows, up when it speeds. The words stay
   on the raider card and in the bar's label for screen readers. From the stage's own numbers in foes.js. */
export function stagePic(kind, key) {
  const F = FOES[kind], st = F && (F.stages || []).find(x => x.key === key);
  if (!st) return null;
  return { pic: st.drop || (st.armor !== undefined ? 'plates' : 'steam'), speed: st.speed < 1 ? 'down' : st.speed > 1 ? 'up' : '' };
}

/* What the bar shows for boss f (pure, for the tests and the words check). */
export function bossView(town, f, store = 'vault') {
  const v = foeView(town, f, store), st = foeStatus(town, f).stage;
  return {
    kind: f.kind, name: v.gone || v.name, health: v.health,
    armor: v.armor && !v.gone ? pct(v.armor.share) : '', // gone: only "War wagon down!" (review of 2026.11.22-10: the numbers said it again)
    stage: v.gone ? '' : st ? STAGE_WORDS[st] : '', pic: v.gone || !st ? null : stagePic(f.kind, st),
    gone: !!v.gone,
  };
}
export const bossLines = (town, f, store) => { const v = bossView(town, f, store); return [v.name, v.gone ? '' : v.health.text, v.armor, v.stage].filter(Boolean); };

/* The bar: { el, update(dt) }. onTap(id) opens the raider card. Painted from the frame; only changed values are written. */
export function bossBar(town, { store = 'vault', onTap = () => {} } = {}) {
  const bar = el('button', 'bossbar'); bar.id = 'bossBar'; bar.hidden = true; bar.type = 'button';
  const pic = el('span', 'bosspic'), name = el('b', 'bname'), stage = el('span', 'bstage');
  const fbar = el('span', 'fbar'), fill = el('i'), armor = el('span', 'barmor'), shield = el('i', 'shield');
  shield.setAttribute('aria-hidden', 'true'); armor.append(shield);
  fbar.append(fill);
  const top = el('span', 'brow'), low = el('span', 'brow');
  // no numbers on the bar: its fill shows the health and the shield that it has armor; the raider card a tap opens
  // has both as have / most (clarity fix 8m: "44%" here beside "21.1K / 48.0K" on the card, the second flag on this
  // bar's health after 8a, so by the twice-flagged rule the number leaves the bar)
  top.append(name, stage); low.append(fbar, armor);
  const txt = el('span', 'btext'); txt.append(top, low);
  bar.append(pic, txt);
  let f = null, kind = null, goneFor = 0, picKey = '';
  /* The stage's picture: the dropped raider drawn small, or a plate or a puff, then the pace arrow. */
  const paintStage = p => {
    const k = p ? p.pic + ':' + p.speed : '';
    if (k === picKey) return; picKey = k;
    if (!p) { stage.replaceChildren(); return; }
    const what = FOES[p.pic] ? Object.assign(drawFoe(p.pic), { className: 'foepic small' }) : el('i', 'spic ' + p.pic);
    const arrow = el('i', 'sarrow ' + p.speed);
    stage.replaceChildren(what, arrow);
  };
  bar.addEventListener('click', () => { if (f && f.hp > 0 && !f.leaked) onTap(f.id); });
  const set = (n, s) => { if (n.textContent !== s) n.textContent = s; };
  const update = (dt = 0) => {
    const now = bossOn(town);
    if (now && now !== f) { f = now; goneFor = 0; bar.classList.remove('gone'); }
    if (!f) { if (!bar.hidden) bar.hidden = true; return; }
    const v = bossView(town, f, store);
    if (v.gone) {
      goneFor += Math.min(dt, .2); // a long frame never cuts the moment short
      if (!bar.classList.contains('gone')) bar.classList.add('gone');
      if (goneFor > 1.6) { f = null; bar.hidden = true; bar.classList.remove('gone'); return; }
    }
    if (kind !== v.kind) { kind = v.kind; const c = drawFoe(v.kind); c.className = 'foepic'; pic.replaceChildren(c); }
    set(name, v.name); paintStage(v.pic);
    if (stage.getAttribute('aria-label') !== v.stage) { if (v.stage) { stage.setAttribute('aria-label', v.stage); stage.title = v.stage; } else { stage.removeAttribute('aria-label'); stage.title = ''; } }
    const w = (100 * (v.gone ? 0 : v.health.share)).toFixed(1) + '%'; if (fill.style.width !== w) fill.style.width = w;
    const vis = v.armor ? '' : 'hidden'; if (armor.style.visibility !== vis) armor.style.visibility = vis; // kept in place, so the bar never changes
    const label = [v.name, 'Health ' + v.health.text, v.armor && 'Armor ' + v.armor, v.stage].filter(Boolean).join('. ');
    if (bar.getAttribute('aria-label') !== label) bar.setAttribute('aria-label', label);
    if (bar.hidden) bar.hidden = false;
  };
  return { el: bar, update, get boss() { return f; } };
}
