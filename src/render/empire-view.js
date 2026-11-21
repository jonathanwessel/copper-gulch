/* The empire map in 3D (GDD.md, Empire map): open country with every town as a small diorama of its board (its
   buildings at their tiers, its road and entrance, its vault and towers) standing on land that fits it (the plan is in
   src/render/empire-plan.js, the models in src/render/empire-land.js), surveyed land with a surveyors' camp where a
   town is not open yet and in the middle where the Capital will stand, and roads between towns that carry goods, with
   wagons rolling along them (more and faster as a route gets busier), laid with rails and run by trains once the Rail
   Office is founded. Cloud shadows drift over all of it. The game keeps running while the map is up. Every gesture
   moves the map under the fingers (src/render/camera.js). startEmpireView returns an api the interface uses. */
import * as THREE from 'three';
import { createScene } from './scene.js';
import { startQuality, autoStep } from './autoquality.js';
import { CameraRig } from './camera.js';
import { makeGround, fbm, sstep, lerp } from './terrain.js';
import { Kit, rng } from './kit.js';
import { roadRibbon, riverRibbon, bridges, disposeTree, tierOf } from './board.js';
import { makeBuilding, makeVault, makeStockpile, PROPS } from '../assets/models/gulch.js';
import { makeTower } from '../assets/models/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TOWNS } from '../data/towns/index.js';
import { DIORAMA } from '../data/empire.js';
import { mapSites, mapRoutes, wagonsFor } from '../core/map.js';
import { capitalOpen } from '../core/capital.js';
import { makeCity, makeInstitution, cityState } from '../assets/models/capital.js';
import { CITY } from '../data/capital.js';
import { rectDist, gateDist, polyDist, blockers, routeLine, mesaPlan, flavor, camp, routeKind, duneHeight } from './empire-plan.js';
import { CLOUD, cloudy, mapMaterials, mesas, flavorModels, fallsModels, creekModels, entranceModels, surveyed, roadModel, railModel, routeBridges, engineGeometry, carGeometry, merged } from './empire-land.js';
import '../assets/models/ridge.js';

const S = DIORAMA, MAXWAGONS = 48, MAXTRAINS = 24, MAXCARS = 72, GAP = .36;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3(), _e = new THREE.Euler(), _v = new THREE.Vector3();
/* How far a site reaches on the map (map units): an open town's board at diorama scale, the Capital's plaza, or a
   surveyed plot. */
export const siteRadius = id => {
  const d = TOWNS[id];
  return d ? Math.max(d.board.cols, d.board.rows) * S * .62 : id === 'capital' ? CITY.plaza : 2.2;
};
const RISE = .9; // seconds a newly founded institution takes to rise out of its lot

/* A town's diorama: its board at diorama scale, merged into a few meshes, standing straight on the map's ground (no
   plate under it: the ground there takes the town's own colors), with its entrance. Rebuilt when a tier or a tower
   changes. */
function diorama(town) {
  const B = town.def.board, look = B.look, objs = [];
  objs.push(roadRibbon(B.road, [new THREE.Color(look.dirt), new THREE.Color(look.rut), new THREE.Color('#a57a52')]));
  if (B.river) { const r = B.river.path.concat([B.vault]), w = riverRibbon(r, look, B.river.width || 1.1); w.position.y = .05; objs.push(w, ...bridges(B.road, r)); }
  objs.push(...entranceModels(B));
  for (const [id, [x, z]] of Object.entries(B.plots)) {
    const level = town.level(id);
    if (!(level > 0) || !BUILDINGS[id]) continue;
    const b = makeBuilding(BUILDINGS[id].model, tierOf(level)); b.obj.position.set(x, 0, z); objs.push(b.obj);
  }
  const vault = town.def.store === 'stockpile' ? makeStockpile() : makeVault(1); vault.position.set(B.vault[0], 0, B.vault[1]); objs.push(vault);
  for (const t of town.towers || []) {
    const o = makeTower(t.kind, t.path, t.level), [x, z] = B.spots[t.spot]; o.position.set(x, 0, z); objs.push(o);
  }
  const g = merged(objs);
  g.scale.setScalar(S);
  return g;
}
const signature = town => Object.keys(town.def.board.plots).map(id => tierOf(town.level(id)) * (town.level(id) > 0 ? 1 : 0)).join() + '|' + (town.towers || []).map(t => t.spot + t.kind + t.level + (t.path || '')).join();

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

/* A route's line as a path wagons follow: { pts: [[x, z]], len, at(u, out) } with u from 0 to 1. */
function pathOf(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1] || 1;
  const at = (u, out) => {
    const s = Math.max(0, Math.min(1, u)) * len;
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), p0 = pts[i - 1], p1 = pts[i];
    out.x = lerp(p0[0], p1[0], f); out.z = lerp(p0[1], p1[1], f); out.yaw = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
    return out;
  };
  return { pts, len, at };
}

/* One instanced mesh for a moving kind (wagons, engines, cars). */
function fleet(geo, mat, max) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
  return m;
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
  const mats = mapMaterials(), add = o => { root.add(mats.apply(o)); return o; };
  // every road and rail bed on the map shares one material (one draw for all of them)
  const ribbonMat = cloudy(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 }));
  const flat = objs => { for (const o of objs) o.traverse(n => { if (n.isMesh && n.material.userData.own && n.material !== ribbonMat && (n.name === 'road' || n.name === 'rails' || n.name === 'creek')) { n.material.dispose(); n.material = ribbonMat; } }); return objs; };

  // every pair of towns a route could join (routes appear as goods move): each pair's road is laid out once, clear of
  // every board, entrance and the Capital's plaza, and a link uses it in either direction
  const B = blockers(sites), river = B.river, creek = B.creek, paths = {};
  for (const a of sites) for (const b of sites) if (a.id < b.id && !a.capital && !b.capital) paths[a.id + '|' + b.id] = pathOf(routeLine(a, b, B).pts);
  const pathPts = Object.values(paths).map(p => p.pts);
  // land not open yet takes only a hint of its town's colors (the ground is laid once, when the map opens)
  const feet = B.towns.map(([id, f]) => [id, f, TOWNS[id].board.look, game.towns[id] ? 1 : .35]);
  const height = (x, z) => {
    let h = (fbm(x * .07 + 2, z * .07) - .45) * 2.4 + (fbm(x * .4, z * .4) - .5) * .25, flat = 0, road = 0;
    for (const [, f] of feet) {
      flat = Math.max(flat, 1 - sstep(.3, 3, rectDist(x, z, f.rect)));
      for (const g of f.gates) flat = Math.max(flat, 1 - sstep(0, 2.5, gateDist(x, z, g)));
    }
    for (const s of sites) if (!TOWNS[s.id]) flat = Math.max(flat, 1 - sstep(siteRadius(s.id) + .4, siteRadius(s.id) + 3, Math.hypot(x - s.at[0], z - s.at[1])));
    for (const pts of pathPts) road = Math.max(road, 1 - sstep(1.2, 4, polyDist(x, z, pts)));
    if (river) road = Math.max(road, 1 - sstep(river.width, river.width + 3, polyDist(x, z, river.pts)));
    if (creek) road = Math.max(road, 1 - sstep(creek.width, creek.width + 2.5, polyDist(x, z, creek.pts)));
    flat = Math.max(flat, road);
    h = Math.max(-.3, h);
    return lerp(h, -.02, flat) + duneHeight(x, z) * (1 - road);
  };
  // the ground: open desert, and round each board its own town's colors, so a town sits on its land with no tile under it
  const sand = new THREE.Color('#d8b382'), sandD = new THREE.Color('#bf9465'), tint = new THREE.Color(), tint2 = new THREE.Color();
  const bank = new THREE.Color('#8f9a5a'), bedC = new THREE.Color('#e4cc9c'), pineG = new THREE.Color('#a7a072');
  const color = (x, z, c) => {
    c.copy(sand).lerp(sandD, fbm(x * .3 + 3, z * .3));
    for (const [id, f, look, open] of feet) {
      let d = rectDist(x, z, f.rect);
      for (const g of f.gates) d = Math.min(d, gateDist(x, z, g) + .8);
      if (d > 7) continue;
      tint.set(look.sand).lerp(tint2.set(look.sandD), fbm(x * .5 + 9, z * .5) * .8);
      c.lerp(tint, (1 - sstep(-1.2, 3.2, d)) * open * .8);
      if (id === 'pinehollow') c.lerp(pineG, (1 - sstep(1, 7, d)) * .35);
    }
    if (river) { const d = polyDist(x, z, river.pts); if (d < 1.8) c.lerp(bank, (1 - sstep(.4, 1.8, d)) * .4); }
    if (creek) { const d = polyDist(x, z, creek.pts); if (d < 1.4) c.lerp(bedC, (1 - sstep(.3, 1.4, d)) * .5); }
  };
  const W = Math.max(90, (x1 - x0) + 50), D = Math.max(100, (z1 - z0) + 50);
  const ground = makeGround({ cx: center.x, cz: center.z, w: W, d: D, seg: 110, height, color });
  add(ground);
  // the land: varied mesas round the edge, the land that fits each town, the river and the falls, the dry creek, and
  // scenery between the towns, merged into a few meshes
  const free = (x, z, m) => !B.hit(x, z, m) && !pathPts.some(pts => polyDist(x, z, pts) < .6 + m) && !(river && polyDist(x, z, river.pts) < river.width * .6 + m) && !(creek && polyDist(x, z, creek.pts) < creek.width * .6 + m * .5);
  const land = [...mesas(mesaPlan({ x0, x1, z0, z1 }, sites))];
  for (const s of sites) if (TOWNS[s.id]) land.push(...flavorModels(flavor(s.id, free).map(p => ({ ...p, y: Math.max(0, height(p.x, p.z)) - .02 }))));
  if (river) land.push(...fallsModels(river));
  if (creek) land.push(...flat(creekModels(creek)));
  const R = rng(41);
  for (let i = 0, placed = 0; i < 500 && placed < 60; i++) {
    const x = x0 - 3 + R() * (x1 - x0 + 6), z = z0 - 3 + R() * (z1 - z0 + 6);
    if (!free(x, z, 1.1)) continue;
    const nearPines = at.pinehollow && Math.hypot(x - at.pinehollow[0], z - at.pinehollow[1]) < 9;
    const kind = nearPines ? (R() < .55 ? 'tree' : 'shrub') : R() < .35 ? 'cactus' : R() < .55 ? 'rock' : R() < .8 ? 'shrub' : 'boulder', o = PROPS[kind](1, i * 7);
    o.position.set(x, Math.max(0, height(x, z)) - .02, z); o.rotation.y = R() * 6; o.scale.setScalar(.9 + R() * .8);
    land.push(o); placed++;
  }
  add(merged(land));

  v.sun.position.set(center.x - 14, 26, center.z + 12); v.sun.target.position.copy(center);
  const sc = v.sun.shadow.camera, half = Math.max(x1 - x0, z1 - z0) / 2 + 2; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.far = 90; sc.updateProjectionMatrix();

  // the dioramas and the surveyed land, kept in step with the game once a second
  const dio = {}, plots = {};
  const placeSites = () => {
    for (const s of sites) {
      const town = game.towns[s.id];
      if (town) {
        if (plots[s.id]) { root.remove(plots[s.id]); disposeTree(plots[s.id]); delete plots[s.id]; }
        const sig = signature(town), cur = dio[s.id];
        if (cur && cur.sig === sig) continue;
        if (cur) { root.remove(cur.obj); disposeTree(cur.obj); }
        const obj = diorama(town), TB = town.def.board;
        obj.position.set(s.at[0] - TB.cols / 2 * S, 0, s.at[1] - TB.rows / 2 * S);
        add(obj); dio[s.id] = { obj, sig };
      } else if (s.capital && capitalOpen(game)) {
        if (plots[s.id]) { root.remove(plots[s.id]); disposeTree(plots[s.id]); delete plots[s.id]; }
        placeCity(s);
      } else if (!plots[s.id]) {
        const o = surveyed(s.capital, camp([0, 0])); o.position.set(s.at[0], 0, s.at[1]);
        // a town with a river shows it running across its plot already, so the river from the falls ends somewhere
        const TB = TOWNS[s.id] && TOWNS[s.id].board;
        if (TB && TB.river) { const w = riverRibbon(TB.river.path.concat([TB.vault]).map(p => [(p[0] - TB.cols / 2) * S, (p[1] - TB.rows / 2) * S]), TB.look, (TB.river.width || 1.1) * S); w.position.y = .004; o.add(w);
          // it ends in a pond where the town's vault will stand
          const pond = new THREE.Mesh(new THREE.CircleGeometry(.62, 14).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: TB.look.water || '#3f7fa8' })); pond.material.userData.own = true;
          pond.position.set((TB.vault[0] - TB.cols / 2) * S, .006, (TB.vault[1] - TB.rows / 2) * S); o.add(pond); }
        add(o); plots[s.id] = o;
      }
    }
  };
  // the Capital's city: rebuilt when an institution is founded or the contract board changes. A newly founded
  // institution rises out of its lot on its own, then is merged back into the city.
  const rising = {};
  function placeCity(s) {
    const st = cityState(game.shared.capital, game.shared.tree), cur = dio[s.id];
    const fresh = cur ? st.founded.filter(id => !cur.founded.includes(id) && !rising[id]) : [];
    for (const id of fresh) { const o = makeInstitution(id); o.position.x += s.at[0]; o.position.z += s.at[1]; o.position.y = .02; o.scale.set(.7, .01, .7); add(o); rising[id] = { obj: o, t: 0 }; }
    const key = st.key + '|' + Object.keys(rising).join();
    if (cur && cur.sig === key) return;
    if (cur) { root.remove(cur.obj); disposeTree(cur.obj); }
    const obj = makeCity({ ...st, skip: Object.keys(rising) }); obj.position.set(s.at[0], .02, s.at[1]);
    add(obj); dio[s.id] = { obj, sig: key, founded: st.founded.slice() };
  }
  const riseCity = dt => {
    let done = false;
    for (const [id, r] of Object.entries(rising)) {
      r.t += dt;
      const u = Math.min(1, r.t / RISE), back = 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2; // ease out with a small overshoot
      r.obj.scale.set(.7 + .3 * Math.min(1, u * 1.6), Math.max(.01, back), .7 + .3 * Math.min(1, u * 1.6));
      if (u >= 1) { root.remove(r.obj); disposeTree(r.obj); delete rising[id]; done = true; }
    }
    if (done) placeCity(capSite);
  };
  const capSite = sites.find(s => s.capital);
  placeSites();

  // routes: a dirt road for each link that has carried goods, with wagons on it; once the Rail Office is founded every
  // route is laid with rails and trains run on it. A plank bridge carries a route over the river.
  const routes = {};
  let kind = routeKind(game);
  const placeRoutes = () => {
    const k = routeKind(game);
    if (k !== kind) { kind = k; for (const r of Object.values(routes)) { root.remove(r.road); disposeTree(r.road); } for (const key of Object.keys(routes)) delete routes[key]; }
    for (const l of mapRoutes(game)) {
      if (routes[l.key]) continue;
      const rev = l.from > l.to, path = paths[rev ? l.to + '|' + l.from : l.from + '|' + l.to];
      if (!path || path.pts.length < 2) continue;
      const parts = flat(kind === 'rail' ? railModel(path.pts) : roadModel(path.pts));
      if (river) parts.push(...routeBridges(path.pts, river));
      const road = merged(parts, { cast: false }); road.name = kind === 'rail' ? 'rails' : 'road'; add(road);
      routes[l.key] = { ...path, rev, road, phase: (l.key.length * .137) % 1 };
    }
  };
  placeRoutes();
  const wagons = fleet(wagonGeometry(), mats.solid, MAXWAGONS), engines = fleet(engineGeometry(), mats.solid, MAXTRAINS), cars = fleet(carGeometry(), mats.solid, MAXCARS);
  root.add(wagons, engines, cars);
  const pos = { x: 0, z: 0, yaw: 0 };
  const put = (mesh, n, r, u, y, bob, t, i, scale = 1.5) => {
    r.at(r.rev ? 1 - u : u, pos); if (r.rev) pos.yaw += Math.PI;
    _e.set(0, pos.yaw, bob ? Math.sin(t * 9 + i * 2) * .03 : 0); _q.setFromEuler(_e);
    _p.set(pos.x, y + (bob ? Math.abs(Math.sin(t * 6 + i)) * .015 : 0), pos.z); _s.setScalar(scale);
    _m.compose(_p, _q, _s); mesh.setMatrixAt(n, _m);
  };
  const rollWagons = (dt, t) => {
    let nw = 0, ne = 0, nc = 0;
    for (const [key, r] of Object.entries(routes)) {
      const look = wagonsFor(meter ? meter.flow[key] || 0 : 0);
      if (!look.count) continue;
      if (kind === 'rail') { // trains: one for every two wagons' worth, two to four cars each, a little faster
        const trains = Math.max(1, Math.round(look.count / 2)), ncar = Math.min(4, 2 + Math.floor(look.count / 3)), gap = GAP / r.len;
        r.phase = (r.phase + dt * look.speed * 1.3 / r.len) % 1;
        for (let i = 0; i < trains && ne < MAXTRAINS; i++) {
          const u = (r.phase + i / trains) % 1;
          if (u < gap * ncar || u > 1 - .01) continue; // the whole train is on the line before it shows
          put(engines, ne++, r, u, .03, false, t, i, 1.1);
          for (let c = 1; c <= ncar && nc < MAXCARS; c++) put(cars, nc++, r, u - c * gap, .03, false, t, i, 1.1);
        }
        continue;
      }
      r.phase = (r.phase + dt * look.speed / r.len) % 1;
      for (let i = 0; i < look.count && nw < MAXWAGONS; i++) put(wagons, nw++, r, (r.phase + i / look.count) % 1, .02, true, t, i);
    }
    wagons.count = nw; engines.count = ne; cars.count = nc;
    wagons.instanceMatrix.needsUpdate = engines.instanceMatrix.needsUpdate = cars.instanceMatrix.needsUpdate = true;
  };

  // the selected site: a pulsing ring on the ground round it, for as long as its card is open
  const ring = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 48), new THREE.MeshBasicMaterial({ color: '#f0c14a', transparent: true, opacity: .85, depthWrite: false }));
  ring.material.userData.own = true; ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 2; root.add(ring);
  let selected = null;

  // the camera: the whole map at home; tap a town to open its card
  const rig = new CameraRig(v.cam, canvas, { center, size: Math.max(x1 - x0, z1 - z0) * 1.1, pads: [], fitCover: true, onTap: (x, y) => onTap(api.siteAt(x, y), x, y) });
  rig.min = 5; rig.max = 110;
  rig.frame(center.x, center.z, x1 - x0, z1 - z0);
  let raf = 0, last = performance.now(), frames = 0, t = 0, sync = 0, opened = false;
  const size = { w: 0, h: 0 }; // the canvas as measured at the top of this frame (the badges read it, never the page)
  const api = {
    view: v, rig, game, holds: new Set(), sites,
    get paused() { return api.holds.size > 0; },
    pause(reason, on) { if (on) api.holds.add(reason); else api.holds.delete(reason); },
    get frames() { return frames; },
    get dioramas() { return Object.keys(dio); },
    get routes() { return Object.keys(routes); },
    get routeKind() { return kind; },
    get wagons() { return wagons.count; },
    get trains() { return engines.count; },
    /* What the map's land is made of, for the checks: no plate under any town, the camps on land not open yet. */
    get land() {
      let plates = 0;
      for (const d of Object.values(dio)) d.obj.traverse(o => { if (o.isMesh && o.name === 'plate') plates++; });
      return { plates, camps: Object.keys(plots), clouds: CLOUD.k.value };
    },
    /* The Capital's city as drawn: the institutions standing (merged or rising), those still rising, and how far the
       nearest road between two towns passes outside its plaza (map units, from the road's middle). */
    get city() {
      const c = dio.capital;
      return c ? { founded: c.founded.slice(), rising: Object.keys(rising), clear: Math.min(...Object.values(paths).flatMap(p => p.pts.map(q => Math.hypot(q[0] - at.capital[0], q[1] - at.capital[1])))) - CITY.plaza } : null;
    },
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
      // the built Capital is tall: its badge floats over the capitol's flag instead of covering the dome
      if (id === 'capital' && dio.capital) _v.set(s[0] + CITY.capitol.at[0], 2.35, s[1] + CITY.capitol.at[1]).project(v.cam);
      else _v.set(s[0] - Math.sin(yaw) * r, 0, s[1] - Math.cos(yaw) * r).project(v.cam);
      if (_v.z > 1) return null;
      return { x: (_v.x + 1) / 2 * (size.w || canvas.clientWidth), y: (1 - _v.y) / 2 * (size.h || canvas.clientHeight) }; // this frame's size: no layout per badge
    },
    /* The built Capital's box on screen (client pixels), or null: toasts keep off it (review of 2026.11.19-13: "upgrade
       bought" sat on the dome). The whole plaza, not only the capitol (review of 2026.11.20-3: a toast sat over the
       institutions round it). */
    capitolBox() {
      if (!dio.capital) return null;
      const s = at.capital, P = CITY.plaza, W = size.w || canvas.clientWidth, H = size.h || canvas.clientHeight;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) for (const y of [0, 2.4]) {
        _v.set(s[0] + dx * P, y, s[1] + dz * P).project(v.cam);
        if (_v.z > 1) return null;
        const x = (_v.x + 1) / 2 * W, yy = (1 - _v.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
      }
      return x1 < 0 || x0 > W || y1 < 0 || y0 > H ? null : { l: x0, t: y0, r: x1, b: y1 };
    },
    projectSite(id) {
      const s = at[id]; _v.set(s[0], .6, s[1]).project(v.cam);
      return _v.z > 1 ? null : { x: (_v.x + 1) / 2 * (size.w || canvas.clientWidth), y: (1 - _v.y) / 2 * (size.h || canvas.clientHeight) };
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
    stop(lose = false) { cancelAnimationFrame(raf); disposeTree(root); mats.dispose(); ribbonMat.dispose(); v.dispose(); if (lose) v.renderer.forceContextLoss(); },
  };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (document.hidden || v.lost) return;
    step(dt);
    if (!api.paused) game.advance(dt);
    if (meter) meter.update(game);
    t += dt;
    if (!api.paused) CLOUD.t.value += dt;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    size.w = w; size.h = h;
    v.resize(w, h); rig.fit(w / h, w, h);
    if (!opened && rig.fitted) { // coming out of a town: start low over it and rise to the whole map
      opened = true;
      if (from && at[from]) Object.assign(rig.c, { x: at[from][0], z: at[from][1], dist: 7, pitch: Math.min(1.2, rig.home.pitch + .1), yaw: rig.home.yaw });
    }
    if ((sync -= dt) <= 0) { sync = 1; placeSites(); placeRoutes(); }
    rollWagons(api.paused ? 0 : dt, t);
    if (dio.capital) placeCity(capSite); // a founding shows at once, not on the next sync
    riseCity(dt);
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
