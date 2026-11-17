/* Boot: the interface first (it works without WebGL), then the 3D title scene, then the update checks.
   Play loads the saved game (catching up the time away) or starts a new one, and swaps the title for the town. */
import { GAME_VERSION, GAME_NEWS } from './version.js';
import { APP, checkUpdates, initUpdates } from './ui/update.js';
import { mountTitle } from './ui/title.js';
import { INSTALL, installState, initInstall } from './ui/install.js';
import { readSave, writeSave } from './ui/storage.js';
import { newGame, loadGame } from './core/setup.js';

initInstall();
const CG = window.CG = { version: GAME_VERSION, news: GAME_NEWS, APP, checkUpdates, INSTALL, installState, scene: null, ready: false, game: null, town: null, play: null };
const title = mountTitle(document.getElementById('app'), { onPlay: () => startGame() });
initUpdates();
const titleScene = import('./render/title-scene.js')
  .then(m => { CG.scene = m.startTitleScene(document.getElementById('view')); })
  .catch(e => console.warn('3D view unavailable:', e && e.message))
  .finally(() => { CG.ready = true; document.documentElement.classList.toggle('no3d', !CG.scene); });

async function startGame() {
  if (CG.game) return;
  const [{ startTownView }, { mountPlay, toast, fmt }] = await Promise.all([import('./render/town-view.js'), import('./ui/play.js'), titleScene]);
  const saved = readSave();
  let game, away = null;
  if (saved) {
    game = loadGame(saved.game);
    const secs = (Date.now() - (saved.at || Date.now())) / 1000;
    if (secs > 30) away = game.catchUp(secs);
  } else game = newGame('cg-' + Date.now().toString(36));
  CG.game = game;
  if (CG.scene) { CG.scene.stop(); CG.scene = null; }
  title.hidden = true;
  const viewApi = { onTap: () => {}, project: () => null };
  const town = startTownView(document.getElementById('view'), game, { onTap: (id, x, y) => viewApi.onTap(id, x, y), onFrame: dt => CG.play && CG.play.frame(dt) });
  CG.town = town;
  if (town) viewApi.project = town.project;
  CG.play = mountPlay(document.getElementById('app'), game, viewApi);
  if (!town) { // no 3D: keep the game running and lay the plot tags out as a list
    document.documentElement.classList.add('flat');
    let last = performance.now();
    setInterval(() => { const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now; game.advance(dt); CG.play.frame(dt); }, 100);
    toast('This device cannot show the 3D town, so the plots are listed instead.');
  }
  if (away && away.seconds > 60) {
    const earned = Object.values(away.earned).reduce((a, b) => a + b, 0);
    toast('Welcome back. While you were away the town earned ' + fmt(earned) + ' coins.', 6000);
  }
  // keep the game: every 10 seconds, and whenever the app goes to the background
  const keep = () => writeSave(game);
  setInterval(keep, 10000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) keep(); });
  addEventListener('pagehide', keep);
  keep();
}
CG.startGame = startGame;
