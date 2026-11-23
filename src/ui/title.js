/* The title screen: the pixel-lettered name over the 3D town, and a sign board with the way in. */
import { drawText } from '../art/pixfont.js';
import { GAME_VERSION } from '../version.js';
import { APP, checkUpdates } from './update.js';
import { installButton } from './install.js';
import { fmt, ago } from './format.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

export function mountTitle(root, { onPlay = () => {}, slot = null, slotNo = 1 } = {}) {
  const t = el('section', 'title'); t.id = 'title';
  const logo = el('div', 'logo'); logo.setAttribute('role', 'img'); logo.setAttribute('aria-label', 'Copper Gulch');
  for (const word of ['COPPER', 'GULCH']) {
    const c = drawText(word);
    c.className = 'pix'; logo.append(c);
  }
  const tag = el('p', 'tagline', 'Build a town. Stop the raiders.');
  const sign = el('div', 'sign');
  const has = slot && !slot.empty && !slot.damaged;
  const play = el('button', 'btn primary', has ? 'Continue' : 'Play'); play.id = 'play';
  const saved = el('p', 'note slotline', has ? 'Slot ' + slotNo + ' · Wave ' + slot.wave + ' · ' + fmt(slot.coins) + ' coins · ' + ago(Date.now() - slot.at) : '');
  saved.id = 'slotLine'; saved.hidden = !has;
  play.addEventListener('click', () => { play.disabled = true; onPlay(); });
  const row = el('div', 'row');
  const check = el('button', 'btn small', 'Check for updates'); check.id = 'checkUpdates';
  check.addEventListener('click', () => checkUpdates(true));
  row.append(installButton(), check);
  sign.append(play, saved, row);
  const foot = el('p', 'foot'); foot.id = 'version';
  const paint = () => { foot.textContent = 'Version ' + GAME_VERSION + (APP.status ? ' · ' + APP.status.replace(/\.$/, '') : '') + ' · Free, no\u00a0ads'; }; // "ads" never alone on a line (review of 2026.11.23-6)
  APP.onChange = paint; paint();
  const head = el('div', 'head'); head.append(logo, tag);
  t.append(head, sign, foot);
  root.append(t);
  // whole-number pixel scale, so every font pixel is the same size
  const fit = () => {
    const short = innerHeight < 500 && innerWidth > innerHeight;
    const s = Math.max(2, Math.floor(Math.min(innerWidth * (short ? .5 : .86), 440) / logo.children[0].width));
    for (const c of logo.children) { c.style.width = c.width * s + 'px'; c.style.height = c.height * s + 'px'; }
  };
  fit(); addEventListener('resize', fit);
  return t;
}
