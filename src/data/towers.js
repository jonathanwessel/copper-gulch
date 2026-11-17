/* Towers. Each costs coins plus the town's own goods, so the chain feeds the defense. Stats at level 1:
   dmg per hit, rate in shots per second, range in world units. splash: blast radius; slow: share of speed taken for
   SLOW_SECONDS; poison: damage per second for POISON_SECONDS (it gets past armor).
   goods: by town, so each town pays with what it makes. At level 5 a tower takes one of two paths.
   Long-range towers (long: true) also fit the mortar pits, the far pads every map has. minRange: a dead zone it cannot
   fire into. flight: seconds a lobbed shell flies before it lands (the hit comes on landing). lob: it cannot hit
   airships. opens: the wave at which the town opens it (remembered in town.flags). */
export const TOWERS = {
  crossbow: {
    name: 'Crossbow', about: 'Shoots one raider at a time, fast.',
    coins: 20, goods: { gulch: { timber: 8 } }, dmg: 4, rate: 1.25, range: 2.4,
  },
  cannon: {
    name: 'Cannon', about: 'Slow, but each shot hits a whole group.',
    coins: 150, goods: { gulch: { copper: 6 } }, dmg: 16, rate: .5, range: 2.8, splash: 1.1,
  },
  frost: {
    name: 'Frost Lens', about: 'Slows every raider in range.',
    coins: 600, goods: { gulch: { bricks: 6, copper: 2 } }, dmg: 3, rate: 1, range: 2.1, slow: .45, pulse: true,
  },
  still: {
    name: 'Snake Oil Still', about: 'Throws poison that hurts armored raiders too.',
    coins: 2000, goods: { gulch: { bricks: 4, tools: 3 } }, dmg: 4, rate: .7, range: 2.4, poison: 6, cloud: .9,
  },
  // reaches from half to twice a normal tower's reach (NORMAL_REACH): 1.4 to 5.6
  mortar: {
    name: 'Mortar', about: 'Lobs shells far over the road. It can\'t hit raiders close to it.',
    coins: 1200, goods: { gulch: { copper: 10, bricks: 8 } }, dmg: 34, rate: .3, range: 5.6, minRange: 1.4, splash: 1.3,
    flight: 1.5, lob: true, long: true, opens: 12,
  },
};
/* A normal tower's reach, R. The Mortar reaches from 0.5R to 2R; mortar pits sit farther than R from the road. */
export const NORMAL_REACH = 2.8;

/* The two paths each tower can take at level 5: multipliers on its stats, and extra powers. */
export const PATHS = {
  crossbow: {
    a: { name: 'Repeater', about: 'Shoots more than twice as fast, but each shot does less damage.', rate: 2.2, dmg: .6 },
    b: { name: 'Longbow', about: 'Shoots farther and hits much harder, but slowly.', dmg: 2.6, rate: .55, range: 1.45 },
  },
  cannon: {
    a: { name: 'Heavy Cannon', about: 'Bigger blasts and longer range.', splash: 1.7, range: 1.3, dmg: 1.15, rate: .85 },
    b: { name: 'Grapeshot', about: 'Shoots fast, but only at close range.', rate: 1.8, dmg: .75, range: .85 },
  },
  frost: {
    a: { name: 'Deep Freeze', about: 'Every third pulse freezes raiders in place for a moment.', freeze: 1 },
    b: { name: 'Brittle Ice', about: 'Slowed raiders take 30% more damage from every tower.', brittle: .3 },
  },
  still: {
    a: { name: 'Plague Cloud', about: 'Poison clouds twice as big, and stronger.', cloud: 2, poison: 1.4 },
    b: { name: 'Spreading Fever', about: 'When a poisoned raider falls, the raiders near it get poisoned too.', spread: 1 },
  },
  mortar: {
    a: { name: 'Siege Mortar', about: 'A bigger blast, and it reaches even farther.', splash: 1.5, range: 1.2, dmg: 1.2, rate: .85 },
    b: { name: 'Shrapnel', about: 'A smaller blast that sets the ground on fire. Raiders in the fire slow down and get hurt.', splash: .7, rate: 1.15, fire: 1 },
  },
};

export const PATH_LEVEL = 5;          // the level at which a tower picks its path
export const SLOW_SECONDS = 1.5;
export const POISON_SECONDS = 4;
/* Shrapnel's burning ground: how long it burns, how much it slows, and its damage per second as a share of a hit. */
export const FIRE = { seconds: 3, slow: .3, dps: .35 };
export const SELL_BACK = .6;           // share of the coins spent that selling a tower returns
/* Per level after the first: damage x1.3, rate x1.04, range +0.05. Costs: coins x1.55 and goods x1.35 per level. */
export const PER_LEVEL = { dmg: 1.3, rate: 1.04, range: .05, coins: 1.55, goods: 1.35 };
