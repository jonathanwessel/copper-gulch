/* Boot: the interface first (it works without WebGL), then the 3D title scene, then the update checks. */
import { GAME_VERSION, GAME_NEWS } from './version.js';
import { APP, checkUpdates, initUpdates } from './ui/update.js';
import { mountTitle } from './ui/title.js';

const CG = window.CG = { version: GAME_VERSION, news: GAME_NEWS, APP, checkUpdates, scene: null, ready: false };
mountTitle(document.getElementById('app'));
initUpdates();
import('./render/title-scene.js')
  .then(m => { CG.scene = m.startTitleScene(document.getElementById('view')); })
  .catch(e => console.warn('3D view unavailable:', e && e.message))
  .finally(() => { CG.ready = true; document.documentElement.classList.toggle('no3d', !CG.scene); });
