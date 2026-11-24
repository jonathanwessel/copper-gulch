/* Institutions and the Empire tree (GDD.md, Institutions). The Capital founds each institution once, with coins from
   the purse. Each institution is one branch of the Empire tree: a line of upgrades bought in order with Influence.
   Every upgrade's effect is a named source on a stat in every town (the institution's name, so the explain view shows
   "Bank"), inside the stat's published cap (src/core/mods.js).
   found: coins for the first institution founded (first), then coins for the next; each one founded after it costs `growth` times more, whichever it is,
          so the order is the player's choice.
   cost:  Influence for the 1st, 2nd... upgrade of a branch (the same in every branch).
   effects: { stat, mul, where } where 'outpost' puts it only on outposts. The stat 'influence' is the Capital's own
          (Influence a finished contract pays). Text follows the writing rule in PLAN.md: plain, short, no colons. */

// first: 40K since clarity fix 3b part 2d (2026-11-23), 50K before: with both towns at a wall the newcomer of seed 5 never
// built it in 30 minutes after the Capital; the second still costs 80K and each after it growth times more
export const FOUND = { first: 40000, coins: 50000, growth: 1.6 }; // growth 1.5 until 2026-11-18: foremen stopped wasting coins and the fastest seed bought a tree upgrade every 9.2 min
export const NODE_COST = [10, 15, 25, 40, 60]; // the first was 8 until 2026.11.18-15 (a seed bought a tree upgrade every 9.2 min again)

export const INSTITUTIONS = [
  {
    id: 'market', name: 'Market Board', about: 'Better prices and more Influence.',
    nodes: [
      { id: 'pricelists', name: 'Price Lists', about: 'Goods sell for 10% more.', effects: [{ stat: 'price', mul: 1.1 }] },
      { id: 'agents', name: 'Federal Agents', about: 'Contracts pay 25% more Influence.', effects: [{ stat: 'influence', mul: 1.25 }] },
      { id: 'fair', name: 'Trade Fair', about: 'Goods sell for 15% more.', effects: [{ stat: 'price', mul: 1.15 }] },
      { id: 'lobby', name: 'Lobby Office', about: 'Contracts pay 25% more Influence.', effects: [{ stat: 'influence', mul: 1.25 }] },
      { id: 'exchange', name: 'Grain Exchange', about: 'Goods sell for 20% more.', effects: [{ stat: 'price', mul: 1.2 }] },
    ],
  },
  {
    id: 'transport', name: 'Rail Office', about: '{outposts} make more goods. Buildings cost less.',
    nodes: [
      { id: 'freight', name: 'Freight Office', about: '{outposts} make 25% more goods.', effects: [{ stat: 'prod', mul: 1.25, where: 'outpost' }] },
      { id: 'survey', name: 'Survey Crews', about: 'Buildings cost 10% less.', effects: [{ stat: 'cost:build', mul: .9 }] },
      { id: 'mules', name: 'Mule Trains', about: '{outposts} make 50% more goods.', effects: [{ stat: 'prod', mul: 1.5, where: 'outpost' }] },
      { id: 'grants', name: 'Rail Grants', about: 'Buildings cost 15% less.', effects: [{ stat: 'cost:build', mul: .85 }] },
      { id: 'depots', name: 'Supply Depots', about: 'Every building makes 10% more goods.', effects: [{ stat: 'prod', mul: 1.1 }] },
    ],
  },
  {
    id: 'bank', name: 'Bank', about: 'More coins from everything you earn.',
    nodes: [
      { id: 'tellers', name: 'Teller Windows', about: 'You earn 10% more coins.', effects: [{ stat: 'income', mul: 1.1 }] },
      { id: 'loans', name: 'Loan Office', about: 'Everything costs 5% less.', effects: [{ stat: 'cost', mul: .95 }] },
      { id: 'reserve', name: 'Gold Reserve', about: 'You earn 10% more coins.', effects: [{ stat: 'income', mul: 1.1 }] },
      { id: 'bonds', name: 'Bond Sales', about: 'Everything costs 5% less.', effects: [{ stat: 'cost', mul: .95 }] },
      { id: 'branches', name: 'Branch Banks', about: 'You earn 15% more coins.', effects: [{ stat: 'income', mul: 1.15 }] },
    ],
  },
  {
    id: 'university', name: 'University', about: 'Faster, cheaper research.',
    nodes: [
      { id: 'lectures', name: 'Lecture Hall', about: 'Research is 30% faster.', effects: [{ stat: 'research', mul: 1.3 }] },
      { id: 'labgrants', name: 'Lab Grants', about: 'Research costs 25% less.', effects: [{ stat: 'cost:research', mul: .75 }] },
      { id: 'engineers', name: 'Engineering School', about: 'Every building makes 10% more goods.', effects: [{ stat: 'prod', mul: 1.1 }] },
      { id: 'library', name: 'Great Library', about: 'Research is 30% faster.', effects: [{ stat: 'research', mul: 1.3 }] },
      { id: 'fieldwork', name: 'Field Surveys', about: 'Towers reach 10% farther.', effects: [{ stat: 'towerRange', mul: 1.1 }] },
    ],
  },
  {
    id: 'war', name: 'War Office', about: 'Stronger towers and a tougher vault.',
    nodes: [
      { id: 'drill', name: 'Drill Sergeants', about: 'Towers hit 10% harder.', effects: [{ stat: 'towerDmg', mul: 1.1 }] },
      { id: 'forts', name: 'Fort Engineers', about: 'Your vault takes 25% more hits.', effects: [{ stat: 'vault', mul: 1.25 }] },
      // the third War Office upgrade also opens Call to arms in every town (src/data/arms.js, ARMS.opens)
      { id: 'armory', name: 'Armory', about: 'Towers hit 15% harder. Every town can call its workers to arms.', opens: 'arms', effects: [{ stat: 'towerDmg', mul: 1.15 }] },
      { id: 'marshals', name: 'Marshals', about: 'Raiders drop 25% more coins.', effects: [{ stat: 'bounty', mul: 1.25 }] },
      { id: 'staff', name: 'General Staff', about: 'Towers shoot 10% faster.', effects: [{ stat: 'towerRate', mul: 1.1 }] },
    ],
  },
];
/* What an institution does in amounts a player can check (review of 2026.11.19-11: two "up to" totals each could not
   be checked). Before it is built, its first upgrade ("Goods sell for 10% more.", under a First upgrade label). Once built, what the
   upgrades bought so far give, added up by kind ("Goods sell for 10% more."), so a bought +10% stays on the card.
   Worked out from the nodes, so it never drifts from them. */
/* {outposts}: the names of the player's outposts, filled in on screen (outpostWords), so the card says which places
   (review of 2026.11.20-11: "Every outpost" at the Rail Office, and earlier "Your outposts" did not say what they are). */
export const outpostWords = (s, names) => s.split('{outposts}').join(names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || 'Outposts');
const SAYS = {
  price: p => 'Goods sell for ' + p + '% more.', influence: p => 'Contracts pay ' + p + '% more Influence.',
  'prod:outpost': p => '{outposts} make ' + p + '% more goods.', prod: p => 'Every building makes ' + p + '% more goods.',
  'cost:build': p => 'Buildings cost ' + p + '% less.', income: p => 'You earn ' + p + '% more coins.',
  cost: p => 'Everything costs ' + p + '% less.', research: p => 'Research is ' + p + '% faster.',
  'cost:research': p => 'Research costs ' + p + '% less.', towerRange: p => 'Towers reach ' + p + '% farther.',
  towerDmg: p => 'Towers hit ' + p + '% harder.', vault: p => 'Your vault takes ' + p + '% more hits.',
  bounty: p => 'Raiders drop ' + p + '% more coins.', towerRate: p => 'Towers shoot ' + p + '% faster.',
};
/* What the first n upgrades of an institution give, each kind once. */
export function boughtText(inst, n) {
  const all = new Map();
  for (const node of inst.nodes.slice(0, n)) for (const e of node.effects) { const k = e.stat + (e.where ? ':' + e.where : ''); all.set(k, (all.get(k) || 1) * e.mul); }
  const opens = inst.nodes.slice(0, n).some(x => x.opens === 'arms') ? ['Every town can call its workers to arms.'] : [];
  return [...[...all].map(([k, m]) => SAYS[k](Math.round(Math.abs(m - 1) * 100))), ...opens].join(' ');
}
for (const i of INSTITUTIONS) i.about = boughtText(i, 1); // shown under a small First upgrade label (src/ui/capital.js)
export const INSTITUTION = Object.fromEntries(INSTITUTIONS.map(i => [i.id, i]));
