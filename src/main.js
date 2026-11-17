/* Boot: the interface first (it works without WebGL), then the 3D title scene, then the update checks.
   Play loads the saved game (catching up the time away) or starts a new one, and swaps the title for the town. */
import { GAME_VERSION, GAME_NEWS } from './version.js';
import { APP, checkUpdates, initUpdates } from './ui/update.js';
import { mountTitle } from './ui/title.js';
import { INSTALL, installState, initInstall } from './ui/install.js';
import { readSave, writeSave, activeSlot, setActiveSlot, slotSummary, writeText } from './ui/storage.js';
import { newGame, loadGame } from './core/setup.js';
import { showNews } from './ui/news.js';

initInstall();
// the test tools may start a new game in one later town alone (?start=gulch, ridge or pinehollow); players always start in Dry Creek
const START = ['gulch', 'ridge', 'pinehollow'].includes(new URLSearchParams(location.search).get('start')) ? new URLSearchParams(location.search).get('start') : 'drycreek';
const CG = window.CG = { version: GAME_VERSION, news: GAME_NEWS, APP, checkUpdates, INSTALL, installState, scene: null, ready: false, game: null, town: null, play: null };
const title = mountTitle(document.getElementById('app'), { onPlay: () => startGame(), slot: slotSummary(activeSlot()), slotNo: activeSlot() });
initUpdates();
// what changed since this device last opened the game (a new player skips it)
showNews(document.body, { hasSave: !slotSummary(activeSlot()).empty });
const titleScene = import('./render/title-scene.js')
  .then(m => { CG.scene = m.startTitleScene(document.getElementById('view')); })
  .catch(e => console.warn('3D view unavailable:', e && e.message))
  .finally(() => { CG.ready = true; document.documentElement.classList.toggle('no3d', !CG.scene); });

async function startGame() {
  if (CG.game) return;
  const [{ startTownView }, { mountPlay, toast, fmt }, { startCoach }] = await Promise.all([import('./render/town-view.js'), import('./ui/play.js'), import('./ui/coach.js'), titleScene]);
  const saved = readSave();
  let game, away = null;
  if (saved) {
    game = loadGame(saved.game);
    const secs = (Date.now() - (saved.at || Date.now())) / 1000;
    if (secs > 30) away = game.catchUp(secs);
  } else game = newGame('cg-' + Date.now().toString(36), START); // a new game starts in Dry Creek Outpost
  CG.game = game;
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
  function mount() {
    const viewApi = { onTap: () => {}, project: () => null, pause: () => {}, paused: () => false, select: () => {} };
    const b = game.town.def.board;
    // a screen point for a 3D target (a plot, a stone pad, a tower or the vault), for the spotlights
    const locate = tg => !CG.town ? null : tg.plot ? CG.town.project(tg.plot) : tg.spot !== undefined ? CG.town.projectSpot(tg.spot)
      : tg.tower !== undefined ? CG.town.projectSpot(tg.tower) : tg.vault ? CG.town.projectPoint(b.vault[0], .6, b.vault[1]) : null;
    const town = startTownView(document.getElementById('view'), game, { onTap: (id, x, y) => viewApi.onTap(id, x, y), onFrame: dt => { if (CG.play) CG.play.frame(dt); if (CG.coach) CG.coach.frame(dt); } });
    CG.town = town;
    if (town) { viewApi.project = town.project; viewApi.pause = on => town.pause('player', on); viewApi.paused = () => town.holds.has('player'); viewApi.select = town.select; viewApi.setView = town.setView; }
    CG.play = mountPlay(document.getElementById('app'), game, viewApi, { view: town, leave, go, locate, onHelp: () => CG.play.sheets.close() });
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
  function unmount() {
    if (CG.coach) CG.coach.destroy();
    if (CG.play) CG.play.destroy();
    if (CG.town) {
      CG.town.stop(true);
      const old = document.getElementById('view'), fresh = old.cloneNode(false); // a clean canvas: no old listeners, no lost context
      old.replaceWith(fresh);
    }
    CG.coach = CG.play = CG.town = null;
  }
  /* Put another open town in play (the town chip, the outpost's win card). */
  function go(id) {
    if (!game.towns[id] || game.active === id) return false;
    unmount(); game.go(id); mount(); keep();
    return true;
  }
  CG.go = go;
  mount();
  if (away && away.seconds > 60) {
    const earned = Object.values(away.earned).reduce((a, b) => a + b, 0);
    toast('Welcome back. While you were away your towns earned ' + fmt(earned) + ' coins.', 6000);
  }
  // keep the game: every 10 seconds, and whenever the app goes to the background
  setInterval(keep, 10000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) keep(); });
  addEventListener('pagehide', keep);
  keep();
}
CG.startGame = startGame;
// a slot switch or an imported save reloads with #play, straight into the game
if (location.hash === '#play') { history.replaceState(null, '', location.pathname + location.search); startGame(); }
