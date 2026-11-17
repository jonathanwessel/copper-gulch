/* Charters, deeds and deed perks (GDD.md, Charters and deeds).
   A town's charter pays deeds from its best wave and the coins earned since its last charter. Deeds are kept for good,
   and each one adds INCOME to the coins earned in every town.
   Perks come in pairs: once you hold `need` deeds you pick one side of the pair. Picks stay until the next charter,
   which clears them so you pick again. Each side's effects are named sources on stats ("Boomtown perk").
   Text follows the owner's writing rule (PLAN.md): plain, short, no colons or semicolons. */

export const DEEDS = {
  wave: 30, waveStep: 5,     // 1 deed at best wave 30, and 1 more for every 5 waves past it
  coins: 6e4, coinStep: 10,  // 1 deed at 60K coins earned in this charter, and 1 more each time that grows tenfold
  income: .25,               // each deed adds 25% to the coins earned in every town
};

export const PERKS = [
  {
    id: 'trade', need: 1,
    a: { name: 'Boomtown', about: 'Every building makes 20% more goods.', effects: [{ stat: 'prod', mul: 1.2 }] },
    b: { name: 'Fort Town', about: 'Every tower hits 20% harder.', effects: [{ stat: 'towerDmg', mul: 1.2 }] },
  },
  {
    id: 'guns', need: 2,
    a: { name: 'Big Guns', about: 'Tower upgrades cost 30% fewer coins.', effects: [{ stat: 'cost:towerUp', mul: .7 }] },
    b: { name: 'Many Hands', about: 'New towers cost 40% fewer coins.', effects: [{ stat: 'cost:towerNew', mul: .6 }] },
  },
  {
    id: 'books', need: 3,
    a: { name: 'Quick Study', about: 'Research takes half the time.', effects: [{ stat: 'research', mul: 2 }] },
    b: { name: 'Hard Bargain', about: 'Goods sell for 15% more.', effects: [{ stat: 'price', mul: 1.15 }] },
  },
  {
    id: 'law', need: 5,
    a: { name: 'Bounty Hunters', about: 'Raiders drop 50% more coins.', effects: [{ stat: 'bounty', mul: 1.5 }] },
    b: { name: 'Stone Walls', about: 'Your vault takes 50% more hits.', effects: [{ stat: 'vault', mul: 1.5 }] },
  },
];
export const PERK = Object.fromEntries(PERKS.map(p => [p.id, p]));
