/* Installing Copper Gulch as an app. Chrome (Android and desktop) fires beforeinstallprompt when the site is
   installable; index.html catches it early into window.cgInstallPrompt, and installButton() shows an Install button
   only while that prompt is available and the game is not already running as an app. iPhones and iPads have no
   prompt: they get a one-line hint instead. The Install entry also belongs in Settings (Phone shell box). */

const media = q => typeof matchMedia === 'function' && matchMedia(q).matches;
const standalone = () => media('(display-mode: standalone)') || media('(display-mode: fullscreen)') || media('(display-mode: minimal-ui)') || navigator.standalone === true;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const INSTALL = { prompt: null, installed: false, listeners: new Set() };
const notify = () => { for (const f of INSTALL.listeners) f(); };

export function installState() {
  if (INSTALL.installed || standalone()) return 'app';
  if (INSTALL.prompt) return 'prompt';
  if (ios()) return 'ios';
  return 'none';
}

export async function install() {
  const p = INSTALL.prompt;
  if (!p) return false;
  INSTALL.prompt = null; window.cgInstallPrompt = null;
  p.prompt();
  let r = null;
  try { r = await p.userChoice; } catch (e) { /* dismissed */ }
  notify();
  return !!(r && r.outcome === 'accepted');
}

let started = false;
export function initInstall() {
  if (started) return; started = true;
  if (window.cgInstallPrompt) INSTALL.prompt = window.cgInstallPrompt;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL.prompt = e; notify(); });
  window.addEventListener('cg-install-ready', () => { INSTALL.prompt = window.cgInstallPrompt || INSTALL.prompt; notify(); });
  window.addEventListener('appinstalled', () => { INSTALL.installed = true; INSTALL.prompt = null; window.cgInstallPrompt = null; notify(); });
  if (typeof matchMedia === 'function') for (const q of ['(display-mode: standalone)', '(display-mode: fullscreen)']) {
    const m = matchMedia(q); if (m.addEventListener) m.addEventListener('change', notify);
  }
}

/* An element that keeps itself right: an Install button, the iOS hint, or nothing. */
export function installButton(cls = 'btn small') {
  initInstall();
  const wrap = document.createElement('span'); wrap.className = 'install';
  const btn = document.createElement('button'); btn.className = cls; btn.id = 'install'; btn.textContent = 'Install app';
  btn.addEventListener('click', () => install());
  const hint = document.createElement('span'); hint.className = 'hint'; hint.id = 'installHint';
  hint.textContent = 'To install: tap Share, then Add to Home Screen.';
  wrap.append(btn, hint);
  const paint = () => { const s = installState(); btn.hidden = s !== 'prompt'; hint.hidden = s !== 'ios'; wrap.hidden = s === 'app' || s === 'none'; };
  INSTALL.listeners.add(paint); paint();
  return wrap;
}
