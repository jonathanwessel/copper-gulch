// node tools/idle-sales.js [--seed 1] [--hours 3]: where an idle empire's sales go after its first idle hour (PLAN.md
// M6a, Two close gates: idle seed 1 sold 94% of its hour 1 in hours 3-11 against a 90% floor). Plays tools/idle.js's
// run and prints, for each idle hour, the coins each good sold for (every town together), with the change from hour 1,
// and the goods Auto-towers took for towers in that hour, so a drop in sales can be read as goods going into towers,
// a good that stopped being made, or a price that fell.
import { empire } from './balance.js';
import { STEP } from '../src/core/clock.js';
import { leave } from './idle.js';
import { towerReserve, towerAt, towerCost } from '../src/core/defense.js';
import { price } from '../src/core/market.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEED = arg('seed', 1), HOURS = arg('hours', 3);
const e = empire(SEED, 'active', { capital: true }), g = e.game;
if (e.capital == null) { console.log('no Capital'); process.exit(0); }
const on = leave(g);
console.log(`seed ${SEED}: left alone at ${(g.stats.steps * STEP / 3600).toFixed(2)} h with ${on.join(', ')}`);
const sales = () => { const o = {}; for (const t of Object.values(g.towns)) for (const [k, v] of Object.entries(t.tally)) if (k.startsWith('sale:')) o[k.slice(5)] = (o[k.slice(5)] || 0) + v; return o; };
const spent = {}; let hourSpent = {};
g.bus.on('tower:upgrade', x => { const t = g.towns[x.town], tw = t && towerAt(t, x.spot); if (tw) for (const [k, n] of Object.entries(towerCost(t, tw.kind, tw.level - 1).goods)) { const h = hourSpent[k] || (hourSpent[k] = { n: 0, coins: 0 }); h.n += n; h.coins += n * price(g, t, k); } });
const hours = [];
for (let h = 0; h < HOURS; h++) {
  const a = sales(); hourSpent = {};
  const made = {};
  for (let i = 0; i < 3600 / STEP; i++) g.step(STEP);
  const b = sales(), d = {};
  for (const k of Object.keys(b)) d[k] = b[k] - (a[k] || 0);
  hours.push({ d, towers: hourSpent, stock: ['gulch', 'ridge'].map(id => { const t = g.towns[id], r = towerReserve(t); return id + ' bricks ' + Math.round(t.goods.bricks || 0) + ' kept ' + Math.round(r.bricks || 0) + ', boilers ' + Math.round(t.goods.boilers || 0) + ' kept ' + Math.round(r.boilers || 0); }).join(' | '), levels: Object.fromEntries(Object.values(g.towns).map(t => [t.id, (t.towers || []).reduce((s, x) => s + x.level, 0)])) });
  void made; void spent;
}
const k1 = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e3).toFixed(1) + 'K';
const goods = Object.keys(hours[0].d).sort((x, y) => hours[0].d[y] - hours[0].d[x]);
console.log('good | ' + hours.map((_, i) => 'hour ' + (i + 1)).join(' | ') + ' | change from hour 1');
for (const k of goods) {
  const r = hours.map(x => x.d[k] || 0);
  console.log(`${k} | ${r.map(k1).join(' | ')} | ${r.slice(1).map(v => (v - r[0] >= 0 ? '+' : '') + k1(v - r[0])).join(' ')}`);
}
const tot = hours.map(x => Object.values(x.d).reduce((a, b) => a + b, 0));
console.log(`all | ${tot.map(k1).join(' | ')} | ${tot.slice(1).map(v => Math.round(100 * v / tot[0]) + '%').join(' ')}`);
hours.forEach((x, i) => console.log(`hour ${i + 1}: into towers ${Object.entries(x.towers).map(([k, v]) => k + ' ' + Math.round(v.n) + ' for ' + k1(v.coins)).join(', ')} | ${x.stock} | tower levels by town ${Object.entries(x.levels).filter(([, v]) => v).map(([t, v]) => t + ' ' + v).join(', ')}`));
