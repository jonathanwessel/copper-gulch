// node tools/late-towers.js [--seeds 2]: the active player's whole climb (Dry Creek to Silver Falls), with the damage
// each tower kind does and the towers standing, town by town, after the first hour of each town as well as before it.
// The balance gates count only a town's first hour (tools/balance.js); this shows which kinds still carry their weight
// late (PLAN.md, M6a: the Still late in the game). --seed N runs one seed only (about 2 minutes), and each seed also
// prints the late gates that a tower change can tip from afar: the Empire tree's pace, the contracts and the Wire Mill
// (2026.11.21-8: Stills kept to level 18 held back the Ridge's iron, and the tree slowed on seed 3).
import { empire, fallsFrom, STRATEGIES } from './balance.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const SEEDS = arg('seeds', 2), ONE = arg('seed', 0);
const pct = d => { const tot = Object.values(d).reduce((a, b) => a + b, 0) || 1; return Object.entries(d).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + Math.round(100 * n / tot) + '%').join(', '); };

for (let s = ONE || 1; s <= (ONE || SEEDS); s++) {
  const e = empire(s, 'active', { capital: true, falls: true });
  const g = e.game, im = e.falls && e.falls.imports;
  console.log(`seed ${s} | tree an upgrade every ${e.tree && e.tree.gap ? (e.tree.gap / 60).toFixed(1) + ' min' : 'never'} (want 10-15) | contracts ${e.contracts ? e.contracts.filled : 0} | Falls founded ${e.fallsFound == null ? 'never' : (e.fallsFound / 3600).toFixed(2) + ' h'} | Wire Mill on Gulch copper ${im && im.built.wiremill ? Math.round(100 * im.run.wiremill / im.built.wiremill) + '%' : '-'} (want 90%)`);
  for (const [id, t] of Object.entries(g.towns)) {
    if (!t.towers || !t.towers.length) continue;
    const kinds = {}; for (const x of t.towers) kinds[x.kind] = (kinds[x.kind] || []).concat(x.level + (x.path || '') + (x.fork || ''));
    console.log(`seed ${s} | ${id} wave ${t.wave} | ${Object.entries(kinds).map(([k, v]) => k + ' ' + v.join(' ')).join(' · ')}`);
  }
  for (const [name, r] of [['ridge', e.ridge], ['capSave', e.capSave], ['fSave', e.fSave], ['falls', e.falls]]) if (r) console.log(`seed ${s} | ${name} first hour: ${pct(r.dealt)} | late: ${pct(r.late)} | bought ${Object.entries(r.bought).map(([k, n]) => k + ' ' + n).join(', ')}`);
  if (e.fallsSnap && process.argv.includes('--strategies')) for (const k of Object.keys(STRATEGIES)) { const r = fallsFrom(e.fallsSnap, s, k); console.log(`seed ${s} | falls ${k} | ${pct(r.dealt)} | bought ${Object.entries(r.bought).map(([a, n]) => a + " " + n).join(", ")}`); }
}
