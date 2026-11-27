/* Raiders. hp: times the wave's base health; speed: world units per second; bounty: times the wave's base bounty;
   leak: vault strength lost when it reaches the vault; armor: share of each hit it shrugs off (poison ignores it).
   from: the first wave it rides in. The boss of every 10th wave is the town's own (town.def.boss; the Gulch: the war
   wagon, Iron Ridge: the armored train, Silver Falls: the ironclad steamer, the outposts: the smaller bandit wagon).
   water: it rides the river (lane 1) in a town that has one; a town with a river sends every waves.boatEvery-th raider
   by boat.
   air: it flies the sky lane (board.sky) in a town that has one, over everything: only a tower that reaches the sky
   (TOWERS[kind].air, the Tesla Coil) can hit it, and no blast, cloud or fire on the ground does (canHit in
   src/core/defense.js). A town with a sky sends every waves.airEvery-th raider by air from waves.airFrom.
   stages: a boss changes as it is hurt (owner, 2026-11-22: "the stage the boss was in, for example when the crew got
   off the war wagon"). Each stage starts once its health falls to `at` of its most: it drops `n` raiders of kind
   `drop` beside it (their health from the wave's, like any raider), its pace becomes `speed` times its own, and its
   armor becomes `armor` when given. The boss bar names the stage (STAGE_WORDS) and the model shows it. Tuned so a
   boss stays a gate, not a wall (2026.11.22-10: a train at 1.35 times its pace and a steamer at 1.5 put the economy
   bot's Ridge wave 10 at 11-13 min on three seeds, against 7-9 with no stages, tools/boom-probe.js with STAGES=off; a
   steamer at 1.25 still won Silver Falls wave 10 on seed 1, 11.5 min against 8.3 at 1.1).
   low: the stage brings an air boss down low over the town, where every tower can hit it (grounded in
   src/core/defense.js), and its drop lands on the road (lane 0) under it.
   only: a raider that only rides off a boss (the war wagon's crew), never in a wave's own mix. */
export const FOES = {
  raider: { name: 'Bandit', hp: 1, speed: 1.1, bounty: 1, leak: 1, armor: 0, from: 1 },
  runner: { name: 'Horseman', many: 'Horsemen', hp: .55, speed: 2, bounty: 1, leak: 1, armor: 0, from: 3 },
  brute:  { name: 'Brute', hp: 3.2, speed: .7, bounty: 3, leak: 2, armor: .25, from: 6 },
  crew:   { name: 'Wagon crew', many: 'Wagon crew', hp: .5, speed: 1.6, bounty: 1, leak: 1, armor: 0, from: 10, only: true },
  wagon:  { name: 'War wagon', hp: 12, speed: .7, bounty: 25, leak: 8, armor: .35, from: 10, boss: true,
    stages: [{ at: .5, key: 'crew', drop: 'crew', n: 3, speed: .6 }] },
  bandits: { name: 'Bandit wagon', hp: 8, speed: .75, bounty: 12, leak: 6, armor: .2, from: 10, boss: true,
    stages: [{ at: .5, key: 'horsemen', drop: 'runner', n: 2, speed: .6 }] },
  train:  { name: 'Armored train', hp: 19, speed: .75, bounty: 35, leak: 10, armor: .4, from: 10, boss: true,
    stages: [{ at: .5, key: 'plates', speed: 1.15, armor: .15 }] },
  boat:   { name: 'Riverboat', hp: 2.2, speed: .85, bounty: 2, leak: 2, armor: .2, from: 1, water: true },
  // the airship (M6b part 2b): a gas bag over a gondola of raiders, slow, and too high for every tower but the Tesla Coil
  airship: { name: 'Airship', hp: 1.6, speed: .8, bounty: 2, leak: 2, armor: 0, from: 1, air: true },
  // the pirate airship (M6b part 2c, Thunder Mesa's boss from its second boss wave): a dark armed airship on the sky
  // lane, where only the Tesla Coil reaches it, until at half health its crew slides down ropes to the road and it sinks
  // low, slower, where every tower can hit it. So the Mesa's boss needs Teslas and ground towers both.
  skypirate: { name: 'Pirate airship', hp: 8, speed: .65, bounty: 30, leak: 8, armor: .2, from: 10, boss: true, air: true,
    stages: [{ at: .5, key: 'bail', drop: 'pirate', n: 4, speed: .8, low: true }] },
  pirate: { name: 'Sky pirate', many: 'Sky pirates', hp: .55, speed: 1.5, bounty: 1, leak: 1, armor: 0, from: 10, only: true },
  steamer: { name: 'Ironclad steamer', hp: 18, speed: .62, bounty: 40, leak: 10, armor: .45, from: 10, boss: true, water: true,
    stages: [{ at: 1 / 3, key: 'steam', speed: 1.1 }] },
};
/* What the boss bar says once a boss reaches each stage: a few words. */
/* What happened and what it changed, in three words (review of 2026.11.23-7: the lines named only what happened). */
/* The same stage on the raider card, in a sentence: the bar has a picture and an arrow beside its few words, the card a
   chip with room (clarity fix 8b: "Crew off, slower" on the card read as a note). */
export const STAGE_LINES = { crew: 'The crew jumped off. The wagon is slower.', horsemen: 'The horsemen rode off. The wagon is slower.', plates: 'Its plates fell off. It is faster.', steam: 'It is at full steam. It is faster.', bail: 'The crew slid down to the road. The airship flies low now, and every tower can hit it.' };
export const STAGE_WORDS = { crew: 'Crew off, slower', horsemen: 'Horsemen off, slower', plates: 'Plates off, faster', steam: 'Full steam, faster', bail: 'Crew off, sinking' };

/* Kinds of wave: weights of each raider, a count factor, a health factor and a spacing factor. */
export const WAVE_TYPES = {
  mixed: { name: 'Mixed raid', from: 1, mix: { raider: 4, runner: 2, brute: 1 }, count: 1, hp: 1, gap: 1 },
  rush:  { name: 'Rush', from: 4, mix: { runner: 5, raider: 1 }, count: 1.25, hp: .85, gap: .6 },
  swarm: { name: 'Swarm', from: 5, mix: { raider: 6, runner: 1 }, count: 1.9, hp: .5, gap: .45 },
  heavy: { name: 'Heavy column', from: 7, mix: { brute: 3, raider: 1 }, count: .55, hp: 1.15, gap: 1.4 },
};

export const WAVE = {
  first: 35,        // seconds before wave 1
  rest: 7,         // seconds between a cleared wave and the next, at least
  pace: 58,        // and at least this many seconds from one wave's start to the next (Call now skips the wait: a strong defense goes faster)
  speed: 1.07,      // every raider's pace on the long, winding Gulch road
  hp: w => 8 * 1.2 ** (w - 1) * (1 + w * .04),
  bounty: w => 1.5 * 1.13 ** (w - 1),
  count: w => Math.min(36, 6 + Math.floor(w * 1.1)),
  gap: w => Math.max(.3, .8 - w * .01),
  boss: 10,         // a boss every this many waves
  bossGrowth: .4,   // a boss's health grows slower than its wave: hp(10) x (hp(w) / hp(10)) ** bossGrowth (boss waves are gates, so a
                    // careful player must be able to stop each one; at the full growth the wave-20 war wagon reached the vault with half its health)
  vault: 20,        // vault strength
  breachLoss: .1,   // share of coins lost when the vault falls
  breachBack: 2,    // waves dropped back when the vault falls
  mend: .1,         // share of the vault's full strength it mends for each wave beaten (clarity fix 3b part 2c, GDD.md Vault)
};
