/* The town in play: the shared scene with this town's board, the camera rig, and the frame loop that advances the
   game, animates the board and draws. Returns an api the interface uses (tap handler, labels, stop). */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { Board } from './board.js';
import { CameraRig } from './camera.js';
import { pickPlot, project } from './pick.js';

export function startTownView(canvas, game, { onTap = () => {}, onFrame = () => {} } = {}) {
  const v = createScene(canvas);
  if (!v) return null;
  const town = game.town, board = new Board(town);
  v.scene.add(board.group);
  v.sun.position.set(board.center.x - 8, 12, board.center.z + 7); v.sun.target.position.copy(board.center);
  const sc = v.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.updateProjectionMatrix();
  const rig = new CameraRig(v.cam, canvas, { center: board.center, size: Math.max(town.def.board.cols, town.def.board.rows), onTap: (x, y) => onTap(pickPlot(v.cam, canvas, board, x, y), x, y) });
  let raf = 0, last = performance.now(), frames = 0, t = 0, lastLevels = '';
  const api = {
    view: v, board, rig, game, paused: false,
    get frames() { return frames; },
    project: id => project(v.cam, canvas, board.anchor(id)),
    stop() { cancelAnimationFrame(raf); board.dispose(); v.dispose(); },
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (document.hidden || v.lost) return;
    if (!api.paused) game.advance(dt);
    t += dt;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    v.resize(w, h); rig.fit(w / h);
    const levels = JSON.stringify(town.buildings);
    if (levels !== lastLevels) { board.sync(); lastLevels = levels; const f = board.focus(); rig.frame(f.x, f.z, f.w); }
    board.update(dt, t, id => !town.starved[id]);
    rig.update(dt);
    v.render(); frames++;
    onFrame(dt);
  }
  raf = requestAnimationFrame(frame);
  return api;
}
