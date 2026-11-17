/* Multipliers. Every bonus in the game is a named source on a stat ("Sawmill research +20% production"), never a bare
   number folded into a formula. That gives the "explain" view: tap any rate and see each part and its factor.
   A stat's value is (base + adds) x (product of muls), and its total factor is held inside the stat's published cap.
   Caps are either { max } (a bonus stat) or { min } (a cost or time stat, where lower is better). */

export const CAPS = {
  prod:      { max: 1e6 },   // production speed of buildings
  income:    { max: 1e9 },   // coins from sales
  price:     { max: 50 },    // sale price
  cost:      { min: .05 },   // building and tower prices
  research:  { max: 1e3 },   // research speed
  towerDmg:  { max: 1e4 },
  towerRate: { max: 5 },
  towerRange: { max: 2 },
  blast:     { max: 3 },     // how wide a blast reaches (Cannon, Mortar)
  foeHp:     { max: 1e12 },
  vault:     { max: 1e4 },
  deeds:     { max: 1e6 },
  offline:   { max: 1 },     // share of income earned while away
  bounty:    { max: 1e4 },   // coins a fallen raider drops
  use:       { max: 10 },    // how much of an input a building uses per unit ("use:smelter:timber")
};

export class Mods {
  constructor(caps = CAPS) { this.caps = caps; this.src = {}; } // src[stat][source] = { mul, add }
  /* A stat may be narrowed to one thing with a colon ("prod:saw" is the Sawmill's own production); it shares the cap
     of its family ("prod"). */
  cap(stat) { return this.caps[stat] || this.caps[stat.split(':')[0]]; }
  check(stat) { if (!this.cap(stat)) throw new Error('No published cap for stat "' + stat + '"'); }
  /* Set a source's factor on a stat: mul multiplies, add is added to the base. Setting mul 1 and add 0 removes it. */
  set(stat, source, { mul = 1, add = 0 } = {}) {
    this.check(stat);
    const s = this.src[stat] || (this.src[stat] = {});
    if (mul === 1 && add === 0) delete s[source]; else s[source] = { mul, add };
  }
  remove(stat, source) { if (this.src[stat]) delete this.src[stat][source]; }
  /* Drop every source whose name starts with a prefix (e.g. 'research:' when research resets). */
  clear(prefix = '') { for (const st in this.src) for (const k in this.src[st]) if (k.startsWith(prefix)) delete this.src[st][k]; }
  /* The total factor on a stat, inside its cap. */
  factor(stat) { return this.explain(stat, 1).factor; }
  value(stat, base) { return this.explain(stat, base).value; }
  /* Every part of a stat: [{ source, mul, add }], the raw factor, the capped factor and the value. */
  explain(stat, base = 1) {
    this.check(stat);
    const parts = Object.entries(this.src[stat] || {}).map(([source, p]) => ({ source, ...p }))
      .sort((a, b) => a.source < b.source ? -1 : 1);
    const add = parts.reduce((s, p) => s + p.add, 0), mul = parts.reduce((s, p) => s * p.mul, 1);
    const raw = base ? ((base + add) / base) * mul : mul;
    const cap = this.cap(stat), factor = cap.max !== undefined ? Math.min(cap.max, raw) : Math.max(cap.min, raw);
    return { stat, parts, base, raw, factor, capped: factor !== raw, value: base ? base * factor : (add * mul) };
  }
  toJSON() { return this.src; }
  static from(src, caps = CAPS) { const m = new Mods(caps); m.src = JSON.parse(JSON.stringify(src || {})); return m; }
}
