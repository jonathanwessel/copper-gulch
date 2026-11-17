/* The title screen: the pixel-lettered name over the 3D town, and a sign board with the way in. */
import { drawText } from '../art/pixfont.js';
import { GAME_VERSION } from '../version.js';
import { APP, checkUpdates } from './update.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

export function mountTitle(root, { onPlay = () => {} } = {}) {
  const t = el('section', 'title'); t.id = 'title';
  const logo = el('div', 'logo'); logo.setAttribute('role', 'img'); logo.setAttribute('aria-label', 'Copper Gulch');
  for (const word of ['COPPER', 'GULCH']) {
    const c = drawText(word);
    c.className = 'pix'; logo.append(c);
  }
  const tag = el('p', 'tagline', 'A frontier tycoon. Hold the road.');
  const sign = el('div', 'sign');
  const play = el('button', 'btn primary', 'Play'); play.id = 'play';
  play.addEventListener('click', () => { play.disabled = true; onPlay(); });
  const note = el('p', 'note', 'Early days: the Gulch has its buildings and its market. Raiders, research and more towns are coming.');
  const row = el('div', 'row');
  const check = el('button', 'btn small', 'Check for updates'); check.id = 'checkUpdates';
  check.addEventListener('click', () => checkUpdates(true));
  row.append(check);
  sign.append(play, note, row);
  const foot = el('p', 'foot'); foot.id = 'version';
  const paint = () => { foot.textContent = 'Version ' + GAME_VERSION + (APP.status ? ' · ' + APP.status : '') + ' · Free, no ads'; };
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
