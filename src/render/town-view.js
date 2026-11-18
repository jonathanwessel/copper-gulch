/* The town in play: the shared scene with this town's board, the camera rig, and the frame loop that advances the
   game, animates the board and draws. Returns an api the interface uses (tap handler, labels, stop). */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { startQuality, autoStep } from './autoquality.js';
import { saveQuality, deviceTier } from './quality.js';
import { Board } from './board.js';
import { CameraRig } from './camera.js';
import { Battle } from './battle.js';
import { Selection } from './select.js';
import { pickTarget, project } from './pick.js';

const _a = new THREE.Vector3();
/* onZoomOut: the player zoomed out past the farthest view (opens the empire map); flyIn: dive in from above. */
export function startTownView(canvas, game, { onTap = () => {}, onFrame = () => {}, onZoomOut = null, flyIn = false } = {}) {
  const q = startQuality(), v = createScene(canvas, { tier: q.tier });
  if (!v) return null;
  const step = autoStep(v, q);
  const town = game.town, board = new Board(town);
  v.scene.add(board.group);
  const battle = new Battle(board, game), selection = new Selection(board, battle);
  v.sun.position.set(board.center.x - 8, 12, board.center.z + 7); v.sun.target.position.copy(board.center);
  const sc = v.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.updateProjectionMatrix();
  const rig = new CameraRig(v.cam, canvas, { center: board.center, size: Math.max(town.def.board.cols, town.def.board.rows), pads: town.def.board.spots, onZoomOut, flyIn, onTap: (x, y) => onTap(pickTarget(v.cam, canvas, board, x, y), x, y) });
  let raf = 0, last = performance.now(), frames = 0, t = 0, lastLevels = '', lastTowers = '', lastStep = -1;
  const api = {
    view: v, board, battle, rig, game, selection, holds: new Set(),
    /* Highlight what a card is open for: { plot }, { spot } or null. */
    select: target => { selection.set(target); if (!target) rig.keep(null); },
    /* What covers the board (client pixels): the top bar's lower edge, and the open card's box or null. Read by the
       interface five times a second; the camera refits its home view and keeps the selected thing clear of the card. */
    setView(top, cover) {
      rig.setView(top, cover);
      const tg = selection.target, B = town.def.board;
      if (!tg) return;
      const [x, z] = tg.plot ? B.plots[tg.plot] : B.spots[tg.spot];
      rig.keep({ x, y: tg.plot ? .6 : .3, z }, tg.plot ? 'p' + tg.plot : 's' + tg.spot);
    },
    get paused() { return api.holds.size > 0; },
    /* Pause or resume for a reason ('player', 'coach'...); the game runs when nothing holds it. */
    pause(reason, on) { if (on) api.holds.add(reason); else api.holds.delete(reason); },
    get frames() { return frames; },
    /* The Graphics setting: 'auto' (the device's tier, stepping down when slow) or a tier kept as picked. */
    get quality() { return q.auto ? 'auto' : q.tier; },
    setQuality(choice) {
      if (choice === 'auto') { q.auto = true; q.tier = deviceTier(); } else { q.auto = false; q.tier = choice; }
      saveQuality({ tier: q.tier, auto: q.auto }); v.setQuality(q.tier);
    },
    project: id => project(v.cam, canvas, board.anchor(id, _a)),
    projectPoint: (x, y, z) => project(v.cam, canvas, new THREE.Vector3(x, y, z)),
    projectSpot: i => { const [x, z] = town.def.board.spots[i], tw = town.towers.find(t => t.spot === i); return project(v.cam, canvas, new THREE.Vector3(x, tw ? 1.25 : .3, z)); },
    /* Stop drawing and free the GPU memory; lose: also let go of the GPU context (the canvas is being replaced). */
    stop(lose = false) { cancelAnimationFrame(raf); selection.dispose(); battle.dispose(); board.dispose(); v.dispose(); if (lose) v.renderer.forceContextLoss(); },
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (document.hidden || v.lost) return;
    step(dt);
    if (!api.paused) game.advance(dt);
    t += dt;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    v.resize(w, h); rig.fit(w / h, w, h);
    // the board only changes when the simulation steps: check then, not every frame
    const stepped = game.stats.steps !== lastStep; lastStep = game.stats.steps;
    const levels = stepped || !lastLevels ? JSON.stringify(town.buildings) : lastLevels;
    if (levels !== lastLevels) { board.sync(); lastLevels = levels; const f = board.focus(); rig.frame(f.x, f.z, f.w, f.d); }
    board.update(dt, t, id => !town.starved[id], rig.c);
    const towers = stepped || !lastTowers ? town.towers.map(x => x.spot + x.kind + x.level + x.path).join() : lastTowers;
    if (towers !== lastTowers) { battle.sync(); lastTowers = towers; }
    rig.update(dt);
    battle.update(dt, t, v.cam, game.clock.alpha, game.stats.steps);
    selection.update(t);
    v.render(); frames++;
    onFrame(dt);
  }
  raf = requestAnimationFrame(frame);
  return api;
}
