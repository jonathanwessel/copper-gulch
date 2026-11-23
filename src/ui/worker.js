/* The workers' card (roadmap review 2026.11.22-9: "anything that moves can be tapped too"). While a town is called to
   arms, a tap on a pair of workers by the road opens it: the building they came from, the seconds until they go back to
   work and what that building does not make until then. It keeps up live while the game runs, and when the call ends
   it says so for a moment and closes. Every value comes from workerStatus (src/core/arms.js). Live numbers sit in cells
   of fixed width, so the card never twitches. */
import { GOODS } from '../data/goods.js';
import { workerStatus } from '../core/arms.js';
import { fmtLive } from './format.js';
import { fxLeft } from './foe.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* What the card shows (pure, for the tests and the words check). */
export function workerView(town, id) {
  const st = workerStatus(town, id);
  if (!st) return null;
  const g = GOODS[st.good];
  return {
    name: st.name + ' workers',
    back: st.out ? fxLeft(st.left) : '',
    // "Timber lost 27" (review of 2026.11.22-11: "Not made" read as not built yet)
    lostLabel: g ? g.name + ' lost' : '', lost: st.out && st.lost > 0 && g ? fmtLive(st.lost) : '',
    gone: st.out ? null : 'Back to work!',
  };
}
export function workerLines(town, id) {
  const v = workerView(town, id);
  if (!v) return [];
  return [v.name, ...(v.gone ? [v.gone] : ['Back to work in', v.back, ...(v.lost ? [v.lostLabel, v.lost] : [])])];
}

function row(label) {
  const r = el('div', 'foestat wk'), num = el('b'), lab = el('span', 'flabel', label);
  r.append(lab, num);
  return { r, num, lab };
}
/* Fill the card for building id's workers; returns { update() }, false once the card should close. */
export function workerCard(card, town, id, { onClose = () => {} } = {}) {
  card.replaceChildren();
  card.classList.add('foecard', 'workercard');
  const v0 = workerView(town, id), head = el('div', 'cardhead'), close = el('button', 'btn small close', 'Close');
  head.append(el('h2', null, v0.name), close);
  close.addEventListener('click', onClose);
  const back = row('Back to work in'), lost = row(v0.lostLabel);
  card.append(head, back.r, lost.r);
  let goneFor = 0, last = performance.now();
  const set = (n, s) => { if (n.textContent !== s) n.textContent = s; };
  const update = () => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    const v = workerView(town, id);
    if (!v || v.gone) {
      // only "Back to work!", on the first row: the old seconds and goods would say it again (review of 2026.11.22-10
      // on the boss bar), and a line at the foot under two empty rows looked broken (review of 2026.11.22-11)
      set(back.lab, 'Back to work!'); set(back.num, ''); lost.r.style.visibility = 'hidden';
      if (!card.classList.contains('gonefoe')) { card.classList.add('gonefoe'); back.r.classList.add('gone'); }
      goneFor += Math.min(dt, .2);
      return goneFor <= 1.6;
    }
    set(back.num, v.back); set(lost.num, v.lost);
    lost.r.style.visibility = v.lost ? '' : 'hidden'; // kept in place, so the card never changes size
    return true;
  };
  update();
  return { update, id };
}
