/* Picking: which plot is under a screen point. Models are tested first (a tall roof hides the ground behind it), then
   the ground, then the flat plane y = 0. */
import * as THREE from 'three';

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

export function groundPoint(cam, el, clientX, clientY) {
  const r = el.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  return ray;
}

/* What is under a screen point: { plot: id }, { spot: index } (a tower spot), or null. The models and each object's
   invisible tap target come first, then the ground, and last the nearest pad or plot within NEAR px of the finger. */
export const NEAR = 24;
const _c = new THREE.Vector3();
export function pickTarget(cam, el, board, clientX, clientY) {
  const r = groundPoint(cam, el, clientX, clientY);
  const posts = (board.hits || []).filter(h => board.town.towers.some(t => t.spot === h.userData.spot));
  const hits = r.intersectObjects(posts.length ? board.pickables.concat(posts) : board.pickables, false), m = hits[0];
  // a tower's tap post is wider and taller than the tower: when it covers a plot or another pad behind it (its model,
  // or its ground), the one whose middle is nearer the finger on screen wins
  if (m && m.object.userData.spot !== undefined && (board.hits || []).includes(m.object)) {
    const mine = m.object.userData.spot;
    const behind = hits.find(h => h.object.userData.plot || (h.object.userData.spot !== undefined && h.object.userData.spot !== mine)) || null;
    let other = behind ? (behind.object.userData.plot ? { plot: behind.object.userData.plot } : { spot: behind.object.userData.spot }) : null;
    if (!other) {
      const g = r.intersectObject(board.ground, false)[0], plot = g ? board.plotAt(g.point.x, g.point.z) : null, spot = g && !plot ? board.spotAt(g.point.x, g.point.z) : null;
      other = plot ? { plot } : spot !== null && spot !== undefined && spot !== mine ? { spot } : null;
    }
    // at a steep angle the ray past the post can miss both the plot behind it and that plot's ground (a plot at the
    // top edge of a landscape screen): the nearest other pad or plot on screen gets the same test
    if (!other) other = nearest(cam, el, board, clientX, clientY, NEAR, mine);
    if (other) {
      const rc = el.getBoundingClientRect(), x = clientX - rc.left, y = clientY - rc.top, d = (wx, wy, wz) => { const q = project(cam, el, _c.set(wx, wy, wz)); return q ? Math.hypot(q.x - x, q.y - y) : Infinity; };
      const [sx, sz] = board.def.spots[mine];
      const [ox, oz] = other.plot ? board.def.plots[other.plot] : board.def.spots[other.spot];
      const oy = other.plot ? .5 : board.town.towers.some(t => t.spot === other.spot) ? .6 : .1;
      if (d(ox, oy, oz) < d(sx, .6, sz)) return other;
    }
    return { spot: mine };
  }
  if (m && m.object.userData.spot !== undefined) return { spot: m.object.userData.spot };
  if (m && m.object.userData.plot) return { plot: m.object.userData.plot };
  const g = r.intersectObject(board.ground, false)[0];
  const p = g ? g.point : r.ray.intersectPlane(plane, hit);
  if (p) {
    const plot = board.plotAt(p.x, p.z);
    if (plot) return { plot };
    const spot = board.spotAt(p.x, p.z);
    if (spot !== null) return { spot };
  }
  return nearest(cam, el, board, clientX, clientY);
}
/* The raider under a screen point (owner, 2026-11-22: tap a raider to see its state): the raider in sight whose middle
   on screen is nearest the finger, within FOE_NEAR px (a boss, drawn bigger, within more), so a moving raider is easy to
   hit. Tested before the ground and the pads, but a building or tower the ray meets well in front of the raider hides
   it. battle.foes: id -> { obj, boss } as drawn this frame. Returns { id, px } (px: how far its middle is from the finger
   on screen), or null. */
export const FOE_NEAR = 26;
const _f = new THREE.Vector3();
export function pickFoe(cam, el, board, battle, clientX, clientY) {
  const rc = el.getBoundingClientRect(), x = clientX - rc.left, y = clientY - rc.top;
  let best = null, bd = Infinity;
  for (const [id, u] of battle.foes) {
    if (!u.obj.visible) continue;
    // an airship's middle is its gas bag, and it is drawn long, so it is found from farther (part 2b)
    const air = !!u.obj.userData.air, p = u.obj.position, s = project(cam, el, _f.set(p.x, p.y + (u.boss ? .7 : air ? .55 : .4), p.z));
    if (!s) continue;
    const near = u.boss ? FOE_NEAR * 1.6 : air ? FOE_NEAR * 1.3 : FOE_NEAR, d = Math.hypot(s.x - x, s.y - y) / near;
    if (d <= 1 && d < bd) { bd = d; best = { id, u, px: d * near }; }
  }
  if (!best) return null;
  const m = groundPoint(cam, el, clientX, clientY).intersectObjects(board.pickables, false)[0];
  if (m && m.distance < cam.position.distanceTo(best.u.obj.position) - .8) return null;
  return { id: best.id, px: best.px };
}
/* The pair of workers by the road under a screen point while the town is called to arms: the nearest within FOE_NEAR px
   of where they stand. Returns { id (their building), px } or null. */
export function pickWorker(cam, el, board, clientX, clientY) {
  const rc = el.getBoundingClientRect(), x = clientX - rc.left, y = clientY - rc.top;
  let best = null, bd = FOE_NEAR;
  for (const p of board.militia ? board.militia.points() : []) {
    const s = project(cam, el, _f.set(p.x, .3, p.z));
    if (!s) continue;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = { id: p.id, px: d }; }
  }
  return best;
}
/* How far a pad's or plot's middle is from a screen point on screen, in px (Infinity when behind the camera). */
export function hitPx(cam, el, board, hit, clientX, clientY) {
  const rc = el.getBoundingClientRect(), def = board.def;
  const [wx, wz] = hit.plot ? def.plots[hit.plot] : def.spots[hit.spot], wy = hit.plot ? .5 : board.town.towers.some(t => t.spot === hit.spot) ? .6 : .1;
  const s = project(cam, el, _f.set(wx, wy, wz));
  return s ? Math.hypot(s.x - (clientX - rc.left), s.y - (clientY - rc.top)) : Infinity;
}

/* The pad or plot whose middle is closest to a screen point on screen, if within NEAR px. */
export function nearest(cam, el, board, clientX, clientY, near = NEAR, skip = null) {
  const rc = el.getBoundingClientRect(), x = clientX - rc.left, y = clientY - rc.top, def = board.def;
  let best = null, bd = near;
  const test = (wx, wy, wz, out) => { const s = project(cam, el, _c.set(wx, wy, wz)); if (!s) return; const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = out; } };
  (def.spots || []).forEach(([sx, sz], i) => { if (i !== skip) test(sx, .6, sz, { spot: i }); });
  for (const [id, [px, pz]] of Object.entries(def.plots)) test(px, .8, pz, { plot: id });
  return best;
}

/* Where a world point lands on screen, in CSS pixels; null when behind the camera. size: the canvas's { w, h } as the
   view measured it this frame. Reading el.clientWidth here instead, between the screen's tag moves, made the browser lay
   the page out again for every tag, every frame (perf, 2026-11-19). */
const _p = new THREE.Vector3();
export function project(cam, el, v, size = null) {
  const p = _p.copy(v).project(cam);
  if (p.z > 1) return null;
  const w = size && size.w ? size.w : el.clientWidth, h = size && size.h ? size.h : el.clientHeight;
  return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
}
