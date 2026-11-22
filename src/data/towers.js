/* Towers. Each costs coins plus the town's own goods, so the chain feeds the defense. Stats at level 1:
   dmg per hit, rate in shots per second, range in world units. splash: blast radius; slow: share of speed taken for
   SLOW_SECONDS; poison: damage per second for POISON_SECONDS (it gets past armor).
   goods: by town, so each town pays with what it makes. At level 5 a tower takes one of two paths.
   Long-range towers (long: true) also fit the mortar pits, the far pads every map has. minRange: a dead zone it cannot
   fire into. flight: seconds a lobbed shell flies before it lands (the hit comes on landing). lob: it cannot hit
   airships. opens: the wave at which the town opens it (remembered in town.flags).
   best: the raiders it hits hardest, as a damage factor by raider kind, 'armored' (any armor) or 'boss' (the wagons).
   The Still's applies to its poison. Each kind has a job no other does (CLAUDE.md, more than one way to win): the
   Crossbow picks off Horsemen, the Still's poison eats armor, the Mortar cracks wagons and packed groups.
   bestText: those raiders in words, for the tower card ("Best against").
   grow: its hit's growth per level, where it differs from PER_LEVEL.dmg. A tower that hits a whole group grows slower than
   one that hits one raider (M5, Pacing and Evaluation 2): by Silver Falls every tower stands at level 13 or so, and at
   1.3 a level the Mortar did 50-63% of the Falls' damage, the Frost Lens and the Cannon taking over in turn as it came
   down. */
export const TOWERS = {
  crossbow: {
    name: 'Crossbow', about: 'Fires fast, one shot at a time. Best against horsemen.', best: { runner: 2 }, bestText: 'Horsemen',
    coins: 20, goods: { gulch: { timber: 8 }, drycreek: { stone: 6 }, ridge: { stone: 8 }, pinehollow: { timber: 6 }, falls: { sand: 8 }, sandybend: { sand: 6 } }, dmg: 4, rate: 1.25, range: 2.4,
  },
  cannon: {
    name: 'Cannon', about: 'Slow, but each shot also hits the raiders around it.', bestText: 'Bunched-up raiders',
    coins: 100, goods: { gulch: { ore: 6 }, ridge: { iron: 6 }, pinehollow: { timber: 12 }, falls: { quartz: 6 }, sandybend: { sand: 12 } }, dmg: 13, rate: .5, range: 2.8, splash: 1.1, grow: 1.24, // 1.24 since 2026.11.20-17 (was 1.25): with more pads one Cannon did 37% of the economy player's damage in Silver Falls
  },
  frost: {
    name: 'Frost Lens', about: 'Slows every raider in range.',
    coins: 100, goods: { gulch: { planks: 4, clay: 3 }, ridge: { coal: 4, stone: 3 }, falls: { quartz: 4, sand: 3 } }, dmg: 4, rate: 1, range: 2.1, slow: .45, pulse: true, grow: 1.24,
  },
  still: {
    name: 'Snake Oil Still', about: 'Throws poison that eats armor. Best against brutes and {boss}.',
    coins: 100, goods: { gulch: { ore: 4, planks: 3 }, ridge: { stone: 4, coal: 3 }, falls: { sand: 4, glass: 3 } }, dmg: 5, rate: .7, range: 2.4, poison: 6.5, cloud: .9,
    best: { armored: 2.2 }, bestText: 'Brutes and {boss}',
  },
  // reaches from half to twice a normal tower's reach (NORMAL_REACH): 1.4 to 5.6
  mortar: {
    name: 'Mortar', about: 'Lobs shells far over the road, not up close. Best against {boss}.',
    coins: 400, goods: { gulch: { copper: 6, bricks: 6 }, ridge: { pigiron: 6, stone: 6 }, falls: { glass: 6, quartz: 6 } }, dmg: 36, rate: .3, range: 5.6, minRange: 1.4, splash: 1.4, grow: 1.19,
    best: { boss: 2.5 }, bestText: 'Big groups and {boss}',
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
    a: { name: 'Heavy Cannon', about: 'Bigger blast, reaches farther, fires slower.', splash: 1.7, range: 1.3, dmg: 1.15, rate: .85 },
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
    a: { name: 'Siege Mortar', about: 'Shoots farther with a bigger blast, but fires slower.', splash: 1.5, range: 1.2, dmg: 1.2, rate: .85 },
    b: { name: 'Shrapnel', about: 'Smaller blast that sets the ground on fire.', splash: .7, rate: 1.15, fire: 1 },
  },
};

export const PATH_LEVEL = 5;          // the level at which a tower picks its path
/* The second fork (owner idea, 2026-11-20): at FORK_LEVEL a tower of a kind listed here picks one of two more upgrades on
   top of its level-5 path, so it has 4 ways to finish (GDD.md, Second fork at level 20). The bots put the Ridge's
   towers at level 17-21 by the time Silver Falls is founded, and the Falls' own at 16 an hour later, so 20 lands
   around the Falls. The trade-off is where on the road, never just a bigger number:
     Slow Rot (rot: a share of its hit damage a second, past armor, that never wears off until the raider falls, in
       place of the normal poison; its hits are softer, dmg) wants the start of the road, where it ticks the whole way.
     Last Call (near) hits harder the farther the raider has come: NEAR.base + NEAR.gain times the share of its lane
       behind it, so a Still by the vault hits three times as hard and one at the entrance at 0.4 (rot .07 and gain 2.6 from A/B runs
       on the bots' late Ridge and Falls: Slow Rot deals the most at the first pads, Last Call from the middle on). */
export const FORK_LEVEL = 20;
export const FORKS = {
  still: {
    a: { name: 'Slow Rot', about: 'Softer hits and weak poison that lasts until the raider falls. Best at the start of the road.', dmg: .7, rot: .07 },
    b: { name: 'Last Call', about: 'Hits much harder near the vault. Best at the end of the road.', near: true },
  },
  /* The Cannon (part 2, 2026-11-21: the bots raise one Cannon to level 20 in Iron Ridge on every seed, while their
     Mortars stop at 15-17). The trade-off is against what:
       Rocket Battery (rockets) fires a volley of ROCKETS.count rockets, each at its own raider in reach (the ones
         nearest the vault first), each with a small blast, on a slow reload but a long reach. It wants raiders
         spread along the road, where one shell's blast finds one raider.
       Big Shell (boss) one huge, slow shot with a wider blast that hits a boss boss times as hard. It wants bunched
         raiders and the boss waves. */
  cannon: {
    a: { name: 'Rocket Battery', about: 'Fires 4 rockets at once, each at its own raider. Reaches far, reloads slowly.', bestText: 'Spread-out raiders', rockets: true, dmg: .65, rate: .55, range: 1.6, splash: .35 },
    b: { name: 'Big Shell', about: 'One huge shot with a wide blast. Reloads slowly. Hits {boss} twice as hard.', dmg: 2.2, rate: .5, splash: 1.25, boss: 2, bestText: 'Big groups' },
  },
};
/* Rocket Battery's rockets: how many a volley fires and how long each flies. A rocket finds its raider wherever it has
   gone by then (it seeks), and its blast goes off there. */
export const ROCKETS = { count: 4, flight: .6 };
export const NEAR = { base: .4, gain: 2.6 };
/* Poison eats armor (M6a, the Still late in the game): a raider carrying poison or rot from a Still of level
   EATS_ARMOR.from or more loses EATS_ARMOR.share of its armor against every hit, from every tower. The armor it would have shrugged off is the poison's doing, so the damage
   breakdown counts it for the Still. Before this the Still's job (getting past armor) faded as it rose: its poison grows
   1.15 a level against 1.3 for a hit, and by Silver Falls its Stills did 4% of the damage, none in the Ridge. Stripped
   armor grows with every tower around it, so a Still among strong towers is worth more late, not less.
   Tried first (2026.11.21-8): half from level 1 made the Gulch's Stills a little too strong in the first hour (minmax's
   one Still did 37% of the damage, the Ridge's wave 10 came at 6.8 min, the newcomer kept within 20% of the careful
   player); a share that grows with the level (3% a level, or 20% plus 2%) made a new Still late in the game worth too
   little, and the active bot built none in the Falls again; and 40% from level 1 still tipped four first-hour gates
   (minmax's Still 37%, the first charter at 45.2 min, the Ridge's wave 10 at 6.9 and 11.9 min, the skill gap). So it
   starts at level 10, a step a Still reaches late in the Gulch's first hour, and every Still from there eats the same.
   In Iron Ridge the Still is paid in stone and coal (iron and coal until 2026.11.21-8): with poison that eats armor
   the active bot keeps 2-3 Stills there to level 18-20, and their next levels kept thousands of iron back from the
   Blast Furnace, so the Capital's contracts (pig iron, steel, rails, boilers) filled slower and seed 3 bought an Empire
   tree upgrade only every 17.1 min (want 10-15). No Ridge workshop uses stone. */
export const EATS_ARMOR = { share: .5, from: 10 };
/* EATS_ARMOR in words, for the Still's card. */
export const eatWords = k => k >= 1 ? 'Lose all their armor' : k === .5 ? 'Lose half their armor' : 'Lose ' + Math.round(k * 100) + '% of their armor';
export const SLOW_SECONDS = 1.5;
export const POISON_SECONDS = 4;
/* Deep Freeze: every third pulse freezes the raiders in reach for FREEZE.seconds. A raider that thaws cannot be frozen
   again for FREEZE.again seconds, so however many lenses overlap, it walks at least that long between two freezes (with
   11 lenses on Iron Ridge's road, raiders stood frozen for half an hour and a wave took 40 minutes). 2.4 s left the bots'
   Ridge too weak at its wall, so 1.2: frozen at most 0.8 of every 2 seconds. */
export const FREEZE = { seconds: .8, again: 1.2 };
/* Shrapnel's burning ground: how long it burns, how much it slows, and its damage per second as a share of a hit. */
export const FIRE = { seconds: 3, slow: .3, dps: .35 };
/* A town's normal towers past board.crowd (the pads it had before 2026.11.20-17) each cost this much more coin and goods than
   the one before, so more pads give room to build without making many cheap towers the best buy every time (owner,
   2026-11-20: more pads; the swarm bot won Pine Hollow 40% ahead of min-max with every pad cheap). Upgrades cost the same. Goods count
   too: in an outpost late in the game coins are plenty and timber is what limits towers (the bots, 2026.11.20-17). */
export const EXTRA_TOWER = 1.25;
export const SELL_BACK = .6;           // share of the coins spent that selling a tower returns
/* Per level after the first: damage x1.3 (the Cannon and the Frost Lens 1.24, the Mortar 1.19: grow), poison x1.15 (one high Still must not carry a town: its poison grows
   slower than a hit), rate x1.04, range +0.05. Costs: coins x1.55 and goods x1.35 per level. */
export const PER_LEVEL = { dmg: 1.3, poison: 1.15, rate: 1.04, range: .05, coins: 1.55, goods: 1.35 };
