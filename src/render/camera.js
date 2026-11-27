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
/* pixels a selection's point keeps from the card's edge, so the building round it shows whole */
export const CLEAR = 44;
/* pixels a selection keeps below the top bar (review of 2026.11.20-4: a selected Mortar pit sat under the goal strip) */
const TOP_GAP = 56;
/* The smallest band above a card a selection slides into on a screen held upright (clarity fix 8u: 100 px on a short phone). */
export const ABOVE_SHORT = 98;
/* The room a selection keeps from the screen's left and right edges (review of 2026.11.20-5: in landscape a selected pit
   at the left edge, half off the screen, counted as on screen). */
const SIDE_GAP = 72;
/* pixels a raider's middle keeps from the screen's left and right edges for it to count as on screen at home (the phone
   home view box, 2026.11.26-4: raiders walked half off the left edge) */
export const ROAD_EDGE = 14;
export const ROAD_STEP = .5; // world units between the road points the home view weighs (unclip)
/* how much a unit of road by the edge weighs against a cut pad (1: a unit of road is a pad) */
export const ROAD_WEIGHT = .4;
export const MIN_PAD = 31;  // pixels across the smallest stone pad at home (the touch rule is 30; 32 cut the outposts' edge pads on a phone)
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
  constructor(cam, el, { center, size = 12, onTap = () => {}, pads = [], roads = [], onZoomOut = null, flyIn = false, fitCover = false, tallPitch = 1.08, widePitch = 0 }) {
    this.tallPitch = tallPitch; // how steeply a tall screen looks down (the empire map looks down more, so its far side shrinks less)
    this.widePitch = widePitch; // the same for a wide screen (0: the town's own .72 or .8)
    this.fitCover = fitCover; // the empire map: an open card shrinks the home view to the space it leaves
    this.cam = cam; this.el = el; this.onTap = onTap; this.pads = pads; this.roads = roads; this.onZoomOut = onZoomOut; this.flyIn = flyIn; this.pull = 0;
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
  setView(top, cover, low = null, beside = null) {
    this.view.cover = cover; this.view.low = low; // low: the goods strip's box at the bottom, or null
    // beside: { l, t } when the top bar's left column ends higher than its side column, the free board left of the side
    // column (l, its left edge) from t down (clarity fix 8v: a short phone's card rises beside the side column)
    this.view.beside = beside;
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
    const lowT = this.view.low ? Math.round(this.view.low.t / 8) : 0;
    const key = w + 'x' + h + ':' + Math.round(this.view.top) + ':' + lowT + ':' + (this.coverKey || '') + ':' + this.fw + ',' + this.fd + ',' + this.fx + ',' + this.fz; // (no reads of the page each frame)
    if (key === this.fitKey) return;
    const r = this.el.getBoundingClientRect(), W = r.width || innerWidth, H = r.height || innerHeight;
    this.fitKey = key; this.aspect = aspect;
    // a refit puts the home view back, so a selection's step back (keep) may run again: in landscape the top bar and the
    // goods strip change as a card opens, the refit undid the step back, and a Mortar's ring showed 4% of it (clarity fix 8g)
    this.zoomKey = null;
    const tall = aspect < .8, fov = tall ? 50 : 36;
    if (this.cam.fov !== fov) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    const fw = this.fw || this.size - .5, fd = this.fd || this.size * .75;
    // a wide screen and a tall town: look from the west, so the town's length runs left to right
    const turn = aspect > 1.2 && fd > fw * 1.15;
    const cx = this.fx ?? this.home.x, cz = this.fz ?? this.home.z;
    const s = { x: cx, z: cz, yaw: turn ? -Math.PI / 2 : 0, pitch: tall ? this.tallPitch : this.widePitch || (aspect > 1.5 ? .72 : .8), dist: 19 };
    const m = 8, top = Math.min(H * .45, this.view.top) + m, R = { l: r.left + m, r: r.left + W - m, t: r.top + top, b: r.top + H - m };
    // the goods strip at the bottom: the frame ends above it, so no pad sits under it at home (review of 2026.11.20-17)
    const lw = this.view.low; if (lw && lw.t > R.t + H * .4) R.b = Math.min(R.b, lw.t - 4);
    // the empire map with a card open: the whole map fits in the part the card leaves, so no town's label sits under it
    // (review of 2026.11.19-9: Dry Creek's label under the card, so the labels in view did not add up to the top bar)
    const side = this.fitCover && this.coverKey;
    // a side card (a phone turned sideways) keeps the zoom and only slides the chosen town clear of it (keep): shrunk
    // into the space left of the card, the towns sat in a small patch with their labels touching (review of 2026.11.20-4)
    if (side) { const [k, v] = side.split(':'); if (k === 'b') R.b = Math.max(R.t + 120, +v - m); }
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
    if (this.pads.length) this.unclip(s, r.left, r.left + W);
    Object.assign(this.home, s);
    if (!this.fitted || this.atHome) { Object.assign(this.t, this.home); if (!this.fitted) Object.assign(this.c, this.home); }
    if (this.flyIn && !this.fitted && this.fw !== undefined) { this.flyIn = false; this.c.dist = this.home.dist * 2.2; this.c.pitch = Math.min(1.3, this.home.pitch + .25); }
    this.fitted = true; this.slid = null;
  }
  /* A town wider than the screen at its pad size (a phone, the larger towns): slide the home view sideways, at most
     3 units, so no pad is cut by the screen's left or right edge. Each one shows whole or sits a pan away (review of
     2026.11.20-17 and 2026.11.21-2: half pads at both edges looked broken). */
  /* The road weighs in too (the phone home view box, 2026.11.26-4: the Gulch's west pass ran along the left edge and
     raiders walked half off the screen): each ROAD_STEP of road whose raiders would stand within ROAD_EDGE of the left or
     right edge counts like a cut pad, so a whole road beats whole edge pads. this.roads: points along each lane, every
     ROAD_STEP units, from where raiders come into view. */
  unclip(s, left, right) {
    const ux = Math.cos(s.yaw), uz = -Math.sin(s.yaw), L = left + 2, Rr = right - 2, x0 = s.x, z0 = s.z;
    const r = this.el.getBoundingClientRect(), W = r.width || innerWidth, H = r.height || innerHeight;
    const px = (x, y, z) => { _pv.set(x, y, z).project(_cam); return r.left + (_pv.x + 1) / 2 * W; }; // after tmp(s)
    const cut = () => {
      this.tmp(s, W, H);
      let n = 0;
      for (const [x, z] of this.pads) {
        let a = Infinity, b = -Infinity;
        for (const [dx, dz] of [[PAD_R, 0], [-PAD_R, 0], [0, PAD_R], [0, -PAD_R]]) { const p = px(x + dx, 0, z + dz); a = Math.min(a, p); b = Math.max(b, p); }
        if ((a < L && b > L) || (a < Rr && b > Rr)) n++;
      }
      for (const [x, z] of this.roads) { const p = px(x, .3, z); if (p < left + ROAD_EDGE || p > right - ROAD_EDGE) n += ROAD_STEP * ROAD_WEIGHT; }
      return n;
    };
    if (!cut()) return;
    let best = { d: 0, score: Infinity };
    for (let d = -3; d <= 3.001; d += .05) {
      s.x = x0 + ux * d; s.z = z0 + uz * d;
      const score = cut() * 100 + Math.abs(d) * 4;
      if (score < best.score - 1e-9) best = { d, score };
    }
    s.x = x0 + ux * best.d; s.z = z0 + uz * best.d;
  }
  /* Keep the selected thing (world point p, or null when no card is open) out from under its card: if the card covers
     it, slide the camera's target so it sits in the nearest free part of the screen. key names the selection; once the
     player moves the map, the camera leaves it alone until the next selection. On close, slide back if untouched.
     rad: a tower's reach on the ground; where the free part has room, its whole circle is kept in it too (review of
     2026.11.20-6: on a desktop a selected Mortar pit's circle ran off the left edge). */
  keep(p, key, rad = 0) {
    const cv = this.view.cover;
    if (!p || !cv) {
      if (!p && this.slid && this.slid.g === this.gestures) { this.t.x = this.slid.x; this.t.z = this.slid.z; this.t.dist = this.slid.dist ?? this.t.dist; } // back where it was
      if (!p) { this.slid = null; this.keepKey = null; this.zoomKey = null; this.keepAt = null; }
      return;
    }
    if (key !== this.keepKey) { this.keepKey = key; this.keepG = this.gestures; this.keepAt = { x: p.x, z: p.z }; }
    if (this.keepG !== this.gestures) return; // the player has taken the map
    const r = this.el.getBoundingClientRect(), W = r.left + (r.width || innerWidth), H = r.top + (r.height || innerHeight), top = r.top + this.view.top;
    const q = this.proj(this.t, p.x, p.y, p.z), pad = 44;
    // the circle's reach on screen from q: left, right, up and down (8 points round it, so a turned map counts)
    const e = { l: 0, r: 0, u: 0, d: 0 };
    if (rad > 0) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, c = this.proj(this.t, p.x + Math.cos(a) * rad, 0, p.z + Math.sin(a) * rad); e.l = Math.max(e.l, q.x - c.x); e.r = Math.max(e.r, c.x - q.x); e.u = Math.max(e.u, q.y - c.y); e.d = Math.max(e.d, c.y - q.y); }
    const lw = this.view.low;
    const raw = [
      { l: r.left, r: W, t: top, b: cv.t },   // above the card
      { l: r.left, r: cv.l, t: top, b: H },   // left of it
      { l: cv.r, r: W, t: top, b: H },        // right of it
    ];
    // left of the side column, above the card, when the left column ends higher (clarity fix 8v)
    const bs = this.view.beside;
    if (bs && bs.t < Math.min(top, cv.t) - 40) raw.push({ l: r.left, r: Math.min(W, bs.l - 4), t: bs.t, b: cv.t });
    // a part the goods strip runs across ends at the strip's top (review of 2026.11.20-8)
    if (lw) for (const a of raw) if (lw.l < a.r && lw.r > a.l && lw.t < a.b && lw.t > a.t) a.b = lw.t - 28; // room for the building under its point
    const fits = a => e.l + e.r + 16 <= a.r - a.l && e.u + e.d + 16 <= a.b - a.t; // the whole circle fits in this part
    const parts = raw.map(a => {
      const s = Math.max(SIDE_GAP, (a.r - a.l) * .28), o = fits(a);
      // a slide lands well inside the free part, not on its edge, with the circle inside it when it fits
      return { l: a.l + Math.max(s, o ? e.l + 8 : 0), r: a.r - Math.max(s, o ? e.r + 8 : 0), t: a.t + Math.max(TOP_GAP, o ? e.u + 8 : 0), b: a.b - Math.max(pad * .8, o ? e.d + 8 : 0), w: a.r - a.l, h: a.b - a.t, o };
    });
    // a circle that fits in no part: step back a little (at most 1.8 times as far, once a selection) when that makes it
    // fit in the roomiest part; the map goes back on close (a desktop's Mortar circle ran off the screen's edge)
    if (rad > 0 && this.zoomKey !== key && !raw.some(fits)) {
      this.zoomKey = key;
      let f = Infinity;
      for (const a of raw) if (a.r - a.l >= 120 && a.b - a.t >= 120) f = Math.min(f, Math.max((e.l + e.r + 16) / (a.r - a.l), (e.u + e.d + 16) / (a.b - a.t)));
      // up to 2.6 times as far, and as far as it goes when that is still not enough: at 1.8 a Mortar's ring (twice a tower's
      // reach) beside a landscape card showed 4% of its circle, so the map did not step back at all (clarity fix 8g)
      if (isFinite(f) && f > 1 && this.t.dist < this.max) {
        if (!this.slid || this.slid.g !== this.gestures) this.slid = { x: this.t.x, z: this.t.z, dist: this.t.dist, g: this.gestures };
        this.t.dist = Math.min(this.max, this.t.dist * Math.min(f, 2.6) * 1.08);
        return; // the next call slides it into place from the new distance
      }
    }
    const inside = a => q.x >= a.l && q.x <= a.r && q.y >= a.t && q.y <= a.b;
    // clear by a building's half width beside the card and its height above the strip, not just its point (review of
    // 2026.11.20-13: in landscape a selected Glassworks sat half under the card's edge, just above the strip)
    // with a reach (a site's own size on the map), clear by the whole of it: an outpost's middle just above the card left
    // half of it under the card (the ring, part 1c, Pine Hollow on a phone)
    const clear = (q.x < cv.l - CLEAR - e.r || q.x > cv.r + CLEAR + e.l || q.y < cv.t - CLEAR - e.d || q.y > cv.b + CLEAR + e.u) && !(lw && q.x > lw.l - 20 && q.x < lw.r + 20 && q.y > lw.t - 40 && q.y < lw.b + 20);
    // a circle that fits in no part even after the step back: its middle goes to the middle of the roomiest part, so it
    // runs off both sides alike (review of 2026.11.20-7: an empty pit's Mortar circle on a desktop ran off the left edge
    // only, with the map at its farthest)
    let room = null;
    if (rad > 0 && !raw.some(fits)) for (const a of raw) if (a.r - a.l >= 120 && a.b - a.t >= 120 && (!room || (a.r - a.l) * (a.b - a.t) > room.area)) room = { x: (a.l + a.r) / 2, y: (top + TOP_GAP + a.b) / 2, area: (a.r - a.l) * (a.b - a.t) };
    if (room) {
      if (Math.hypot(q.x - room.x, q.y - room.y) < 40) return;
      const g1 = this.ground(q.x, q.y, this.t), g2 = this.ground(room.x, room.y, this.t);
      if (!g1 || !g2) return;
      if (!this.slid || this.slid.g !== this.gestures) this.slid = { x: this.t.x, z: this.t.z, dist: this.t.dist, g: this.gestures };
      this.t.x += g1.x - g2.x; this.t.z += g1.z - g2.z;
      return;
    }
    // its circle is in view and clear of the card and the goods strip, or fits nowhere (review of 2026.11.20-14: in
    // short-land and pit-land the ring ran under the strip)
    const offStrip = !lw || q.x + e.r < lw.l || q.x - e.l > lw.r || q.y + e.d < lw.t - 4 || q.y - e.u > lw.b;
    const ring = !raw.some(fits) || (offStrip && q.x - e.l > r.left + 8 && q.x + e.r < W - 8 && q.y - e.u > top + 8 && q.y + e.d < H - 8 && (q.x + e.r < cv.l || q.x - e.l > cv.r || q.y + e.d < cv.t || q.y - e.u > cv.b));
    if (clear && ring && q.y > top + TOP_GAP && q.y < H - 20 && q.x > r.left + SIDE_GAP && q.x < W - SIDE_GAP) return; // well on screen and not under the card
    let best = null, bd = Infinity;
    for (const a of parts) {
      // too small to show the thing and its label in (review of 2026.11.20-6: on the landscape map the town slid into the
      // thin strip above a side card, near the horizon, and the screen filled with mesas)
      // a part beside the card may be shorter (80): in landscape the goods strip left 107 px above it beside a choice
      // card, so no part was big enough and the selected Still stayed under the card (fresh-eyes read of 2026.11.25-8)
      // on a short phone held upright the band above the card is 100 px (clarity fix 8u, index.html), so the part
      // above takes ABOVE_SHORT there
      if (a.w < 120 || a.h < (a === parts[0] ? (H - r.top < W - r.left ? 120 : ABOVE_SHORT) : 80)) continue;
      if (rad > 0 && !a.o && parts.some(b => b.o && b.w >= 120 && b.h >= 120)) continue; // a part its circle fits in comes first (review of 2026.11.20-7: a pit inside the thin part left of a desktop card stayed with its circle off the edge)
      if (inside(a)) return;
      const x = a.r < a.l ? (a.l + a.r) / 2 : Math.min(a.r, Math.max(a.l, q.x)), y = a.b < a.t ? (a.t + a.b) / 2 : Math.min(a.b, Math.max(a.t, q.y));
      const d = Math.hypot(x - q.x, y - q.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (!best) return;
    const g1 = this.ground(q.x, q.y, this.t), g2 = this.ground(best.x, best.y, this.t);
    if (!g1 || !g2) return;
    if (!this.slid || this.slid.g !== this.gestures) this.slid = { x: this.t.x, z: this.t.z, dist: this.t.dist, g: this.gestures };
    this.t.x += g1.x - g2.x; this.t.z += g1.z - g2.z;
  }
  /* Slide the map so world point p lands on screen point (x, y) (client pixels): a tip card's spotlight whose pad sat
     under the top bar (clarity fix 10, review 10: the Mortar card's box lay on Hold waves, its pit hidden under it). */
  slideTo(p, x, y) {
    const q = this.proj(this.t, p.x, p.y, p.z), g1 = this.ground(q.x, q.y, this.t), g2 = this.ground(x, y, this.t);
    if (!g1 || !g2) return false;
    this.t.x += g1.x - g2.x; this.t.z += g1.z - g2.z;
    // off home, as after a pan: a refit (the top bar's height changing as the town opens) no longer puts it back
    // (clarity fix 8p: the goal's slide to the Mesa's Oil Derrick was undone a moment later)
    this.atHome = false;
    return true;
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
    // while a card is open the view may also go as far round the selected thing (review of 2026.11.20-7: a pit at the
    // town's west edge could not slide clear of the screen's edge)
    const k = this.keepAt, lx = k ? Math.min(cx - r, k.x - r) : cx - r, hx = k ? Math.max(cx + r, k.x + r) : cx + r, lz = k ? Math.min(cz - r * .8, k.z - r * .8) : cz - r * .8, hz = k ? Math.max(cz + r * .8, k.z + r * .8) : cz + r * .8;
    s.x = Math.max(lx, Math.min(hx, s.x));
    s.z = Math.max(lz, Math.min(hz, s.z));
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
