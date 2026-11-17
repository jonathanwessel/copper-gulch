/* The town in play: the shared scene with this town's board, the camera rig, and the frame loop that advances the
   game, animates the board and draws. Returns an api the interface uses (tap handler, labels, stop). */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { startQuality, autoStep } from './autoquality.js';
import { Board } from './board.js';
import { CameraRig } from './camera.js';
import { Battle } from './battle.js';
import { pickTarget, project } from './pick.js';

export function startTownView(canvas, game, { onTap = () => {}, onFrame = () => {} } = {}) {
  const q = startQuality(), v = createScene(canvas, { tier: q.tier });
  if (!v) return null;
  const step = autoStep(v, q);
  const town = game.town, board = new Board(town);
  v.scene.add(board.group);
  const battle = new Battle(board, game);
  v.sun.position.set(board.center.x - 8, 12, board.center.z + 7); v.sun.target.position.copy(board.center);
  const sc = v.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.updateProjectionMatrix();
  const rig = new CameraRig(v.cam, canvas, { center: board.center, size: Math.max(town.def.board.cols, town.def.board.rows), onTap: (x, y) => onTap(pickTarget(v.cam, canvas, board, x, y), x, y) });
  let raf = 0, last = performance.now(), frames = 0, t = 0, lastLevels = '', lastTowers = '';
  const api = {
    view: v, board, battle, rig, game, paused: false,
    get frames() { return frames; },
    project: id => project(v.cam, canvas, board.anchor(id)),
    projectPoint: (x, y, z) => project(v.cam, canvas, new THREE.Vector3(x, y, z)),
    projectSpot: i => { const [x, z] = town.def.board.spots[i], tw = town.towers.find(t => t.spot === i); return project(v.cam, canvas, new THREE.Vector3(x, tw ? 1.25 : .3, z)); },
    stop() { cancelAnimationFrame(raf); battle.dispose(); board.dispose(); v.dispose(); },
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (document.hidden || v.lost) return;
    step(dt);
    if (!api.paused) game.advance(dt);
    t += dt;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    v.resize(w, h); rig.fit(w / h);
    const levels = JSON.stringify(town.buildings);
    if (levels !== lastLevels) { board.sync(); lastLevels = levels; const f = board.focus(); rig.frame(f.x, f.z, f.w, f.d); }
    board.update(dt, t, id => !town.starved[id]);
    const towers = town.towers.map(x => x.spot + x.kind + x.level + x.path).join();
    if (towers !== lastTowers) { battle.sync(); lastTowers = towers; }
    rig.update(dt);
    battle.update(dt, t, v.cam);
    v.render(); frames++;
    onFrame(dt);
  }
  raf = requestAnimationFrame(frame);
  return api;
}
