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

/* What is under a screen point: { plot: id }, { spot: index } (a tower spot), or null. */
export function pickTarget(cam, el, board, clientX, clientY) {
  const r = groundPoint(cam, el, clientX, clientY);
  const m = r.intersectObjects(board.pickables, false)[0];
  if (m && m.object.userData.spot !== undefined) return { spot: m.object.userData.spot };
  if (m && m.object.userData.plot) return { plot: m.object.userData.plot };
  const g = r.intersectObject(board.ground, false)[0];
  const p = g ? g.point : r.ray.intersectPlane(plane, hit);
  if (!p) return null;
  const plot = board.plotAt(p.x, p.z);
  if (plot) return { plot };
  const spot = board.spotAt(p.x, p.z);
  return spot === null ? null : { spot };
}

/* Where a world point lands on screen, in CSS pixels; null when behind the camera. */
const _p = new THREE.Vector3();
export function project(cam, el, v) {
  const p = _p.copy(v).project(cam);
  if (p.z > 1) return null;
  return { x: (p.x + 1) / 2 * el.clientWidth, y: (1 - p.y) / 2 * el.clientHeight };
}
