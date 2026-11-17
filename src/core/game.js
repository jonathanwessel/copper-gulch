/* The game: the towns, the clock and the event bus, and the systems that move them. Deterministic: the same seed and
   the same commands, at the same steps, always give the same game. Real time comes in through advance(); the time
   away comes in through catchUp(). Systems are plain objects:
     { id, init(town, game), step(town, dt, game), coarse(town, dt, game) }
   step runs every fixed step for the town in play and every town in the background; coarse (optional, defaults to
   step) runs the big chunks of offline catch-up. Systems that own empire-wide state (the market) also have
   setup(game), which makes game.shared[id], and tick(dt, game), which runs once per step before the towns. */
import { Clock, STEP } from './clock.js';
import { Bus } from './events.js';
import { Town } from './town.js';

export class Game {
  constructor({ seed = 'cg', systems = [], defs = {} } = {}) {
    this.seed = String(seed);
    this.systems = systems;
    this.defs = defs;            // town id -> town data
    this.bus = new Bus();
    this.clock = new Clock();
    this.towns = {};
    this.active = null;
    this.stats = { steps: 0 };
    this.shared = { purse: { coins: 0 } }; // empire-wide state: the coin purse, and what systems own (shared.market...)
    for (const s of systems) if (s.setup) s.setup(this);
  }
  /* Open a town (first time: runs every system's init). */
  addTown(id) {
    if (this.towns[id]) return this.towns[id];
    const t = this.towns[id] = new Town(id, { seed: this.seed, def: this.defs[id] || null });
    t.purse = this.shared.purse;
    for (const s of this.systems) if (s.init) s.init(t, this);
    if (!this.active) this.active = id;
    this.bus.emit('town:open', { town: id });
    return t;
  }
  get town() { return this.towns[this.active]; }
  /* Put another open town in play. Returns true when it switched. */
  go(id) {
    if (!this.towns[id] || this.active === id) return false;
    this.active = id;
    this.bus.emit('town:go', { town: id });
    return true;
  }
  /* Real seconds in; fixed steps out. Returns the number of steps taken. */
  advance(realSeconds) { return this.clock.advance(realSeconds, dt => this.step(dt)); }
  step(dt = STEP) {
    for (const s of this.systems) if (s.tick) s.tick(dt, this);
    for (const id in this.towns) {
      const t = this.towns[id];
      t.t += dt;
      for (const s of this.systems) if (s.step) s.step(t, dt, this);
    }
    this.stats.steps++;
  }
  coarse(dt) {
    for (const s of this.systems) if (s.tick) s.tick(dt, this);
    for (const id in this.towns) {
      const t = this.towns[id];
      t.t += dt;
      for (const s of this.systems) (s.coarse || s.step)?.call(s, t, dt, this);
    }
  }
  /* Coins earned by every town in this charter, added up (the empire's income on screen). */
  get earned() { let n = 0; for (const id in this.towns) n += this.towns[id].lifetime; return n; }
  /* Run `seconds` of time away. Returns { fine, coarse, seconds, earned: { town: coins } }. */
  catchUp(seconds) {
    const before = Object.fromEntries(Object.entries(this.towns).map(([id, t]) => [id, t.lifetime]));
    this.catching = true; // systems may rest while time away is caught up (defense does, until M4)
    const r = this.clock.catchUp(seconds, dt => this.step(dt), dt => this.coarse(dt));
    this.catching = false;
    r.earned = Object.fromEntries(Object.entries(this.towns).map(([id, t]) => [id, t.lifetime - (before[id] || 0)]));
    this.bus.emit('offline', r);
    return r;
  }
  toJSON() {
    return {
      seed: this.seed, active: this.active, clock: this.clock.toJSON(), stats: this.stats, shared: JSON.parse(JSON.stringify(this.shared)),
      towns: Object.fromEntries(Object.entries(this.towns).map(([id, t]) => [id, t.toJSON()])),
    };
  }
  static fromJSON(o, { systems = [], defs = {} } = {}) {
    const g = new Game({ seed: o.seed, systems, defs });
    g.clock = new Clock(o.clock); g.stats = { ...g.stats, ...o.stats }; g.active = o.active;
    for (const [k, v] of Object.entries(o.shared || {})) g.shared[k] = { ...(g.shared[k] || {}), ...JSON.parse(JSON.stringify(v)) };
    g.shared.purse = { coins: 0, ...(g.shared.purse || {}) };
    for (const [id, t] of Object.entries(o.towns || {})) { g.towns[id] = Town.fromJSON(t, defs[id] || null); g.towns[id].purse = g.shared.purse; }
    for (const s of systems) if (s.load) for (const t of Object.values(g.towns)) s.load(t, g);
    return g;
  }
}
