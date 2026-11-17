/* The board camera. Every gesture moves the map directly: the ground under a finger stays under that finger.
     one finger, or a mouse drag: the map slides with it;
     two fingers: pinch zooms toward the spot between them and twisting turns the map with the fingers, around that
       spot, so whatever is between the fingers stays put;
     right-drag or Shift-drag: the map turns around the point under the pointer, the way the pointer moves;
     the wheel zooms toward the pointer;   a double tap eases back to the home view.
   While touching, the camera follows the fingers exactly (no easing); only a flick's glide and the reset ease.
   A drag never counts as a tap: onTap(x, y) only fires for a press that did not move. */
import * as THREE from 'three';

const _cam = new THREE.PerspectiveCamera(), _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _hit = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ang = (x, z) => Math.atan2(x, z); // a ground direction's angle; turning the rig by f adds f to it

/* Put a camera where a rig state { x, z, yaw, pitch, dist } says. */
export function pose(cam, s) {
  cam.position.set(s.x + Math.sin(s.yaw) * Math.cos(s.pitch) * s.dist, Math.sin(s.pitch) * s.dist, s.z + Math.cos(s.yaw) * Math.cos(s.pitch) * s.dist);
  cam.lookAt(s.x, 0, s.z); cam.updateMatrixWorld();
}

export class CameraRig {
  constructor(cam, el, { center, size = 12, onTap = () => {} }) {
    this.cam = cam; this.el = el; this.onTap = onTap;
    this.home = { x: center.x, z: center.z, yaw: 0, pitch: .78, dist: 19 };
    this.size = size;
    this.t = { ...this.home };      // where the camera is heading
    this.c = { ...this.home };      // where it is
    this.v = { x: 0, z: 0 };
    this.min = 6; this.max = 42;
    this.bind();
  }
  reset() {
    // ease back the short way round, however many turns the map has had
    this.c.yaw = this.home.yaw + Math.atan2(Math.sin(this.c.yaw - this.home.yaw), Math.cos(this.c.yaw - this.home.yaw));
    Object.assign(this.t, this.home); this.flick = null;
  }
  /* What the home view should show: a center and a width in world units. When it grows, the camera eases out to it. */
  frame(x, z, w, d) {
    if (this.fw === w && this.fd === d && this.home.x === x && this.home.z === z) return;
    const first = this.fw === undefined;
    this.home.x = x; this.home.z = z; this.fw = w; this.fd = d; this.aspect = 0;
    this.t.x = x; this.t.z = z;
    if (first) { this.c.x = x; this.c.z = z; this.fitted = false; } // the opening view starts framed, without a glide
  }
  /* Fit to the screen shape: the whole yard fits on screen at home zoom. Tall phones get a wider lens and a steeper
     view, so the board fills the height instead of shrinking to a strip. */
  fit(aspect) {
    if (aspect === this.aspect) return;
    this.aspect = aspect;
    const tall = aspect < .8, fov = tall ? 50 : 36;
    if (this.cam.fov !== fov) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    const v = THREE.MathUtils.degToRad(fov), h = 2 * Math.atan(Math.tan(v / 2) * aspect);
    let w = this.fw || this.size - .5, d = this.fd || this.size * .75;
    // a wide screen and a tall town: look from the west, so the town's length runs left to right
    const turn = aspect > 1.2 && d > w * 1.15;
    this.home.yaw = turn ? -Math.PI / 2 : 0;
    if (turn) [w, d] = [d, w];
    const dist = Math.max((w / 2) / Math.tan(h / 2), (d / 2) / Math.tan(v / 2) * 1.2);
    this.home.pitch = tall ? .95 : .8;
    this.home.dist = Math.min(this.max, Math.max(this.min, dist));
    if (!this.fitted) { Object.assign(this.t, this.home); Object.assign(this.c, this.home); this.fitted = true; }
    else { this.t.pitch = this.home.pitch; this.t.dist = this.home.dist; this.t.yaw = this.home.yaw; }
  }
  /* The ground point { x, z } under a screen point (client pixels), for a rig state (the current one by default). */
  ground(px, py, s = this.c) {
    const r = this.el.getBoundingClientRect(), W = r.width || innerWidth, H = r.height || innerHeight;
    _cam.fov = this.cam.fov; _cam.aspect = W / H; _cam.near = this.cam.near; _cam.far = this.cam.far; _cam.updateProjectionMatrix();
    pose(_cam, s);
    _v2.set(((px - r.left) / W) * 2 - 1, -((py - r.top) / H) * 2 + 1);
    _ray.setFromCamera(_v2, _cam);
    return _ray.ray.intersectPlane(_plane, _hit) ? { x: _hit.x, z: _hit.z } : null;
  }
  /* Hold the map still where it is now (a gesture moves both the target and the drawn state together). */
  hold() { Object.assign(this.t, this.c); this.flick = null; }
  /* Slide so that ground point g sits under screen point (px, py). */
  pin(g, px, py) {
    const now = this.ground(px, py);
    if (!g || !now) return;
    this.c.x += g.x - now.x; this.c.z += g.z - now.z;
  }
  /* Turn the map by f radians around ground point p. */
  turn(f, p) {
    const c = this.c, cs = Math.cos(f), sn = Math.sin(f), dx = c.x - p.x, dz = c.z - p.z;
    c.x = p.x + dx * cs + dz * sn; c.z = p.z - dx * sn + dz * cs; c.yaw += f;
  }
  /* Keep the view on the board and the zoom in range (applied to the drawn state and the target). */
  clamp(s = this.t) {
    const r = this.size * .6;
    s.x = Math.max(this.home.x - r, Math.min(this.home.x + r, s.x));
    s.z = Math.max(this.home.z - r * .8, Math.min(this.home.z + r * .8, s.z));
    s.dist = Math.max(this.min, Math.min(this.max, s.dist));
  }
  /* Two fingers: put grabbed ground points A and B back under screen points a and b, by turning, zooming and
     sliding. Perspective makes one pass approximate, so it repeats a few times; it settles to within a pixel. */
  twoFinger(A, B, a, b) {
    for (let i = 0; i < 6; i++) {
      const p = this.ground(a[0], a[1]), q = this.ground(b[0], b[1]);
      if (!p || !q) return;
      const span0 = Math.hypot(B.x - A.x, B.z - A.z), span = Math.hypot(q.x - p.x, q.z - p.z);
      const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
      this.turn(ang(B.x - A.x, B.z - A.z) - ang(q.x - p.x, q.z - p.z), mid);
      if (span > 1e-4) this.c.dist = Math.max(this.min, Math.min(this.max, this.c.dist * span0 / span));
      this.pin(A, a[0], a[1]); // (pinning the middle would not be exact: in perspective it is not under the fingers' middle)
    }
  }
  bind() {
    const el = this.el, pts = new Map();
    let down = null, two = null;
    const regrab = () => { // fingers changed: grab the ground under each one afresh
      const list = [...pts.values()];
      if (list.length >= 2) { const [a, b] = list; two = { A: this.ground(a[0], a[1]), B: this.ground(b[0], b[1]) }; }
      else two = null;
      if (list.length === 1 && down) { down.g = this.ground(list[0][0], list[0][1]); down.lx = list[0][0]; down.ly = list[0][1]; }
    };
    el.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      this.hold();
      if (pts.size === 1) down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, turn: e.button === 2 || e.shiftKey, vx: 0, vy: 0, t: performance.now(), g: this.ground(e.clientX, e.clientY) };
      if (pts.size === 2 && down) down.moved = true;
      regrab();
    });
    el.addEventListener('pointermove', e => {
      if (!down || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size >= 2 && two && two.A && two.B) {
        const [a, b] = [...pts.values()];
        this.twoFinger(two.A, two.B, a, b); this.clamp(this.c); this.hold(); down.moved = true; return;
      }
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      if (!down.moved) return;
      const now = performance.now(), dt = Math.max(1, now - down.t);
      if (down.turn) { // turn the map around the point under the pointer, the way the pointer moves
        const f = (e.clientX - down.lx) / (el.clientWidth || 400) * 3;
        if (down.g) this.turn(f, down.g);
      } else {
        down.vx = (e.clientX - down.lx) / dt; down.vy = (e.clientY - down.ly) / dt;
        this.pin(down.g, e.clientX, e.clientY);
      }
      this.clamp(this.c); this.hold();
      down.lx = e.clientX; down.ly = e.clientY; down.t = now;
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (down && !pts.size) {
        if (!down.moved && e.type === 'pointerup') this.onTap(e.clientX, e.clientY);
        else if (!down.turn && performance.now() - down.t < 80 && Math.hypot(down.vx, down.vy) > .05) this.flick = { vx: down.vx, vy: down.vy, x: down.lx, y: down.ly };
        down = null;
      } else regrab();
    };
    for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, up);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { // zoom toward the pointer
      e.preventDefault();
      const g = this.ground(e.clientX, e.clientY);
      this.c.dist = Math.max(this.min, Math.min(this.max, this.c.dist * (1 + Math.sign(e.deltaY) * .1)));
      this.pin(g, e.clientX, e.clientY); this.clamp(this.c); this.hold();
    }, { passive: false });
    el.addEventListener('dblclick', () => this.reset());
  }
  /* Glide after a flick, ease toward the target (the reset, a new home frame), and place the camera. */
  update(dt) {
    if (this.flick) { // keep sliding the map the way it was flicked, slowing down
      const f = this.flick, g = this.ground(f.x, f.y), k = Math.min(1, dt * 60);
      this.pin(g, f.x + f.vx * 16 * k, f.y + f.vy * 16 * k); this.clamp(this.c); Object.assign(this.t, this.c);
      f.vx *= Math.pow(.9, k); f.vy *= Math.pow(.9, k); if (Math.hypot(f.vx, f.vy) < .02) this.flick = null;
    }
    this.clamp(this.t);
    const k = 1 - Math.pow(.0001, dt); // frame-rate independent easing
    for (const key of ['x', 'z', 'yaw', 'pitch', 'dist']) this.c[key] += (this.t[key] - this.c[key]) * k;
    pose(this.cam, this.c);
  }
}
