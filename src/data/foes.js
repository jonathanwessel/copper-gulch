/* Raiders. hp: times the wave's base health; speed: world units per second; bounty: times the wave's base bounty;
   leak: vault strength lost when it reaches the vault; armor: share of each hit it shrugs off (poison ignores it).
   from: the first wave it rides in. The boss of every 10th wave is the town's own (the Gulch: the war wagon). */
export const FOES = {
  raider: { name: 'Bandit', hp: 1, speed: 1.1, bounty: 1, leak: 1, armor: 0, from: 1 },
  runner: { name: 'Rider', hp: .55, speed: 2, bounty: 1, leak: 1, armor: 0, from: 3 },
  brute:  { name: 'Brute', hp: 3.2, speed: .7, bounty: 3, leak: 2, armor: .25, from: 6 },
  wagon:  { name: 'War wagon', hp: 25, speed: .5, bounty: 25, leak: 8, armor: .35, from: 10, boss: true },
};

/* Kinds of wave: weights of each raider, a count factor, a health factor and a spacing factor. */
export const WAVE_TYPES = {
  mixed: { name: 'Mixed raid', from: 1, mix: { raider: 4, runner: 2, brute: 1 }, count: 1, hp: 1, gap: 1 },
  rush:  { name: 'Rush', from: 4, mix: { runner: 5, raider: 1 }, count: 1.25, hp: .85, gap: .6 },
  swarm: { name: 'Swarm', from: 5, mix: { raider: 6, runner: 1 }, count: 1.9, hp: .5, gap: .45 },
  heavy: { name: 'Heavy column', from: 7, mix: { brute: 3, raider: 1 }, count: .55, hp: 1.15, gap: 1.4 },
};

export const WAVE = {
  first: 30,        // seconds before wave 1
  rest: 8.5,        // seconds between a cleared wave and the next
  speed: 1.07,      // every raider's pace on the long, winding Gulch road
  hp: w => 8 * 1.2 ** (w - 1) * (1 + w * .04),
  bounty: w => 1.5 * 1.13 ** (w - 1),
  count: w => Math.min(36, 6 + Math.floor(w * 1.1)),
  gap: w => Math.max(.3, .8 - w * .01),
  boss: 10,         // a boss every this many waves
  vault: 20,        // vault strength
  breachLoss: .1,   // share of coins lost when the vault falls
  breachBack: 2,    // waves dropped back when the vault falls
};
