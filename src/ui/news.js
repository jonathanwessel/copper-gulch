/* The What's new card on the title: every change since the version this device last saw, newest first, closed with
   one tap. A new player (no save yet) skips it. The version last seen is kept under cg-news. */
import { NEWS } from '../data/news.js';
import { GAME_VERSION } from '../version.js';
import { newer } from './update.js';

const KEY = 'cg-news';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/* The entries a device that last saw version `seen` has not seen yet. */
export function unseen(seen, list = NEWS, now = GAME_VERSION) {
  return list.filter(n => !newer(n.v, now) && (!seen || newer(n.v, seen)));
}

export function showNews(root, { hasSave = false } = {}) {
  let seen = null;
  try { seen = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  const mark = () => { try { localStorage.setItem(KEY, GAME_VERSION); } catch (e) { /* private mode */ } };
  const list = hasSave ? unseen(seen) : [];
  if (!list.length) { mark(); return null; }
  const layer = el('div', 'newslayer'); layer.id = 'news';
  const card = el('div', 'newscard'), body = el('div', 'newsbody');
  card.append(el('b', 'newstitle', 'What\'s new'), body);
  for (const n of list) {
    const sec = el('div', 'newsver'); sec.append(el('small', null, 'Version ' + n.v));
    const ul = el('ul'); for (const l of n.lines) ul.append(el('li', null, l));
    sec.append(ul); body.append(sec);
  }
  const ok = el('button', 'btn primary', 'Got it'); ok.id = 'newsOk';
  ok.addEventListener('click', () => { mark(); layer.remove(); });
  card.append(ok); layer.append(card); root.append(layer);
  return layer;
}
