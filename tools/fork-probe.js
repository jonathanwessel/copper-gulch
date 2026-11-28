// node tools/fork-probe.js [--seed N]: the fork check of tools/balance.js (forkCheck) on one active empire through the
// Silver Falls, in a few minutes, so a change to how the bot weighs a tower can be read before the full balance run
// (the Frost Lens box, 2026.11.27-9: the standing guess in the Falls left Cold Snap the best pick on no Falls pad).
import { empire, forkCheck, printClose } from './balance.js';

const i = process.argv.indexOf('--seed'), seed = i > 0 ? +process.argv[i + 1] : 1;
const e = empire(seed, 'active', { capital: true, falls: true });
const fk = forkCheck([e]);
for (const r of fk.rows) console.log(`seed ${r.seed} | ${r.town} | ${r.kind} | ${Object.entries(r.won).map(([k, n]) => k + ' ' + n).join(', ')}`);
printClose();
console.log(fk.misses.length ? fk.misses.map(m => 'FAIL ' + m).join(String.fromCharCode(10)) : 'ok');
