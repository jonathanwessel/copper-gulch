/* Where the town's life may go (PLAN.md M5b, Towns part 2): the walks townsfolk take between buildings, and the lanes
   tumbleweeds roll along. Plain geometry with no three.js, so `node --test` checks it on every board: no walk or lane
   ever crosses a pad, a building, the vault, the river (except over a bridge on the road) or an entrance. Walks may use
   the road, since raiders are only on it during a wave, and the townsfolk stay indoors then (src/render/life.js). */

/* Distance from a point to a polyline. */
export function lineDist(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / L2));
    best = Math.min(best, Math.hypot(px - x1 - dx * t, pz - z1 - dz * t));
  }
  return best;
}

export const PAD_GAP = .64;   // how close to a pad's middle life may come (a pad's footing reaches 0.5 from its middle)
export const PLOT_GAP = 1.02; // a plot is 2 across and its model reaches 0.96 (FIT in src/render/board.js)
const GRID_EXTRA = .08;       // the grid keeps a little farther off, so a step between two open cells never clips a corner
const CELL = .25;             // the walking grid

/* The box life stays in: everything the player uses, a little wider. */
export function lifeBounds(B) {
  const pts = [...(B.spots || []), ...Object.values(B.plots), ...B.road, B.vault];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0: x0 - 1.5, x1: x1 + 1.5, z0: Math.max(z0, -1.5) - 1, z1: z1 + 1.5 };
}

/* blocked(x, z): true where nothing alive may stand. road(x, z): distance to the road's middle. */
export function blocker(B) {
  const spots = B.spots || [], plots = Object.values(B.plots), RIV = B.river ? B.river.path.concat([B.vault]) : null;
  const gates = [B.entrance, B.river && B.river.entrance].filter(Boolean);
  const road = (x, z) => lineDist(x, z, B.road);
  // m: extra room to keep (the walking grid keeps GRID_EXTRA more than the check on a finished walk)
  const blocked = (x, z, m = 0) => {
    for (const [sx, sz] of spots) if (Math.hypot(x - sx, z - sz) < PAD_GAP + m) return true;
    for (const [px, pz] of plots) if (Math.abs(x - px) < PLOT_GAP + m && Math.abs(z - pz) < PLOT_GAP + m) return true;
    if (Math.hypot(x - B.vault[0], z - B.vault[1]) < 1 + m) return true;
    if (RIV && lineDist(x, z, RIV) < (B.river.width || 1.1) * .5 + .4 + m && road(x, z) > .45 - m) return true; // the bridge carries the road over
    for (const e of gates) if (Math.abs(x - e.mouth[0]) < e.width / 2 + .6 + m && z < e.mouth[1] + 1.2 + m) return true;
    return false;
  };
  return { blocked, road };
}

/* The point a townsperson walks to at a plot: just outside one of its sides (the front first), on the main stretch
   of open ground, so every door can reach every other. */
const SIDES = [[0, 1], [1, 0], [-1, 0], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]];
export function doorOf(B, id, grid) {
  const [x, z] = B.plots[id];
  for (const [dx, dz] of SIDES) for (const r of [1.15, 1.35, 1.6]) { const p = [x + dx * r, z + dz * r]; if (grid.main(p)) return p; }
  return null;
}
export function vaultDoor(B, grid) {
  const [x, z] = B.vault;
  for (const [dx, dz] of SIDES) for (const r of [1.15, 1.4, 1.7]) { const p = [x + dx * r, z + dz * r]; if (grid.main(p)) return p; }
  return null;
}

/* The walking grid for a board: which cells are open, and what a step costs there (the road a little cheaper, so
   people use it as a street). */
export class WalkGrid {
  constructor(B) {
    this.B = B; this.K = blocker(B); const b = this.box = lifeBounds(B);
    this.w = Math.ceil((b.x1 - b.x0) / CELL) + 1; this.h = Math.ceil((b.z1 - b.z0) / CELL) + 1;
    this.open = new Uint8Array(this.w * this.h); this.cost = new Float32Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const x = b.x0 + i * CELL, z = b.z0 + j * CELL, k = j * this.w + i;
      this.open[k] = this.K.blocked(x, z, GRID_EXTRA) ? 0 : 1;
      this.cost[k] = this.K.road(x, z) < .45 ? .8 : 1;
    }
  }
  /* Whether a point stands on the largest stretch of open ground (found once, by flood fill). */
  main(p) {
    if (!this.part) {
      const W = this.w, N = W * this.h, part = this.part = new Int32Array(N).fill(-1), sizes = [];
      for (let k0 = 0; k0 < N; k0++) {
        if (!this.open[k0] || part[k0] >= 0) continue;
        const id = sizes.length, stack = [k0]; part[k0] = id; let n = 0;
        while (stack.length) {
          const k = stack.pop(), i = k % W, j = (k / W) | 0; n++;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj, nk = nj * W + ni; if (this.at(ni, nj) && part[nk] < 0) { part[nk] = id; stack.push(nk); } }
        }
        sizes.push(n);
      }
      this.big = sizes.indexOf(Math.max(...sizes));
    }
    const [i, j] = this.cell(p[0], p[1]);
    return this.at(i, j) && this.part[j * this.w + i] === this.big && !this.K.blocked(p[0], p[1], GRID_EXTRA);
  }
  cell(x, z) { return [Math.round((x - this.box.x0) / CELL), Math.round((z - this.box.z0) / CELL)]; }
  at(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && this.open[j * this.w + i] === 1; }
  /* Whether a straight walk from a to b stays on open ground. */
  clear(a, b) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / .05));
    for (let s = 0; s <= n; s++) { const x = a[0] + (b[0] - a[0]) * s / n, z = a[1] + (b[1] - a[1]) * s / n; if (this.K.blocked(x, z, GRID_EXTRA / 2)) return false; }
    return true;
  }
  /* The shortest walk from a to b as a few corner points, or null if there is none. A* on the grid, then the
     corners pulled straight wherever the ground between is clear. */
  route(a, b) {
    const [si, sj] = this.cell(a[0], a[1]), [ti, tj] = this.cell(b[0], b[1]);
    if (!this.at(si, sj) || !this.at(ti, tj)) return null;
    const W = this.w, N = W * this.h, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const s = sj * W + si, t = tj * W + ti, hx = k => Math.hypot(k % W - ti, ((k / W) | 0) - tj) * .8;
    g[s] = 0; push(s, hx(s));
    while (heap.length) {
      const [, k] = pop();
      if (done[k]) continue; done[k] = 1;
      if (k === t) break;
      const i = k % W, j = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!this.at(ni, nj) || (di && dj && (!this.at(i + di, j) || !this.at(i, j + dj)))) continue; // no squeezing past a corner
        const nk = nj * W + ni, ng = g[k] + (di && dj ? 1.414 : 1) * this.cost[nk];
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(nk, ng + hx(nk)); }
      }
    }
    if (from[t] < 0 && s !== t) return null;
    const cells = [];
    for (let k = t; k >= 0; k = from[k]) { cells.push([this.box.x0 + (k % W) * CELL, this.box.z0 + ((k / W) | 0) * CELL]); if (k === s) break; }
    cells.reverse(); cells[0] = a.slice(); cells[cells.length - 1] = b.slice();
    // pull the corners straight
    const out = [cells[0]];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      while (j > i + 1 && !this.clear(cells[i], cells[j])) j--;
      out.push(cells[j]); i = j;
    }
    return out;
  }
}

/* Where people go: a door at every built plot, and the vault. */
export function walkNodes(B, built, grid) {
  const out = [];
  for (const id of Object.keys(B.plots)) if (built(id)) { const d = doorOf(B, id, grid); if (d) out.push({ id, at: d }); }
  const v = vaultDoor(B, grid); if (v) out.push({ id: 'vault', at: v });
  return out;
}

/* A lane for a tumbleweed rolling east with the wind: { from: [x, z], to: [x, z] }, clear of everything, or null.
   r: a random number function. */
export function tumbleLane(B, r, K = blocker(B), tries = 24) {
  const b = lifeBounds(B);
  for (let n = 0; n < tries; n++) {
    const z = b.z0 + 1 + r() * (b.z1 - b.z0 + 1.5), drift = (r() - .5) * 2.4;
    const from = [b.x0 - 2.5, z - drift / 2], to = [b.x1 + 2.5, z + drift / 2];
    let ok = true;
    const L = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.ceil(L / .1);
    for (let s = 0; s <= n && ok; s++) { const x = from[0] + (to[0] - from[0]) * s / n, zz = from[1] + (to[1] - from[1]) * s / n; if (K.blocked(x, zz)) ok = false; }
    if (ok) return { from, to };
  }
  return null;
}

/* A small seeded random number function for the life on a board (the look stays the same from run to run). */
export function seeded(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
