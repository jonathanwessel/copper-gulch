/* Call to arms (GDD.md, Late-game depth; owner idea, 2026-11-20). A town's workers leave its buildings and fight on the
   road as a militia for a short while, then the town waits before it can call them again. While they fight, the
   buildings make nothing.
   opens:    the War Office upgrade (by its place in the branch, 1 = the first) that opens it in every town
   seconds:  how long the militia fights
   cooldown: seconds from the call until the town can call again (the fight is part of it)
   reach:    how far each worker's rifle reaches, in world units (a Crossbow reaches about 2)
   rate:     shots a second for each worker
   hit:      one shot, as a share of a plain raider's health on this wave, from a level-10 building's workers
   grow:     a bigger building sends more workers: the shot grows as (level / 10) to this power ...
   most:     ... up to this many times the level-10 shot
   side:     how far from the road's middle the workers stand, toward their building
   Tuned so the militia helps at a boss gate but a town can never hold with it alone (test/arms.test.js: a town with
   no towers loses most of a wave to the road; tools/balance.js gates its share of the late damage). */
export const ARMS = {
  opens: 3,
  seconds: 40,
  cooldown: 300,
  reach: 1.6,
  rate: 1,
  hit: .035,
  grow: .4,
  most: 3,
  side: .55,
};
