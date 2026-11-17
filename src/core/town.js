/* A town: everything one frontier town owns. No global state: a Town is plain data plus its own random stream and
   multipliers, so several towns run side by side and the background ones can be stepped or estimated.
   What a town does each step comes from the game's systems (economy, defense, research...), which read and write
   the fields below and may add their own. */
import { Rng } from './rng.js';
import { Mods } from './mods.js';

export class Town {
  constructor(id, { seed = 'cg', def = null } = {}) {
    this.id = id;
    this.def = def;               // the town's data (src/data/towns/*.js); not saved
    this.rng = new Rng(seed + ':' + id);
    this.mods = new Mods();
    this.t = 0;                   // seconds this town has run
    this.coins = 0;
    this.lifetime = 0;            // coins earned in this charter (the deed formula reads it)
    this.goods = {};              // good id -> amount in the yard
    this.buildings = {};          // building id -> level (0 or missing: not built)
    this.towers = [];             // [{ id, kind, x, y, level, path }]
    this.wave = 0;
    this.bestWave = 0;
    this.vault = { hp: 100, max: 100 };
    this.research = {};           // item id -> level
    this.foremen = {};            // building id -> true
    this.flags = {};              // one-time things that happened (first sale, coach cards seen...)
  }
  /* Add coins earned (sales, bounties); lifetime counts every coin earned. */
  earn(n) { if (n > 0) { this.coins += n; this.lifetime += n; } }
  /* Spend if affordable; returns whether it was paid. */
  spend(n) { if (n < 0 || this.coins + 1e-9 < n) return false; this.coins -= n; return true; }
  has(good, n) { return (this.goods[good] || 0) + 1e-9 >= n; }
  addGood(good, n) { this.goods[good] = Math.max(0, (this.goods[good] || 0) + n); }
  level(building) { return this.buildings[building] || 0; }

  toJSON() {
    const o = {};
    for (const [k, v] of Object.entries(this)) if (k !== 'def') o[k] = v;
    o.rng = this.rng.state; o.mods = this.mods.toJSON();
    return JSON.parse(JSON.stringify(o));
  }
  static fromJSON(o, def = null) {
    const t = new Town(o.id, { def });
    for (const [k, v] of Object.entries(o)) if (k !== 'rng' && k !== 'mods') t[k] = JSON.parse(JSON.stringify(v));
    t.rng = Rng.from(o.rng); t.mods = Mods.from(o.mods); t.def = def;
    return t;
  }
}
