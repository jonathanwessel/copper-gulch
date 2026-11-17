/* The board camera. Phones: one finger drags the town, two fingers pinch to zoom and twist to turn. Mouse: drag pans,
   right-drag or Shift-drag turns, the wheel zooms. A double tap resets. A flick glides to a stop, and the view never
   leaves the board. A drag never counts as a tap: onTap(x, y) only fires for a press that did not move. */
import * as THREE from 'three';

export class CameraRig {
  constructor(cam, el, { center, size = 12, onTap = () => {} }) {
    this.cam = cam; this.el = el; this.onTap = onTap;
    this.home = { x: center.x, z: center.z, yaw: 0, pitch: .78, dist: 19 };
    this.size = size;
    this.t = { ...this.home };      // where the camera is heading
    this.c = { ...this.home };      // where it is
    this.v = { x: 0, z: 0 };        // glide velocity, world units per second
    this.min = 6; this.max = 42;
    this.bind();
  }
  reset() { Object.assign(this.t, this.home); this.v.x = this.v.z = 0; }
  /* What the home view should show: a center and a width in world units. When it grows, the camera eases out to it. */
  frame(x, z, w) {
    if (this.fw === w && this.home.x === x && this.home.z === z) return;
    const first = this.fw === undefined;
    this.home.x = x; this.home.z = z; this.fw = w; this.aspect = 0;
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
    const w = this.fw || this.size - .5, d = Math.min(this.size * .75, w * .9);
    const dist = Math.max((w / 2) / Math.tan(h / 2), (d / 2) / Math.tan(v / 2) * 1.2);
    this.home.pitch = tall ? .95 : .8;
    this.home.dist = Math.min(this.max, Math.max(this.min, dist));
    if (!this.fitted) { Object.assign(this.t, this.home); Object.assign(this.c, this.home); this.fitted = true; }
    else { this.t.pitch = this.home.pitch; this.t.dist = this.home.dist; }
  }
  clamp() {
    const s = this.size * .6;
    this.t.x = Math.max(this.home.x - s, Math.min(this.home.x + s, this.t.x));
    this.t.z = Math.max(this.home.z - s * .8, Math.min(this.home.z + s * .8, this.t.z));
    this.t.dist = Math.max(this.min, Math.min(this.max, this.t.dist));
  }
  /* Move the target so the ground under the finger follows it. */
  pan(dx, dy) {
    const H = this.el.clientHeight || 600, k = 2 * this.c.dist * Math.tan(THREE.MathUtils.degToRad(this.cam.fov) / 2) / H;
    const c = Math.cos(this.c.yaw), s = Math.sin(this.c.yaw), ky = k / Math.max(.4, Math.sin(this.c.pitch));
    this.t.x += -dx * k * c - dy * ky * s; this.t.z += dx * k * s - dy * ky * c;
    this.clamp();
  }
  bind() {
    const el = this.el, pts = new Map();
    let down = null, two = null;
    el.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      if (pts.size === 1) down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, turn: e.button === 2 || e.shiftKey, vx: 0, vy: 0, t: performance.now() };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        two = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), a: Math.atan2(b[1] - a[1], b[0] - a[0]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
        if (down) down.moved = true;
      }
      this.v.x = this.v.z = 0;
    });
    el.addEventListener('pointermove', e => {
      if (!down || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && two) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.t.dist *= two.d / Math.max(1, d);
        let da = ang - two.a; da = Math.atan2(Math.sin(da), Math.cos(da)); this.t.yaw -= da;
        this.pan(mx - two.mx, my - two.my);
        two = { d, a: ang, mx, my }; down.moved = true; return;
      }
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      if (!down.moved) return;
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly, now = performance.now(), dt = Math.max(1, now - down.t);
      if (down.turn) this.t.yaw -= dx / (el.clientWidth || 400) * 3;
      else { this.pan(dx, dy); down.vx = dx / dt; down.vy = dy / dt; }
      down.lx = e.clientX; down.ly = e.clientY; down.t = now;
    });
    const up = e => {
      pts.delete(e.pointerId); if (pts.size < 2) two = null;
      if (down && !pts.size) {
        if (!down.moved && e.type === 'pointerup') this.onTap(e.clientX, e.clientY);
        else if (!down.turn && performance.now() - down.t < 80) this.flick = { vx: down.vx, vy: down.vy };
        down = null;
      }
    };
    for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, up);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); this.t.dist *= 1 + Math.sign(e.deltaY) * .1; this.clamp(); }, { passive: false });
    el.addEventListener('dblclick', () => this.reset());
  }
  /* Ease toward the target and place the camera. */
  update(dt) {
    if (this.flick) { const f = this.flick; this.pan(f.vx * 16, f.vy * 16); f.vx *= .9; f.vy *= .9; if (Math.hypot(f.vx, f.vy) < .02) this.flick = null; }
    this.clamp();
    const k = 1 - Math.pow(.0001, dt); // frame-rate independent easing
    for (const key of ['x', 'z', 'yaw', 'pitch', 'dist']) this.c[key] += (this.t[key] - this.c[key]) * k;
    const { x, z, yaw, pitch, dist } = this.c;
    this.cam.position.set(x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.cam.lookAt(x, 0, z);
  }
}
