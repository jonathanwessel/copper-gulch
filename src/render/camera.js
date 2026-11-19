/* The board camera. Every gesture moves the map directly: the ground under a finger stays under that finger.
     one finger, or a mouse drag: the map slides with it;
     two fingers: pinch zooms toward the spot between them and twisting turns the map with the fingers, around that
       spot, so whatever is between the fingers stays put;
     right-drag or Shift-drag: the map turns around the point under the pointer, the way the pointer moves;
     the wheel zooms toward the pointer;   a double tap eases back to the home view.
   Zooming out past the farthest view (a pinch that keeps closing, or the wheel turned on) calls onZoomOut: the town
   opens the empire map. flyIn: the first view starts high above the town and dives to the home view.
   While touching, the camera follows the fingers exactly (no easing); only a flick's glide and the reset ease.
   A drag never counts as a tap: onTap(x, y) only fires for a press that did not move.
   Framing: the home view fits the town into the part of the screen the top bar leaves free, close enough that every
   stone pad is at least MIN_PAD pixels across (a short landscape screen pans to see the ends). While a card covers
   the selected thing, the camera slides it into the free part, and slides back when the card closes, unless the
   player has moved the map in between. */
import * as THREE from 'three';

const _cam = new THREE.PerspectiveCamera(), _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _hit = new THREE.Vector3();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ang = (x, z) => Math.atan2(x, z); // a ground direction's angle; turning the rig by f adds f to it
export const MIN_PAD = 32;  // pixels across the smallest stone pad at home (the touch rule is 30)
const PAD_R = .5;           // a stone pad's radius in world units (src/render/battle.js)
const _pv = new THREE.Vector3();

/* Put a camera where a rig state { x, z, yaw, pitch, dist } says. */
export function pose(cam, s) {
  cam.position.set(s.x + Math.sin(s.yaw) * Math.cos(s.pitch) * s.dist, Math.sin(s.pitch) * s.dist, s.z + Math.cos(s.yaw) * Math.cos(s.pitch) * s.dist);
  cam.lookAt(s.x, 0, s.z); cam.updateMatrixWorld();
}

/* Which way an open card leaves room: 'b:<its top>' for a card at the bottom, 'r:<its left>' for one at the right edge,
   or '' (rounded to 8 px, so a card that grows a line does not move the camera). */
export function coverSide(cv, el) {
  if (!cv) return '';
  const r = el.getBoundingClientRect(), W = r.width || innerWidth;
  const H = r.height || innerHeight;
  const side = cv.r > r.left + W - 40 && cv.l > r.left + W * .35; // a short landscape screen: the card stands at the right edge
  if (side) return 'r:' + Math.round(cv.l / 8) * 8;
  // a phone or a wide screen: it sits at the bottom. A tall one (the Capital's) leaves too little room above it, and the
  // map would shrink into the distance: the camera keeps its usual view then (review of 2026.11.19-10's shots)
  return cv.t - r.top < H * .5 ? '' : 'b:' + Math.round(cv.t / 8) * 8;
}

export class CameraRig {
  constructor(cam, el, { center, size = 12, onTap = () => {}, pads = [], onZoomOut = null, flyIn = false, fitCover = false }) {
    this.fitCover = fitCover; // the empire map: an open card shrinks the home view to the space it leaves
    this.cam = cam; this.el = el; this.onTap = onTap; this.pads = pads; this.onZoomOut = onZoomOut; this.flyIn = flyIn; this.pull = 0;
    this.view = { top: 0, cover: null }; // the top bar's lower edge and the open card's box, in client pixels
    this.gestures = 0; this.atHome = true; this.slid = null; this.keepKey = null;
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
    Object.assign(this.t, this.home); this.flick = null; this.atHome = true; this.slid = null;
  }
  /* What the home view should show: a center and a width in world units. When it grows, the camera eases out to it. */
  frame(x, z, w, d) {
    if (this.fw === w && this.fd === d && this.fx === x && this.fz === z) return;
    const first = this.fw === undefined;
    this.home.x = x; this.home.z = z; this.fx = x; this.fz = z; this.fw = w; this.fd = d; this.fitKey = ''; // (fit slides home off the frame's middle)
    if (first) { this.c.x = x; this.c.z = z; this.fitted = false; } // the opening view starts framed, without a glide
  }
  /* What covers the board: top, the lower edge of the top bar; cover, the open card's box { l, t, r, b } or null. */
  setView(top, cover) {
    this.view.cover = cover;
    if (Math.abs(top - this.view.top) > 4) { this.view.top = top; this.fitKey = ''; }
    if (this.fitCover) { const k = coverSide(cover, this.el); if (k !== this.coverKey) { this.coverKey = k; this.fitKey = ''; } }
  }
  /* Where world point (x, y, z) lands on screen (client pixels) for rig state s. */
  proj(s, x, y, z) {
    const r = this.el.getBoundingClientRect(), W = r.width || innerWidth, H = r.height || innerHeight;
    this.tmp(s, W, H);
    _pv.set(x, y, z).project(_cam);
    return { x: r.left + (_pv.x + 1) / 2 * W, y: r.top + (1 - _pv.y) / 2 * H };
  }
  tmp(s, W, H) { _cam.fov = this.cam.fov; _cam.aspect = W / H; _cam.near = this.cam.near; _cam.far = this.cam.far; _cam.updateProjectionMatrix(); pose(_cam, s); }
  /* The smallest stone pad's width on screen, in pixels, for rig state s (the current one by default). */
  padPx(s = this.c) {
    let min = Infinity;
    for (const [x, z] of this.pads) {
      let w = 0;
      for (const [ux, uz] of [[1, 0], [0, 1], [.707, .707], [.707, -.707]]) {
        const a = this.proj(s, x - ux * PAD_R, 0, z - uz * PAD_R), b = this.proj(s, x + ux * PAD_R, 0, z + uz * PAD_R);
        w = Math.max(w, Math.hypot(a.x - b.x, a.y - b.y));
      }
      min = Math.min(min, w);
    }
    return min;
  }
  /* Fit the home view to the screen: the town's frame fits into the part the top bar leaves free, centered there,
     but never so far out that a stone pad drops under MIN_PAD pixels. Tall phones get a wider lens and a steeper
     view; wide screens a lower one, so the town's depth takes less height. Solved by projecting the frame's corners. */
  fit(aspect, w = 0, h = 0) {
    const key = w + 'x' + h + ':' + Math.round(this.view.top) + ':' + (this.coverKey || '') + ':' + this.fw + ',' + this.fd + ',' + this.fx + ',' + this.fz; // (no reads of the page each frame)
    if (key === this.fitKey) return;
    const r = this.el.getBoundingClientRect(), W = r.width || innerWidth, H = r.height || innerHeight;
    this.fitKey = key; this.aspect = aspect;
    const tall = aspect < .8, fov = tall ? 50 : 36;
    if (this.cam.fov !== fov) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    const fw = this.fw || this.size - .5, fd = this.fd || this.size * .75;
    // a wide screen and a tall town: look from the west, so the town's length runs left to right
    const turn = aspect > 1.2 && fd > fw * 1.15;
    const cx = this.fx ?? this.home.x, cz = this.fz ?? this.home.z;
    const s = { x: cx, z: cz, yaw: turn ? -Math.PI / 2 : 0, pitch: tall ? 1.08 : aspect > 1.5 ? .72 : .8, dist: 19 };
    const m = 8, top = Math.min(H * .45, this.view.top) + m, R = { l: r.left + m, r: r.left + W - m, t: r.top + top, b: r.top + H - m };
    // the empire map with a card open: the whole map fits in the part the card leaves, so no town's label sits under it
    // (review of 2026.11.19-9: Dry Creek's label under the card, so the labels in view did not add up to the top bar)
    const side = this.fitCover && this.coverKey;
    if (side) { const [k, v] = side.split(':'); if (k === 'b') R.b = Math.max(R.t + 120, +v - m); else R.r = Math.max(R.l + 120, +v - m); }
    const corners = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, 1.2]) corners.push([cx + sx * fw / 2, y, cz + sz * fd / 2]);
    const box = st => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y, z] of corners) { const p = this.proj(st, x, y, z); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      return { x0, x1, y0, y1 };
    };
    const center = () => { // slide so the frame's middle sits in the middle of the free part
      for (let i = 0; i < 3; i++) {
        const b = box(s), g1 = this.ground((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, s), g2 = this.ground((R.l + R.r) / 2, (R.t + R.b) / 2, s);
        if (!g1 || !g2) return;
        s.x += g1.x - g2.x; s.z += g1.z - g2.z;
      }
    };
    // the edge between near distances (ok() true for padsBig, false for fits) and far ones, by halving
    const search = (ok, near) => {
      let lo = this.min, hi = this.max;
      for (let i = 0; i < 22; i++) { s.dist = (lo + hi) / 2; if (ok() === near) lo = s.dist; else hi = s.dist; }
      s.dist = near ? lo : hi;
    };
    const fits = () => { const b = box(s); return b.x1 - b.x0 <= R.r - R.l && b.y1 - b.y0 <= R.b - R.t; };
    for (let k = 0; k < 3; k++) { search(fits, false); center(); }  // the closest view where the whole frame fits
    for (let k = 0; k < 3 && this.pads.length && this.padPx(s) < MIN_PAD - .5; k++) { search(() => this.padPx(s) >= MIN_PAD, true); center(); } // the farthest with pads big enough
    Object.assign(this.home, s);
    if (!this.fitted || this.atHome) { Object.assign(this.t, this.home); if (!this.fitted) Object.assign(this.c, this.home); }
    if (this.flyIn && !this.fitted && this.fw !== undefined) { this.flyIn = false; this.c.dist = this.home.dist * 2.2; this.c.pitch = Math.min(1.3, this.home.pitch + .25); }
    this.fitted = true; this.slid = null;
  }
  /* Keep the selected thing (world point p, or null when no card is open) out from under its card: if the card covers
     it, slide the camera's target so it sits in the nearest free part of the screen. key names the selection; once the
     player moves the map, the camera leaves it alone until the next selection. On close, slide back if untouched. */
  keep(p, key) {
    const cv = this.view.cover;
    if (!p || !cv) {
      if (!p && this.slid && this.slid.g === this.gestures) { this.t.x = this.slid.x; this.t.z = this.slid.z; } // back where it was
      if (!p) { this.slid = null; this.keepKey = null; }
      return;
    }
    if (key !== this.keepKey) { this.keepKey = key; this.keepG = this.gestures; }
    if (this.keepG !== this.gestures) return; // the player has taken the map
    const r = this.el.getBoundingClientRect(), W = r.left + (r.width || innerWidth), H = r.top + (r.height || innerHeight), top = r.top + this.view.top;
    const q = this.proj(this.t, p.x, p.y, p.z), pad = 44;
    const parts = [
      { l: r.left, r: W, t: top, b: cv.t },   // above the card
      { l: r.left, r: cv.l, t: top, b: H },   // left of it
      { l: cv.r, r: W, t: top, b: H },        // right of it
    ].map(a => ({ l: a.l + pad, r: a.r - pad, t: a.t + pad * .8, b: a.b - pad * .8 }));
    const inside = a => q.x >= a.l && q.x <= a.r && q.y >= a.t && q.y <= a.b;
    const clear = q.x < cv.l - 20 || q.x > cv.r + 20 || q.y < cv.t - 20 || q.y > cv.b + 20;
    if (clear && q.y > top + 10 && q.y < H - 20 && q.x > r.left + 20 && q.x < W - 20) return; // on screen and not under the card
    let best = null, bd = Infinity;
    for (const a of parts) {
      if (a.r - a.l < 10 || a.b - a.t < 4) { // too small for the margin: use its middle line
        if (a.r - a.l + 2 * pad < 60 || a.b - a.t + 1.6 * pad < 40) continue;
      }
      if (inside(a)) return;
      const x = a.r < a.l ? (a.l + a.r) / 2 : Math.min(a.r, Math.max(a.l, q.x)), y = a.b < a.t ? (a.t + a.b) / 2 : Math.min(a.b, Math.max(a.t, q.y));
      const d = Math.hypot(x - q.x, y - q.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (!best) return;
    const g1 = this.ground(q.x, q.y, this.t), g2 = this.ground(best.x, best.y, this.t);
    if (!g1 || !g2) return;
    if (!this.slid || this.slid.g !== this.gestures) this.slid = { x: this.t.x, z: this.t.z, g: this.gestures };
    this.t.x += g1.x - g2.x; this.t.z += g1.z - g2.z;
  }
  /* The ground point { x, z } under a screen point (client pixels), for a rig state (the current one by default). */
  ground(px, py, s = this.c) {
    const r = this.el.getBoundingClientRect(), W = r.width || innerWidth, H = r.height || innerHeight;
    this.tmp(s, W, H);
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
    const r = this.size * .6, cx = this.fx ?? this.home.x, cz = this.fz ?? this.home.z; // around the town's middle
    s.x = Math.max(cx - r, Math.min(cx + r, s.x));
    s.z = Math.max(cz - r * .8, Math.min(cz + r * .8, s.z));
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
      if (pts.size === 1) this.pulled = false;
      if (pts.size === 1) down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, turn: e.button === 2 || e.shiftKey, vx: 0, vy: 0, t: performance.now(), g: this.ground(e.clientX, e.clientY) };
      if (pts.size === 2 && down) down.moved = true;
      regrab();
    });
    el.addEventListener('pointermove', e => {
      if (!down || !pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size >= 2 && two && two.A && two.B) {
        const [a, b] = [...pts.values()];
        this.twoFinger(two.A, two.B, a, b); this.clamp(this.c); this.hold(); down.moved = true; this.gestures++; this.atHome = false;
        if (this.onZoomOut && this.c.dist >= this.max - .01) { // at the farthest view and still closing: past it
          const p = this.ground(a[0], a[1]), q = this.ground(b[0], b[1]);
          if (p && q && Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(two.B.x - two.A.x, two.B.z - two.A.z) * .8) this.pulled = true;
        }
        return;
      }
      // a finger drifts a little during a tap: on touch it takes 12 px to become a drag (a mouse 6)
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > (e.pointerType === 'touch' || e.pointerType === 'pen' ? 12 : 6)) down.moved = true;
      if (!down.moved) return;
      this.gestures++; this.atHome = false; // the map is the player's now
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
        if (this.pulled && this.onZoomOut) { this.pulled = false; down = null; this.onZoomOut(); return; }
        if (!down.moved && e.type === 'pointerup') this.onTap(e.clientX, e.clientY);
        else if (!down.turn && performance.now() - down.t < 80 && Math.hypot(down.vx, down.vy) > .05) this.flick = { vx: down.vx, vy: down.vy, x: down.lx, y: down.ly };
        down = null;
      } else regrab();
    };
    for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, up);
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { // zoom toward the pointer
      e.preventDefault(); this.gestures++; this.atHome = false;
      if (this.onZoomOut) { // three turns out at the farthest view open the map
        if (e.deltaY > 0 && this.c.dist >= this.max - .01) { if (++this.pull >= 3) { this.pull = 0; this.onZoomOut(); return; } } else this.pull = 0;
      }
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
