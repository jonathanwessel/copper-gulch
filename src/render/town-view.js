/* The town in play: the shared scene with this town's board, the camera rig, and the frame loop that advances the
   game, animates the board and draws. Returns an api the interface uses (tap handler, labels, stop). */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { startQuality, autoStep } from './autoquality.js';
import { saveQuality, autoQuality } from './quality.js';
import { Board } from './board.js';
import { CameraRig, ROAD_STEP } from './camera.js';
import { lanesOf } from '../core/defense.js';
import { pointAt } from '../core/path.js';
import { Battle } from './battle.js';
import { Selection } from './select.js';
import { pickTarget, pickFoe, pickWorker, hitPx, project } from './pick.js';

const _a = new THREE.Vector3();
/* onZoomOut: the player zoomed out past the farthest view (opens the empire map); flyIn: dive in from above. */
export function startTownView(canvas, game, { onTap = () => {}, onFrame = () => {}, onZoomOut = null, flyIn = false } = {}) {
  const q = startQuality(), v = createScene(canvas, { tier: q.tier, ratio: q.ratio });
  if (!v) return null;
  const step = autoStep(v, q);
  const town = game.town, board = new Board(town);
  v.scene.add(board.group);
  const battle = new Battle(board, game), selection = new Selection(board, battle);
  v.sun.position.set(board.center.x - 8, 12, board.center.z + 7); v.sun.target.position.copy(board.center);
  const sc = v.sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.updateProjectionMatrix();
  // each lane's road from where its raiders come into view, for the home view to keep on screen (the phone home view box)
  const rig = new CameraRig(v.cam, canvas, { center: board.center, size: Math.max(town.def.board.cols, town.def.board.rows), pads: town.def.board.spots, roads: roadPoints(town), onZoomOut, flyIn, onTap: (x, y) => {
    // a raider when the finger is nearer its middle than the middle of the pad or building the tap would open (smoke,
    // 2026.11.22-9: a tap on a pad's middle opened a raider walking past it)
    // the same for the workers called to arms, who stand by the road in front of their own building
    const foe = pickFoe(v.cam, canvas, board, battle, x, y), hit = pickTarget(v.cam, canvas, board, x, y);
    const wk = pickWorker(v.cam, canvas, board, x, y), hp = hit ? hitPx(v.cam, canvas, board, hit, x, y) : Infinity;
    const moving = foe && (!wk || foe.px <= wk.px) ? { px: foe.px, out: { foe: foe.id } } : wk ? { px: wk.px, out: { worker: wk.id } } : null;
    onTap(moving && moving.px < hp ? moving.out : hit, x, y);
  } });
  let raf = 0, last = performance.now(), frames = 0, t = 0, lastLevels = '', lastTowers = '', lastStep = -1;
  /* The sun's shadow map is drawn only when something that casts a shadow changes: a building or tower built or
     raised, a tower head turning (at most every third frame), an entrance sinking as the camera turns, the graphics
     tier, and every 60 frames besides. Raiders and moving parts cast none (a soft shadow under each raider instead), so
     a still town no longer draws every object twice a frame (Room on the Silver Falls script gate, 2026.11.21-4). */
  const shadows = v.renderer.shadowMap; shadows.autoUpdate = false;
  let shadowAt = -1e9, shadowKey = '', shadowDraws = 0;
  const size = { w: 0, h: 0 }; // the canvas as measured at the top of this frame (project reads it, never the page)
  const api = {
    view: v, board, battle, rig, game, selection, holds: new Set(),
    /* Highlight what a card is open for: { plot }, { spot } or null. */
    select: target => { selection.set(target); if (!target) rig.keep(null); },
    /* What covers the board (client pixels): the top bar's lower edge, and the open card's box or null. Read by the
       interface five times a second; the camera refits its home view and keeps the selected thing clear of the card. */
    setView(top, cover, low = null) {
      rig.setView(top, cover, low);
      const tg = selection.target, B = town.def.board;
      if (!tg) return;
      // a raider: the map slides only when it walks under the card, so its ring stays in sight (it never chases it)
      if (tg.foe !== undefined) { const u = battle.foes.get(tg.foe); if (u) rig.keep({ x: u.obj.position.x, y: .4, z: u.obj.position.z }, 'f' + tg.foe, 0); return; }
      // a building's workers by the road: kept clear of the card like a raider (smoke, 2026.11.22-11: a worker target
      // fell through to the pads and threw every frame)
      if (tg.worker !== undefined) { const p = board.militia.points().find(q => q.id === tg.worker); if (p) rig.keep({ x: p.x, y: .3, z: p.z }, 'w' + tg.worker, 0); return; }
      const [x, z] = tg.plot ? B.plots[tg.plot] : B.spots[tg.spot];
      rig.keep({ x, y: tg.plot ? .6 : .3, z }, tg.plot ? 'p' + tg.plot : 's' + tg.spot, selection.reach || 0); // a tower's circle stays in view too
    },
    /* Slide the map so a tip card's target ({ plot }, { spot }, { tower } or { vault }) lands on screen point (x, y). */
    bring(tg, x, y) {
      const B = town.def.board, at = tg.vault ? B.vault : tg.plot ? B.plots[tg.plot] : B.spots[tg.spot !== undefined ? tg.spot : tg.tower];
      return !!at && rig.slideTo({ x: at[0], y: tg.plot || tg.vault ? .6 : .3, z: at[1] }, x, y);
    },
    get paused() { return api.holds.size > 0; },
    /* Pause or resume for a reason ('player', 'coach'...); the game runs when nothing holds it. */
    pause(reason, on) { if (on) api.holds.add(reason); else api.holds.delete(reason); },
    get frames() { return frames; },
    /* How many times the sun's shadow map was drawn (smoke checks it is not every frame). */
    get shadowDraws() { return shadowDraws; },
    /* The Graphics setting: 'auto' (the device's tier, stepping down when slow) or a tier kept as picked. */
    get quality() { return q.auto ? 'auto' : q.tier; },
    setQuality(choice) {
      Object.assign(q, choice === 'auto' ? autoQuality() : { auto: false, tier: choice, ratio: 0 });
      saveQuality(q); v.setQuality(q.tier, q.ratio);
    },
    project: id => project(v.cam, canvas, board.anchor(id, _a), size),
    projectPoint: (x, y, z) => project(v.cam, canvas, new THREE.Vector3(x, y, z), size),
    /* Where each raider on the road is drawn on screen (client pixels), for the level pills that step aside for them. */
    foePoints: () => { const out = []; for (const u of battle.foes.values()) if (u.obj.visible) { const p = project(v.cam, canvas, _a.set(u.obj.position.x, .45, u.obj.position.z), size); if (p) out.push(p); } return out; },
    /* Where a raider is drawn on screen, or null when it is gone or hidden in its entrance. */
    projectFoe: id => { const u = battle.foes.get(id); return u && u.obj.visible ? project(v.cam, canvas, _a.set(u.obj.position.x, u.obj.position.y + (u.boss ? .7 : .4), u.obj.position.z), size) : null; },
    /* Where a building's workers stand on screen while they are called to arms, or null. */
    projectWorker: id => { const p = board.militia.points().find(q => q.id === id); return p ? project(v.cam, canvas, _a.set(p.x, .3, p.z), size) : null; },
    projectSpot: i => { const [x, z] = town.def.board.spots[i], tw = town.towers.find(t => t.spot === i); return project(v.cam, canvas, new THREE.Vector3(x, tw ? 1.25 : .3, z), size); },
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
    size.w = w; size.h = h;
    v.resize(w, h); rig.fit(w / h, w, h);
    // the board only changes when the simulation steps: check then, not every frame
    const stepped = game.stats.steps !== lastStep; lastStep = game.stats.steps;
    const levels = stepped || !lastLevels ? JSON.stringify(town.buildings) : lastLevels;
    if (levels !== lastLevels) { board.sync(); lastLevels = levels; const f = board.focus(); rig.frame(f.x, f.z, f.w, f.d); }
    if (board.life.tier !== v.tier) board.life.setTier(v.tier);
    board.update(dt, t, id => !town.starved[id], rig.c, town.waves.foes.length > 0);
    const towers = stepped || !lastTowers ? town.towers.map(x => x.spot + x.kind + x.level + x.path + (x.fork || '')).join() : lastTowers;
    if (towers !== lastTowers) { battle.sync(); lastTowers = towers; }
    rig.update(dt);
    battle.update(dt, t, v.cam, game.clock.alpha, game.stats.steps);
    selection.update(t);
    let gates = ''; for (const e of board.entrances) gates += e.obj.scale.y + ',';
    const key = v.tier + '|' + lastLevels + '|' + lastTowers + '|' + gates, since = frames - shadowAt;
    if (key !== shadowKey || since >= 60 || (battle.shadowMoved && since >= 3)) { shadows.needsUpdate = true; shadowAt = frames; shadowKey = key; shadowDraws++; }
    v.render(); frames++;
    onFrame(dt);
  }
  // the dive in from the map: the town waits until the camera settles, so its wave clock never runs out while the player
  // is still flying in (review of 2026.11.19-13: "in 1s" before the camera settled). At most 3 seconds.
  if (flyIn) {
    api.holds.add('fly');
    const t0 = performance.now(), land = () => {
      if (!api.holds.has('fly')) return;
      const near = rig.fitted && Math.abs(rig.c.dist - rig.t.dist) < rig.t.dist * .03 && Math.abs(rig.c.pitch - rig.t.pitch) < .02;
      if (near || performance.now() - t0 > 3000) api.holds.delete('fly'); else requestAnimationFrame(land);
    };
    requestAnimationFrame(land);
  }
  raf = requestAnimationFrame(frame);
  return api;
}

/* Points along each lane, every ROAD_STEP units, from where its raiders come out of the entrance to the vault. */
export function roadPoints(town) {
  const B = town.def.board, hide = [(B.entrance && B.entrance.hide) || 0, (B.river && B.river.entrance && B.river.entrance.hide) || 0], out = [];
  lanesOf(town).forEach((L, i) => { for (let s = hide[i] || 0; s <= L.length; s += ROAD_STEP) out.push(pointAt(L, s)); });
  return out;
}
