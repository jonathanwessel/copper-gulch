/* Boot: the interface first (it works without WebGL), then the 3D title scene, then the update checks.
   Play loads the saved game (catching up the time away) or starts a new one, and swaps the title for the town. */
import { GAME_VERSION, GAME_NEWS } from './version.js';
import { APP, checkUpdates, initUpdates } from './ui/update.js';
import { mountTitle } from './ui/title.js';
import { INSTALL, installState, initInstall } from './ui/install.js';
import { readSave, writeSave, activeSlot, setActiveSlot, slotSummary, writeText } from './ui/storage.js';
import { newGame, loadGame } from './core/setup.js';
import { showNews } from './ui/news.js';
import { createAudio, soundsFor } from './audio/audio.js';
import { moodOf } from './audio/tunes.js';
import { bossWave } from './core/defense.js';

initInstall();
// music and sound (src/audio/): made on the first tap or key, silent while the app is hidden
const audio = createAudio();
for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, () => audio.start(), { capture: true, passive: true });
document.addEventListener('visibilitychange', () => audio.sleep(document.hidden));
addEventListener('pagehide', () => audio.sleep(true));
addEventListener('pageshow', () => { if (!document.hidden) audio.sleep(false); });
setInterval(() => {
  const g = window.CG && window.CG.game, t = g && g.town, ws = t && t.waves;
  audio.mood(moodOf({ title: !g, map: !!(window.CG && window.CG.map), phase: ws ? ws.phase : 'break', boss: !!(ws && ws.phase === 'wave' && bossWave(t, t.wave)) }));
  audio.tick();
}, 120);
// the test tools may start a new game in one later town alone (?start=gulch, ridge, pinehollow or falls); players always start in Dry Creek
const START = ['gulch', 'ridge', 'pinehollow', 'falls'].includes(new URLSearchParams(location.search).get('start')) ? new URLSearchParams(location.search).get('start') : 'drycreek';
const CG = window.CG = { version: GAME_VERSION, news: GAME_NEWS, APP, checkUpdates, INSTALL, installState, audio, scene: null, ready: false, game: null, town: null, play: null, map: null, mapui: null };
const title = mountTitle(document.getElementById('app'), { onPlay: () => startGame(), slot: slotSummary(activeSlot()), slotNo: activeSlot() });
initUpdates();
// what changed since this device last opened the game (a new player skips it)
showNews(document.body, { hasSave: !slotSummary(activeSlot()).empty });
const titleScene = import('./render/title-scene.js')
  .then(m => { CG.scene = m.startTitleScene(document.getElementById('view')); })
  .catch(e => console.warn('3D view unavailable:', e && e.message))
  .finally(() => { CG.ready = true; document.documentElement.classList.toggle('no3d', !CG.scene); });

const AWAY_MIN = 5; // seconds in the background before coming back catches up the time

async function startGame() {
  if (CG.game) return;
  const [{ startTownView }, { mountPlay, toast, dropToasts, fmt }, { startCoach }, { FlowMeter, mapOpen }, { lostToast }] = await Promise.all([import('./render/town-view.js'), import('./ui/play.js'), import('./ui/coach.js'), import('./core/map.js'), import('./ui/lost.js'), titleScene]);
  const saved = readSave();
  let game, away = null;
  // time away always counts (owner rule): run it, and note what the market sold meanwhile for the Welcome back line
  const sold = () => Object.values((game.shared.market || {}).sold || {}).reduce((a, b) => a + b, 0);
  const catchUp = secs => { const s0 = sold(), from = Object.fromEntries(Object.entries(game.towns).map(([k, t]) => [k, t.t])); const r = game.catchUp(secs); r.sold = sold() - s0; r.from = from; return r; };
  if (saved) {
    game = loadGame(saved.game);
    const secs = (Date.now() - (saved.at || Date.now())) / 1000;
    if (secs > 30) away = catchUp(secs);
  } else game = newGame('cg-' + Date.now().toString(36), START); // a new game starts in Dry Creek Outpost
  CG.game = game;
  soundsFor(game, audio);
  const meter = CG.meter = new FlowMeter(); // coins and goods a second, for the map's badges and wagons
  if (CG.scene) { CG.scene.stop(); CG.scene = null; }
  title.hidden = true;
  // leaving this game (another slot, an imported save, the title): save first, stop saving, then reload
  let leaving = false;
  const leave = (kind, arg) => {
    if (leaving) return;
    if (kind === 'import') { leaving = true; writeText(arg); }
    else { writeSave(game); leaving = true; if (kind === 'slot') setActiveSlot(arg); }
    location.hash = kind === 'title' ? '' : 'play';
    location.reload();
  };
  CG.leave = leave;
  const keep = () => { if (!leaving) writeSave(game); };
  const coachOff = new URLSearchParams(location.search).get('coach') === 'off';
  let flatTimer = 0;
  /* The town in play on screen: its 3D board, its HUD and cards, and its explainers. Switching towns takes them down
     and builds them again for the other town on a fresh canvas (the old one's GPU context is let go). */
  function mount({ flyIn = false } = {}) {
    const viewApi = { onTap: () => {}, project: () => null, pause: () => {}, paused: () => false, select: () => {} };
    const b = game.town.def.board;
    // a screen point for a 3D target (a plot, a stone pad, a tower or the vault), for the spotlights
    const locate = tg => !CG.town ? null : tg.plot ? CG.town.project(tg.plot) : tg.spot !== undefined ? CG.town.projectSpot(tg.spot)
      : tg.tower !== undefined ? CG.town.projectSpot(tg.tower) : tg.foe !== undefined ? CG.town.projectFoe(tg.foe) : tg.worker !== undefined ? CG.town.projectWorker(tg.worker) : tg.vault ? CG.town.projectPoint(b.vault[0], .6, b.vault[1]) : null;
    // a stone pad's outline on the screen ({ x, y, w, h } round 8 points of its rim), so the goal's frame lies on the pad
    // as the camera sees it (review of 2026.11.20-7: a fixed square sat flat on the screen beside a near pad)
    locate.foot = i => {
      if (!CG.town) return null;
      const B = CG.game.town.def.board, s = B.spots[i]; if (!s) return null;
      let l = Infinity, r = -Infinity, t = Infinity, d = -Infinity;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, p = CG.town.projectPoint(s[0] + Math.cos(a) * .72, .1, s[1] + Math.sin(a) * .72); if (!p) return null; l = Math.min(l, p.x); r = Math.max(r, p.x); t = Math.min(t, p.y); d = Math.max(d, p.y); }
      return { x: l, y: t, w: r - l, h: d - t };
    };
    const town = startTownView(document.getElementById('view'), game, {
      flyIn, onZoomOut: () => openMap(),
      onTap: (id, x, y) => viewApi.onTap(id, x, y), onFrame: dt => { meter.update(game); if (CG.play) CG.play.frame(dt); if (CG.coach) CG.coach.frame(dt); },
    });
    CG.town = town;
    if (town) { viewApi.project = town.project; viewApi.pause = on => town.pause('player', on); viewApi.paused = () => town.holds.has('player'); viewApi.select = town.select; viewApi.setView = town.setView; }
    CG.play = mountPlay(document.getElementById('app'), game, viewApi, { view: town, audio, meter, leave, go, locate, map: () => openMap(), onHelp: () => CG.play.sheets.close() });
    // the explainer cards; ?coach=off turns them off (the test tools use it)
    CG.coach = startCoach({
      game, town: game.town, root: document.body, off: coachOff,
      pause: on => { if (town) town.pause('coach', on); },
      onSeen: () => keep(), onGo: id => go(id), locate,
    });
    if (!town && !flatTimer) { // no 3D: keep the game running and lay the plot tags out as a list
      document.documentElement.classList.add('flat');
      let last = performance.now();
      flatTimer = setInterval(() => { const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now; game.advance(dt); CG.play.frame(dt); }, 100);
      toast('This device cannot show the 3D town, so the plots are listed instead.');
    }
  }
  const freshCanvas = () => { const old = document.getElementById('view'), fresh = old.cloneNode(false); old.replaceWith(fresh); }; // no old listeners, no lost context
  function unmount() {
    if (CG.coach) CG.coach.destroy();
    if (CG.play) CG.play.destroy();
    if (CG.town) { CG.town.stop(true); freshCanvas(); }
    CG.coach = CG.play = CG.town = null;
  }
  /* The empire map (src/render/empire-view.js, src/ui/map.js): the Map button, or zooming a town all the way out.
     Pause carries over both ways. Play on a town's card flies down into it. */
  let flying = false;
  function openMap() {
    if (!CG.town || CG.map || flying || !mapOpen(game)) return false;
    const paused = CG.town.holds.has('player'), from = game.active;
    dropToasts('lost'); // the map shows the town on hold, so the toast would only cover its labels
    dropToasts('tomap'); // "Tap Map, then Capital ..." is done once the map is open (review of 2026.11.20-13: it rode along into the fly)
    unmount();
    const [{ startEmpireView }, { mountMap }] = mapMods;
    const map = startEmpireView(document.getElementById('view'), game, { from, meter, onTap: id => { if (CG.mapui) CG.mapui.openSite(id); }, onFrame: dt => { if (CG.mapui) CG.mapui.frame(dt); } });
    if (!map) { mount(); return false; }
    if (paused) map.pause('player', true);
    CG.map = map;
    CG.mapui = mountMap(document.getElementById('app'), game, map, { meter, toast, play: id => flyTo(id), back: () => flyTo(game.active) });
    keep();
    return true;
  }
  function closeMap() {
    if (CG.mapui) CG.mapui.destroy();
    if (CG.map) { CG.map.stop(true); freshCanvas(); }
    CG.map = CG.mapui = null;
  }
  function flyTo(id) {
    if (!CG.map || flying || !game.towns[id]) return;
    flying = true;
    if (CG.mapui) CG.mapui.el.classList.add('flying'); // the badges and the card stay behind
    dropToasts('capital'); // a Capital toast ("Market Board is built.") says nothing in a town (review of 2026.11.20-5: it rode along into the fly)
    CG.map.fly(id, () => {
      const paused = CG.map.holds.has('player');
      closeMap(); if (game.active !== id) game.go(id);
      mount({ flyIn: true }); if (paused && CG.town) CG.town.pause('player', true);
      flying = false; keep();
    });
  }
  CG.openMap = openMap; CG.flyTo = flyTo;
  const mapMods = await Promise.all([import('./render/empire-view.js'), import('./ui/map.js')]);
  /* Put another open town in play (the town chip, the outpost's win card). */
  function go(id) {
    if (!game.towns[id] || game.active === id) return false;
    unmount(); game.go(id); mount(); keep();
    return true;
  }
  CG.go = go;
  mount();
  const welcome = r => {
    if (!r || r.seconds < 60) return;
    const earned = Object.values(r.earned).reduce((a, b) => a + b, 0), n = Math.floor(r.sold);
    toast('Welcome back. While you were away, your towns earned ' + fmt(earned) + ' coins' + (n >= 1 ? ' and sold ' + fmt(n) + ' goods.' : '.'), 6000, { first: true });
    // a town that lost while away holds its waves (owner rule): one line each, after the welcome
    for (const t of Object.values(game.towns)) if (t.waves && t.waves.autoHold && t.lost && t.lost.at >= ((r.from || {})[t.id] ?? 0)) toast(lostToast(t, t.id === game.active, game), 6000, { kind: 'lost' });
  };
  welcome(away);
  // keep the game: every 10 seconds, and whenever the app goes to the background
  setInterval(keep, 10000);
  // the app in the background: drawing stops, so on coming back the time it was hidden is caught up like a cold start
  // (an installed app is usually only backgrounded, never closed). Pause is respected: a paused game stays where it was.
  let hiddenAt = null;
  const hide = () => { if (hiddenAt === null) hiddenAt = Date.now(); keep(); };
  const show = () => {
    if (hiddenAt === null || document.hidden) return;
    const secs = (Date.now() - hiddenAt) / 1000; hiddenAt = null;
    const v = CG.town || CG.map;
    if (secs < AWAY_MIN || (v && v.holds.has('player'))) return;
    const r = catchUp(secs); keep(); welcome(r);
    return r;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else show(); });
  // only the map zooms, never the page (owner rule): iOS Safari ignores user-scalable=no, so stop its pinch gestures,
  // and any two-finger move outside the map's own handlers
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  addEventListener('pagehide', hide);
  addEventListener('pageshow', show);
  CG.away = { hide, show, since: t => { hiddenAt = t; } }; // the smoke test hides the app for a pretend ten minutes
  keep();
}
CG.startGame = startGame;
// a slot switch or an imported save reloads with #play, straight into the game
if (location.hash === '#play') { history.replaceState(null, '', location.pathname + location.search); startGame(); }
