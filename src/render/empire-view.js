/* The empire map in 3D (GDD.md, Empire map): open country with every town as a small diorama of its board (its
   buildings at their tiers, its road, its vault and towers), surveyed land where a town is not open yet and in the
   middle where the Capital will stand, and dirt roads between towns that carry goods, with wagons rolling along them
   (more and faster as a route gets busier). The game keeps running while the map is up. Every gesture moves the map
   under the fingers (src/render/camera.js). startEmpireView returns an api the interface uses. */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { startQuality, autoStep } from './autoquality.js';
import { CameraRig } from './camera.js';
import { makeGround, makeMesas, polyDist, fbm, sstep, lerp } from './terrain.js';
import { Kit, MAT, mergeStatic, rng } from './kit.js';
import { roadRibbon, disposeTree, tierOf } from './board.js';
import { makeBuilding, makeVault, makeStockpile, PROPS } from '../assets/models/gulch.js';
import { makeTower } from '../assets/models/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TOWNS } from '../data/towns/index.js';
import { DIORAMA } from '../data/empire.js';
import { mapSites, mapRoutes, wagonsFor } from '../core/map.js';
import { capitalOpen } from '../core/capital.js';
import '../assets/models/ridge.js';

const S = DIORAMA, MAXWAGONS = 48;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
/* How far a site reaches on the map (map units): an open town's board at diorama scale, or a surveyed plot. */
export const siteRadius = id => {
  const d = TOWNS[id];
  return d ? Math.max(d.board.cols, d.board.rows) * S * .62 : 2.2;
};

/* A town's diorama: its board at diorama scale, merged into a few meshes. Rebuilt when a tier or a tower changes. */
function diorama(town) {
  const B = town.def.board, look = B.look, objs = [];
  const plate = new Kit({ ao: false });
  plate.box(B.cols / 2, -.2, B.rows / 2, B.cols + 1.2, .2, B.rows + 1.2, look.sandD);
  plate.box(B.cols / 2, -.06, B.rows / 2, B.cols + .9, .08, B.rows + .9, look.sand);
  objs.push(plate.build({ cast: false }));
  objs.push(roadRibbon(B.road, [new THREE.Color(look.dirt), new THREE.Color(look.rut), new THREE.Color('#a57a52')]));
  for (const [id, [x, z]] of Object.entries(B.plots)) {
    const level = town.level(id);
    if (!(level > 0) || !BUILDINGS[id]) continue;
    const b = makeBuilding(BUILDINGS[id].model, tierOf(level)); b.obj.position.set(x, 0, z); objs.push(b.obj);
  }
  const vault = town.def.store === 'stockpile' ? makeStockpile() : makeVault(1); vault.position.set(B.vault[0], 0, B.vault[1]); objs.push(vault);
  for (const t of town.towers || []) {
    const o = makeTower(t.kind, t.path, t.level), [x, z] = B.spots[t.spot]; o.position.set(x, 0, z); objs.push(o);
  }
  const g = mergeStatic(objs);
  objs.forEach(disposeTree);
  g.scale.setScalar(S);
  return g;
}
const signature = town => Object.keys(town.def.board.plots).map(id => tierOf(town.level(id)) * (town.level(id) > 0 ? 1 : 0)).join() + '|' + (town.towers || []).map(t => t.spot + t.kind + t.level + (t.path || '')).join();

/* Surveyed land: stakes and string round a plot, a sign, and for the Capital a gold flag. */
function surveyed(capital) {
  const k = new Kit({ ao: false }), R = rng(capital ? 3 : 9), n = capital ? 10 : 6, r = capital ? 2.1 : 1.6;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r * .8;
    k.box(x, 0, z, .07, .3, .07, 'woodL');
    const b = (i + 1) / n * Math.PI * 2, x2 = Math.cos(b) * r, z2 = Math.sin(b) * r * .8, L = Math.hypot(x2 - x, z2 - z);
    k.box((x + x2) / 2, .24, (z + z2) / 2, .015, .015, L, 'white', { ry: Math.atan2(x2 - x, z2 - z), ao: false });
  }
  k.box(.3, 0, .2, .06, .6, .06, 'woodD'); k.box(.3, .42, .23, .46, .24, .03, 'cream');
  if (capital) { k.box(-.2, 0, -.3, .05, 1.2, .05, 'woodD'); k.box(.05, .92, -.3, .46, .26, .02, 'gold'); }
  for (let i = 0; i < 4; i++) k.dode(-1 + R() * 2, .05, -.8 + R() * 1.6, .1 + R() * .08, R() < .5 ? 'rock' : 'rockD');
  return k.build();
}

/* The Capital once it is built: a white capitol with columns, steps and a copper dome, a flag on top, a plaza in front
   and two low office blocks, merged into one model. (The full city comes with its institutions.) */
function capitol() {
  const k = new Kit({ ao: false });
  k.box(0, 0, 0, 4.4, .08, 3.6, 'stoneL');                    // the plaza
  k.box(0, .08, -.5, 2.6, .18, 1.4, 'stone');                 // the base
  for (let i = 0; i < 3; i++) k.box(0, .08 + i * .06, .3 + i * -.06, 1.2, .06, .3, 'stoneL'); // steps
  k.box(0, .26, -.6, 2.2, .7, 1, 'white');                    // the hall
  for (let i = 0; i < 6; i++) k.cyl(-.75 + i * .3, .26, .02, .06, .62, 'cream');               // the columns
  k.box(0, .88, -.1, 1.9, .1, .3, 'white');                   // the beam over the columns
  k.gable(0, .98, -.1, 1.9, .3, .26, 'cream');
  k.cyl(0, .96, -.6, .46, .3, 'white', { seg: 12 });          // the drum
  k.ball(0, 1.26, -.6, .44, 'verd', { det: 1 });              // the dome
  k.cyl(0, 1.66, -.6, .015, .5, 'ink');                       // the flagpole
  k.box(.13, 2.0, -.6, .24, .14, .02, 'paintR');
  for (const x of [-1.7, 1.7]) { k.box(x, .08, -.4, .8, .45, 1.1, 'adobeL'); k.hip(x, .53, -.4, .9, 1.2, .22, 'roofS'); }
  for (const x of [-1.2, 1.2]) { k.cyl(x, .08, .9, .03, .55, 'iron'); k.ball(x, .66, .9, .07, 'glowW'); } // lamps
  return k.build();
}

/* A supply wagon (one mesh, so every wagon on the map is one instanced draw): bed, canvas cover, wheels, a mule. */
function wagonGeometry() {
  const k = new Kit({ ao: false });
  k.box(0, .1, 0, .3, .1, .5, 'wood');
  k.ball(0, .2, 0, .17, 'cream', { sy: .8, sz: 1.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(sx * .17, .02, sz * .17, .08, .04, 'woodD', { rz: Math.PI / 2, seg: 8 });
  k.box(0, .12, .42, .12, .14, .26, 'cloth'); k.box(0, .2, .58, .08, .1, .12, 'cloth');
  for (const sz of [.34, .5]) for (const sx of [-1, 1]) k.box(sx * .04, 0, sz, .03, .13, .03, 'woodD');
  const g = k.build({ cast: true }), mesh = g.children[0], geo = mesh.geometry;
  g.remove(mesh);
  return geo;
}

/* A route's road: a gentle curve from one site's edge to the other's. Returns { pts: [[x, z]], len, at(u, out) }. */
function routePath(a, b, ra, rb, avoid) {
  const A = new THREE.Vector3(a[0], 0, a[1]), B = new THREE.Vector3(b[0], 0, b[1]), mid = A.clone().add(B).multiplyScalar(.5);
  const d = B.clone().sub(A), n = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(d.length() * .3);
  // bow out on the side away from the Capital's site, so no road crosses it
  const c1 = mid.clone().add(n), c2 = mid.clone().sub(n), far = p => Math.hypot(p.x - avoid[0], p.z - avoid[1]);
  const curve = new THREE.QuadraticBezierCurve3(A, far(c1) >= far(c2) ? c1 : c2, B);
  const all = curve.getSpacedPoints(Math.ceil(curve.getLength() / .3));
  const pts = all.filter(p => Math.hypot(p.x - A.x, p.z - A.z) > ra && Math.hypot(p.x - B.x, p.z - B.z) > rb).map(p => [p.x, p.z]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1] || 1;
  // a point and heading u of the way along (0 to 1)
  const at = (u, out) => {
    const s = u * len;
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), p0 = pts[i - 1], p1 = pts[i];
    out.x = lerp(p0[0], p1[0], f); out.z = lerp(p0[1], p1[1], f); out.yaw = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    return out;
  };
  return { pts, len, at };
}

export function startEmpireView(canvas, game, { onTap = () => {}, onFrame = () => {}, from = null, meter = null } = {}) {
  const q = startQuality(), v = createScene(canvas, { tier: q.tier, fov: 36 });
  if (!v) return null;
  const step = autoStep(v, q);
  v.scene.fog.near = 60; v.scene.fog.far = 150; v.cam.far = 260; v.cam.updateProjectionMatrix();
  v.sky.scale.setScalar(2.2);
  const sites = mapSites(game), at = Object.fromEntries(sites.map(s => [s.id, s.at]));
  const xs = sites.map(s => s.at[0]), zs = sites.map(s => s.at[1]);
  const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, z0 = Math.min(...zs) - 4, z1 = Math.max(...zs) + 4.5;
  const center = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const root = new THREE.Group(); root.name = 'empire'; v.scene.add(root);

  // every pair of towns a route could join, for the flat strips of the ground (routes appear as goods move)
  // (each pair's road is laid out once; a link uses it in either direction)
  const pairs = [], paths = {};
  for (const a of sites) for (const b of sites) if (a.id < b.id && !a.capital && !b.capital) {
    pairs.push([a, b]);
    paths[a.id + '|' + b.id] = routePath(a.at, b.at, siteRadius(a.id) * .9, siteRadius(b.id) * .9, at.capital);
  }
  const pathPts = Object.values(paths).map(p => p.pts);
  const height = (x, z) => {
    let h = (fbm(x * .07 + 2, z * .07) - .45) * 2.4 + (fbm(x * .4, z * .4) - .5) * .25;
    let flat = 0;
    for (const s of sites) flat = Math.max(flat, 1 - sstep(siteRadius(s.id) + .4, siteRadius(s.id) + 3, Math.hypot(x - s.at[0], z - s.at[1])));
    for (const pts of pathPts) { const r = polyDist(x, z, pts); flat = Math.max(flat, 1 - sstep(1.2, 4, r.d)); }
    h = Math.max(-.3, h);
    return lerp(h, -.02, flat);
  };
  const sand = new THREE.Color('#d8b382'), sandD = new THREE.Color('#bf9465'), tint = new THREE.Color();
  const looks = sites.filter(s => TOWNS[s.id]).map(s => [s.at, new THREE.Color(TOWNS[s.id].board.look.sand), siteRadius(s.id)]);
  const color = (x, z, c) => {
    c.copy(sand).lerp(sandD, fbm(x * .3 + 3, z * .3));
    for (const [[sx, sz], lc, r] of looks) { const d = Math.hypot(x - sx, z - sz); if (d < r + 5) c.lerp(tint.copy(lc), (1 - sstep(r, r + 5, d)) * .6); }
  };
  const W = Math.max(90, (x1 - x0) + 50), D = Math.max(100, (z1 - z0) + 50);
  const ground = makeGround({ cx: center.x, cz: center.z, w: W, d: D, seg: 110, height, color });
  root.add(ground);
  // mesas round the edge, and scenery between the towns, merged into a few meshes
  const R = rng(41), mesaSpots = [];
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + R() * .3, rx = (x1 - x0) / 2 + 14 + R() * 8, rz = (z1 - z0) / 2 + 13 + R() * 6; mesaSpots.push([center.x + Math.cos(a) * rx, center.z + Math.sin(a) * rz, 3 + R() * 3]); }
  const scenery = [makeMesas(mesaSpots)];
  for (let i = 0, placed = 0; i < 400 && placed < 70; i++) {
    const x = x0 - 3 + R() * (x1 - x0 + 6), z = z0 - 3 + R() * (z1 - z0 + 6);
    if (sites.some(s => Math.hypot(x - s.at[0], z - s.at[1]) < siteRadius(s.id) + 1.2) || pathPts.some(pts => polyDist(x, z, pts).d < 1.6)) continue;
    const kind = R() < .4 ? 'cactus' : R() < .6 ? 'rock' : R() < .8 ? 'shrub' : 'boulder', o = PROPS[kind](1, i * 7);
    o.position.set(x, Math.max(0, height(x, z)) - .02, z); o.rotation.y = R() * 6; o.scale.setScalar(.9 + R() * .8);
    scenery.push(o); placed++;
  }
  root.add(mergeStatic(scenery)); scenery.forEach(disposeTree);

  v.sun.position.set(center.x - 14, 26, center.z + 12); v.sun.target.position.copy(center);
  const sc = v.sun.shadow.camera, half = Math.max(x1 - x0, z1 - z0) / 2 + 2; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 90; sc.updateProjectionMatrix();

  // the dioramas and the surveyed land, kept in step with the game once a second
  const dio = {}, land = {};
  const placeSites = () => {
    for (const s of sites) {
      const town = game.towns[s.id];
      if (town) {
        if (land[s.id]) { root.remove(land[s.id]); disposeTree(land[s.id]); delete land[s.id]; }
        const sig = signature(town), cur = dio[s.id];
        if (cur && cur.sig === sig) continue;
        if (cur) { root.remove(cur.obj); disposeTree(cur.obj); }
        const obj = diorama(town), B = town.def.board;
        obj.position.set(s.at[0] - B.cols / 2 * S, .07, s.at[1] - B.rows / 2 * S);
        root.add(obj); dio[s.id] = { obj, sig };
      } else if (s.capital && capitalOpen(game)) {
        if (land[s.id]) { root.remove(land[s.id]); disposeTree(land[s.id]); delete land[s.id]; }
        if (!dio[s.id]) { const o = capitol(); o.position.set(s.at[0], .02, s.at[1]); root.add(o); dio[s.id] = { obj: o, sig: 'capitol' }; }
      } else if (!land[s.id]) {
        const o = surveyed(s.capital); o.position.set(s.at[0], 0, s.at[1]); root.add(o); land[s.id] = o;
      }
    }
  };
  placeSites();

  // routes: a dirt road for each link that has carried goods, and wagons on it
  const routes = {}, dirt = [new THREE.Color('#9a7550'), new THREE.Color('#7a5a3c'), new THREE.Color('#b38c62')];
  const placeRoutes = () => {
    for (const l of mapRoutes(game)) {
      if (routes[l.key]) continue;
      const rev = l.from > l.to, path = paths[rev ? l.to + '|' + l.from : l.from + '|' + l.to];
      if (!path || path.pts.length < 2) continue;
      const road = roadRibbon(path.pts, dirt, .7); road.position.y = .01; root.add(road);
      routes[l.key] = { ...path, rev, road, phase: (l.key.length * .137) % 1 };
    }
  };
  placeRoutes();
  const wagons = new THREE.InstancedMesh(wagonGeometry(), MAT.solid, MAXWAGONS);
  wagons.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wagons.count = 0; wagons.frustumCulled = false; wagons.castShadow = true; wagons.receiveShadow = true;
  root.add(wagons);
  const pos = { x: 0, z: 0, yaw: 0 };
  const rollWagons = (dt, t) => {
    let n = 0;
    for (const [key, r] of Object.entries(routes)) {
      const look = wagonsFor(meter ? meter.flow[key] || 0 : 0);
      if (!look.count) continue;
      r.phase = (r.phase + dt * look.speed / r.len) % 1;
      for (let i = 0; i < look.count && n < MAXWAGONS; i++) {
        const u = (r.phase + i / look.count) % 1;
        r.at(r.rev ? 1 - u : u, pos); if (r.rev) pos.yaw += Math.PI;
        _e.set(0, pos.yaw, Math.sin(t * 9 + i * 2) * .03); _q.setFromEuler(_e);
        _p.set(pos.x, .02 + Math.abs(Math.sin(t * 6 + i)) * .015, pos.z); _s.setScalar(1.5);
        _m.compose(_p, _q, _s); wagons.setMatrixAt(n++, _m);
      }
    }
    wagons.count = n; wagons.instanceMatrix.needsUpdate = true;
  };

  // the selected site: a pulsing ring on the ground round it, for as long as its card is open
  const ring = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 48), new THREE.MeshBasicMaterial({ color: '#f0c14a', transparent: true, opacity: .85, depthWrite: false }));
  ring.material.userData.own = true; ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 2; root.add(ring);
  let selected = null;

  // the camera: the whole map at home; tap a town to open its card
  const rig = new CameraRig(v.cam, canvas, { center, size: Math.max(x1 - x0, z1 - z0) * 1.1, pads: [], onTap: (x, y) => onTap(api.siteAt(x, y), x, y) });
  rig.min = 5; rig.max = 110;
  rig.frame(center.x, center.z, x1 - x0, z1 - z0);
  let raf = 0, last = performance.now(), frames = 0, t = 0, sync = 0, opened = false;
  const api = {
    view: v, rig, game, holds: new Set(), sites,
    get paused() { return api.holds.size > 0; },
    pause(reason, on) { if (on) api.holds.add(reason); else api.holds.delete(reason); },
    get frames() { return frames; },
    get dioramas() { return Object.keys(dio); },
    get routes() { return Object.keys(routes); },
    get wagons() { return wagons.count; },
    /* The site under a screen point (client pixels), or null. */
    siteAt(x, y) {
      const g = rig.ground(x, y);
      if (!g) return null;
      let best = null, bd = Infinity;
      for (const s of sites) { const d = Math.hypot(g.x - s.at[0], g.z - s.at[1]); if (d < siteRadius(s.id) + .6 && d < bd) { bd = d; best = s.id; } }
      return best;
    },
    /* Where a site's badge goes on screen: just past its diorama's far side, so the roads, which mostly leave a town
       toward the screen's top and bottom, stay in view below it. */
    badgePoint(id) {
      const s = at[id], r = siteRadius(id) * .8, yaw = rig.c.yaw;
      _v.set(s[0] - Math.sin(yaw) * r, 0, s[1] - Math.cos(yaw) * r).project(v.cam);
      if (_v.z > 1) return null;
      return { x: (_v.x + 1) / 2 * canvas.clientWidth, y: (1 - _v.y) / 2 * canvas.clientHeight };
    },
    projectSite(id) {
      const s = at[id]; _v.set(s[0], .6, s[1]).project(v.cam);
      return _v.z > 1 ? null : { x: (_v.x + 1) / 2 * canvas.clientWidth, y: (1 - _v.y) / 2 * canvas.clientHeight };
    },
    /* Ring a site (its card is open), or null. */
    select(id) { selected = id && at[id] ? id : null; if (!selected) rig.keep(null); },
    get selected() { return selected; },
    /* What covers the map (client pixels): the top bar's lower edge and the open card's box; the camera keeps the
       selected site clear of the card. */
    setView(top, cover) {
      rig.setView(top, cover);
      if (selected) rig.keep({ x: at[selected][0], y: 0, z: at[selected][1] }, selected);
    },
    /* Fly down into a site, then call done (the town view takes over and finishes the dive). */
    fly(id, done) {
      const s = at[id];
      Object.assign(rig.t, { x: s[0], z: s[1], dist: 6, pitch: Math.min(1.2, rig.c.pitch + .15), yaw: rig.c.yaw }); rig.flick = null;
      setTimeout(done, 380);
    },
    stop(lose = false) { cancelAnimationFrame(raf); disposeTree(root); v.dispose(); if (lose) v.renderer.forceContextLoss(); },
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (document.hidden || v.lost) return;
    step(dt);
    if (!api.paused) game.advance(dt);
    if (meter) meter.update(game);
    t += dt;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    v.resize(w, h); rig.fit(w / h, w, h);
    if (!opened && rig.fitted) { // coming out of a town: start low over it and rise to the whole map
      opened = true;
      if (from && at[from]) Object.assign(rig.c, { x: at[from][0], z: at[from][1], dist: 7, pitch: Math.min(1.2, rig.home.pitch + .1), yaw: rig.home.yaw });
    }
    if ((sync -= dt) <= 0) { sync = 1; placeSites(); placeRoutes(); }
    rollWagons(api.paused ? 0 : dt, t);
    ring.visible = !!selected;
    if (selected) { const r = siteRadius(selected) + .5 + Math.sin(t * 4) * .15; ring.position.set(at[selected][0], .09, at[selected][1]); ring.scale.setScalar(r); ring.material.opacity = .65 + Math.sin(t * 4) * .25; }
    rig.update(dt);
    // the whole map is seen from far away: move the near plane out with the camera, or a phone's depth buffer runs
    // short and the roads, a few hundredths above the ground, sink into it
    const near = Math.max(.3, rig.c.dist * .2);
    if (Math.abs(v.cam.near - near) > near * .05) { v.cam.near = near; v.cam.updateProjectionMatrix(); }
    v.render(); frames++;
    onFrame(dt);
  }
  raf = requestAnimationFrame(frame);
  return api;
}
