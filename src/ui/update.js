/* Installing as an app and picking up new releases, two ways so an installed copy never gets stuck:
   1. the service worker: a new sw.js installs in the background and waits; "Update ready" swaps to it and reloads;
   2. version.json, fetched past every cache: if a newer version is published, "Update ready" reloads.
   Both run when the app opens, whenever it comes back to the front, every 15 minutes, and from checkUpdates(true). */
import { GAME_VERSION } from '../version.js';

export const APP = { reg: null, waiting: null, latest: '', status: '', onChange: () => {} };

/* Is version a newer than version b? Versions are YYYY.MM.DD-N. */
export function newer(a, b) {
  const [ad, an] = String(a).split('-'), [bd, bn] = String(b).split('-');
  return ad !== bd ? ad > bd : (+an || 0) > (+bn || 0);
}

export function showUpdate() {
  if (document.getElementById('updateBar')) return;
  const bar = document.createElement('button');
  bar.id = 'updateBar'; bar.className = 'updatebar';
  bar.innerHTML = '<b>Update ready</b><span>Tap to load the new version. Your save is kept.</span>';
  bar.addEventListener('click', () => { if (APP.waiting) APP.waiting.postMessage('skip'); else location.reload(); });
  document.body.append(bar);
  APP.onChange();
}

export async function checkUpdates(manual = false) {
  APP.status = 'Checking...'; APP.onChange();
  try { if (APP.reg) await APP.reg.update(); } catch (e) { /* offline */ }
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (r.ok) { const j = await r.json(); APP.latest = j.version || ''; if (APP.latest && newer(APP.latest, GAME_VERSION)) showUpdate(); }
  } catch (e) { /* offline */ }
  APP.status = document.getElementById('updateBar') ? 'A new version is ready.'
    : APP.latest ? 'Up to date.' : manual ? 'Could not reach the server. You may be offline.' : '';
  APP.onChange();
}

export function initUpdates() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const go = async () => {
    try {
      const reg = APP.reg = await navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' });
      const watch = w => {
        if (!w) return;
        const done = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { APP.waiting = w; showUpdate(); } };
        done(); w.addEventListener('statechange', done);
      };
      watch(reg.waiting); reg.addEventListener('updatefound', () => watch(reg.installing));
      // reload when an update takes over; the first install taking control of a new visitor's page is not an update
      const hadController = !!navigator.serviceWorker.controller; let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !hadController) return; reloading = true; location.reload(); });
    } catch (e) { /* no service worker: the game still runs online */ }
    checkUpdates();
    setInterval(checkUpdates, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdates(); });
  };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
}
