/* Towers. Each costs coins plus the town's own goods, so the chain feeds the defense. Stats at level 1:
   dmg per hit, rate in shots per second, range in world units. splash: blast radius; slow: share of speed taken for
   SLOW_SECONDS; poison: damage per second for POISON_SECONDS (it gets past armor).
   goods: by town, so each town pays with what it makes. At level 5 a tower takes one of two paths.
   Long-range towers (long: true) also fit the mortar pits, the far pads every map has. minRange: a dead zone it cannot
   fire into. flight: seconds a lobbed shell flies before it lands (the hit comes on landing). lob: it cannot hit
   airships. opens: the wave at which the town opens it (remembered in town.flags).
   best: the raiders it hits hardest, as a damage factor by raider kind, 'armored' (any armor) or 'boss' (the wagons).
   The Still's applies to its poison. Each kind has a job no other does (CLAUDE.md, more than one way to win): the
   Crossbow picks off Riders, the Still's poison eats armor, the Mortar cracks wagons and packed groups.
   bestText: those raiders in words, for the tower card ("Best against"). */
export const TOWERS = {
  crossbow: {
    name: 'Crossbow', about: 'Shoots one raider at a time, fast. Best against Riders.', best: { runner: 2 }, bestText: 'Riders',
    coins: 20, goods: { gulch: { timber: 8 }, drycreek: { stone: 6 }, ridge: { stone: 8 }, pinehollow: { timber: 6 }, falls: { sand: 8 }, sandybend: { sand: 6 } }, dmg: 4, rate: 1.25, range: 2.4,
  },
  cannon: {
    name: 'Cannon', about: 'Slow, but each shot hits a whole group.',
    coins: 100, goods: { gulch: { ore: 6 }, ridge: { iron: 6 }, pinehollow: { timber: 12 }, falls: { quartz: 6 }, sandybend: { sand: 12 } }, dmg: 13, rate: .5, range: 2.8, splash: 1.1,
  },
  frost: {
    name: 'Frost Lens', about: 'Slows every raider in range.',
    coins: 100, goods: { gulch: { planks: 4, clay: 3 }, ridge: { coal: 4, stone: 3 }, falls: { quartz: 4, sand: 3 } }, dmg: 4, rate: 1, range: 2.1, slow: .45, pulse: true,
  },
  still: {
    name: 'Snake Oil Still', about: 'Throws poison. Best against Brutes and wagons.',
    coins: 100, goods: { gulch: { ore: 4, planks: 3 }, ridge: { iron: 4, coal: 3 }, falls: { sand: 4, glass: 3 } }, dmg: 5, rate: .7, range: 2.4, poison: 6.5, cloud: .9,
    best: { armored: 2.2 }, bestText: 'Brutes and wagons',
  },
  // reaches from half to twice a normal tower's reach (NORMAL_REACH): 1.4 to 5.6
  mortar: {
    name: 'Mortar', about: 'Lobs shells far over the road, not up close. Best against wagons.',
    coins: 400, goods: { gulch: { copper: 6, bricks: 6 }, ridge: { pigiron: 6, stone: 6 }, falls: { glass: 6, quartz: 6 } }, dmg: 36, rate: .3, range: 5.6, minRange: 1.4, splash: 1.4,
    best: { boss: 2.5 }, bestText: 'Wagons and big groups',
    flight: 1.5, lob: true, long: true, opens: 12,
  },
};
/* A normal tower's reach, R. The Mortar reaches from 0.5R to 2R; mortar pits sit farther than R from the road. */
export const NORMAL_REACH = 2.8;

/* The two paths each tower can take at level 5: multipliers on its stats, and extra powers. */
export const PATHS = {
  crossbow: {
    a: { name: 'Repeater', about: 'Shoots twice as fast, softer hits.', rate: 2.2, dmg: .6 },
    b: { name: 'Longbow', about: 'Hits much harder and farther, but slowly.', dmg: 2.2, rate: .55, range: 1.3 },
  },
  cannon: {
    a: { name: 'Heavy Cannon', about: 'Bigger blast, reaches farther.', splash: 1.7, range: 1.3, dmg: 1.15, rate: .85 },
    b: { name: 'Grapeshot', about: 'Fires fast, only up close.', rate: 1.8, dmg: .75, range: .85 },
  },
  frost: {
    a: { name: 'Deep Freeze', about: 'Now and then freezes raiders in place.', freeze: 1 },
    b: { name: 'Brittle Ice', about: 'Slowed raiders take more damage.', brittle: .3 },
  },
  still: {
    a: { name: 'Plague Cloud', about: 'Bigger, stronger poison clouds.', cloud: 2, poison: 1.3 },
    b: { name: 'Spreading Fever', about: 'Poison spreads when a raider falls.', spread: 1 },
  },
  mortar: {
    a: { name: 'Siege Mortar', about: 'Shoots farther. The blast is bigger.', splash: 1.5, range: 1.2, dmg: 1.2, rate: .85 },
    b: { name: 'Shrapnel', about: 'Smaller blast that sets the ground on fire.', splash: .7, rate: 1.15, fire: 1 },
  },
};

export const PATH_LEVEL = 5;          // the level at which a tower picks its path
export const SLOW_SECONDS = 1.5;
export const POISON_SECONDS = 4;
/* Deep Freeze: every third pulse freezes the raiders in reach for FREEZE.seconds. A raider that thaws cannot be frozen
   again for FREEZE.again seconds, so however many lenses overlap, it walks at least that long between two freezes (with
   11 lenses on Iron Ridge's road, raiders stood frozen for half an hour and a wave took 40 minutes). 2.4 s left the bots'
   Ridge too weak at its wall, so 1.2: frozen at most 0.8 of every 2 seconds. */
export const FREEZE = { seconds: .8, again: 1.2 };
/* Shrapnel's burning ground: how long it burns, how much it slows, and its damage per second as a share of a hit. */
export const FIRE = { seconds: 3, slow: .3, dps: .35 };
export const SELL_BACK = .6;           // share of the coins spent that selling a tower returns
/* Per level after the first: damage x1.3, poison x1.15 (one high Still must not carry a town: its poison grows
   slower than a hit), rate x1.04, range +0.05. Costs: coins x1.55 and goods x1.35 per level. */
export const PER_LEVEL = { dmg: 1.3, poison: 1.15, rate: 1.04, range: .05, coins: 1.55, goods: 1.35 };
