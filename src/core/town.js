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
    // the coin purse, shared by every town in a game (Game.addTown hands each town game.shared.purse); a town on its
    // own (tests) has its own. Not enumerable, so a town's save and a charter's reset never touch it.
    Object.defineProperty(this, 'purse', { value: { coins: 0 }, writable: true, enumerable: false, configurable: true });
    this.lifetime = 0;            // coins this town earned in this charter (the income on screen, deeds)
    this.fromOutposts = 0;        // of those, coins an outpost's sales paid in before the shared purse (save v12); deeds leave them out
    this.recent = 0;              // coins this town earned lately, fading over about 5 minutes (what a fallen vault can lose)
    this.goods = {};              // good id -> amount in the yard
    this.buildings = {};          // building id -> level (0 or missing: not built)
    this.towers = [];             // [{ id, kind, x, y, level, path }]
    this.wave = 0;
    this.bestWave = 0;
    this.record = 0;              // the best wave before this town's last charter (src/core/charter.js)
    this.vault = { hp: 100, max: 100 };
    this.research = {};           // item id -> level
    this.lab = null;              // the research running: { id, left, total } (src/core/research.js)
    this.labNext = null;          // one research lined up to start next (src/core/research.js)
    this.foremen = {};            // building id -> true (working) or false (switched off) (src/core/foremen.js)
    this.flags = {};              // one-time things that happened (first sale, coach cards seen...)
    this.tally = {};              // coins earned since load, by where they came from (src/core/explain.js); not saved
  }
  /* Coins are one purse for the whole empire (owner decision, 2026-11-17): every town reads and spends the same coins. */
  get coins() { return this.purse.coins; }
  set coins(v) { this.purse.coins = v; }
  /* Add coins earned (sales, bounties) to the purse; lifetime and recent count what this town earned.
     key: where they came from, for the income explained ('sale:timber', 'bounty', 'call'). */
  earn(n, fromOutpost = false, key = 'other') {
    if (!(n > 0)) return;
    this.coins += n; this.lifetime += n; this.recent = (this.recent || 0) + n;
    if (fromOutpost) this.fromOutposts = (this.fromOutposts || 0) + n;
    this.tally[key] = (this.tally[key] || 0) + n;
  }
  /* Coins this town earned by itself in this charter (what deeds count). */
  get ownEarned() { return this.lifetime - (this.fromOutposts || 0); }
  /* Spend if affordable; returns whether it was paid. */
  spend(n) { if (n < 0 || this.coins + 1e-9 < n) return false; this.coins -= n; return true; }
  has(good, n) { return (this.goods[good] || 0) + 1e-9 >= n; }
  addGood(good, n) { this.goods[good] = Math.max(0, (this.goods[good] || 0) + n); }
  level(building) { return this.buildings[building] || 0; }

  toJSON() {
    const o = {};
    for (const [k, v] of Object.entries(this)) if (k !== 'def' && k !== 'tally') o[k] = v;
    o.rng = this.rng.state; o.mods = this.mods.toJSON();
    return JSON.parse(JSON.stringify(o));
  }
  static fromJSON(o, def = null) {
    const t = new Town(o.id, { def });
    for (const [k, v] of Object.entries(o)) if (k !== 'rng' && k !== 'mods' && k !== 'tally' && k !== 'coins') t[k] = JSON.parse(JSON.stringify(v));
    t.rng = Rng.from(o.rng); t.mods = Mods.from(o.mods); t.def = def;
    return t;
  }
}
