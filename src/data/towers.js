/* Towers. Each costs coins plus the town's own goods, so the chain feeds the defense. Stats at level 1:
   dmg per hit, rate in shots per second, range in world units. splash: blast radius; slow: share of speed taken for
   SLOW_SECONDS; poison: damage per second for POISON_SECONDS (it gets past armor).
   goods: by town, so each town pays with what it makes. At level 5 a tower takes one of two paths. */
export const TOWERS = {
  crossbow: {
    name: 'Crossbow', about: 'Quick single shots.',
    coins: 20, goods: { gulch: { timber: 8 } }, dmg: 4, rate: 1.25, range: 2.4,
  },
  cannon: {
    name: 'Cannon', about: 'Slow, and hits a whole cluster.',
    coins: 150, goods: { gulch: { copper: 6 } }, dmg: 16, rate: .5, range: 2.8, splash: 1.1,
  },
  frost: {
    name: 'Frost Lens', about: 'Chills everything in reach.',
    coins: 600, goods: { gulch: { bricks: 6, copper: 2 } }, dmg: 3, rate: 1, range: 2.1, slow: .45, pulse: true,
  },
  still: {
    name: 'Snake Oil Still', about: 'Lobs flasks that burst into poison. Poison gets past armor.',
    coins: 2000, goods: { gulch: { bricks: 4, tools: 3 } }, dmg: 4, rate: .7, range: 2.4, poison: 6, cloud: .9,
  },
};

/* The two paths each tower can take at level 5: multipliers on its stats, and extra powers. */
export const PATHS = {
  crossbow: {
    a: { name: 'Repeater', about: 'Fires more than twice as fast, for less damage each.', rate: 2.2, dmg: .6 },
    b: { name: 'Longbow', about: 'Huge damage at long reach. Fires slowly.', dmg: 2.6, rate: .55, range: 1.45 },
  },
  cannon: {
    a: { name: 'Mortar', about: 'A much bigger blast and longer reach.', splash: 1.7, range: 1.3, dmg: 1.15, rate: .85 },
    b: { name: 'Grapeshot', about: 'Fires fast at close range.', rate: 1.8, dmg: .75, range: .85 },
  },
  frost: {
    a: { name: 'Deep Freeze', about: 'Every third pulse freezes raiders solid for a moment.', freeze: 1 },
    b: { name: 'Brittle Ice', about: 'Chilled raiders take 30% more damage from every tower.', brittle: .3 },
  },
  still: {
    a: { name: 'Plague Cloud', about: 'Clouds twice as wide, with stronger poison.', cloud: 2, poison: 1.4 },
    b: { name: 'Spreading Fever', about: 'A poisoned raider that falls passes the poison to raiders near it.', spread: 1 },
  },
};

export const PATH_LEVEL = 5;          // the level at which a tower picks its path
export const SLOW_SECONDS = 1.5;
export const POISON_SECONDS = 4;
export const SELL_BACK = .6;           // share of the coins spent that selling a tower returns
/* Per level after the first: damage x1.3, rate x1.04, range +0.05. Costs: coins x1.55 and goods x1.35 per level. */
export const PER_LEVEL = { dmg: 1.3, rate: 1.04, range: .05, coins: 1.55, goods: 1.35 };
