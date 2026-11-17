/* Goods. price: base price in coins. tier: 0 raw, 1 intermediate, 2 finished. town: the one town that makes it.
   depth: how many units per second the empire market absorbs before the price halves (see src/core/market.js).
   Chain rule (checked by tools/audit.js): each made good is worth 1.3 to 1.6 times its inputs at base price. */
export const GOODS = {
  // Copper Gulch
  timber: { name: 'Timber', town: 'gulch', tier: 0, price: 1, depth: 4 },
  ore:    { name: 'Copper ore', town: 'gulch', tier: 0, price: 1.5, depth: 3 },
  clay:   { name: 'Clay', town: 'gulch', tier: 0, price: 1, depth: 4 },
  planks: { name: 'Planks', town: 'gulch', tier: 1, price: 3, depth: 2 },
  copper: { name: 'Copper', town: 'gulch', tier: 1, price: 6, depth: 1.2 },
  bricks: { name: 'Bricks', town: 'gulch', tier: 1, price: 4.5, depth: 1.6 },
  tools:  { name: 'Tools', town: 'gulch', tier: 2, price: 13, depth: .6 },
  wagons: { name: 'Wagons', town: 'gulch', tier: 2, price: 36, depth: .3 },
  // Iron Ridge (Dry Creek Outpost cuts stone too, as it digs copper ore, a good the Gulch makes)
  stone:  { name: 'Stone', town: 'ridge', tier: 0, price: 1.2, depth: 3 },
  iron:   { name: 'Iron ore', town: 'ridge', tier: 0, price: 2, depth: 3 },
  coal:   { name: 'Coal', town: 'ridge', tier: 0, price: 1.5, depth: 3 },
  pigiron: { name: 'Pig iron', town: 'ridge', tier: 1, price: 7.7, depth: 1.4 },
  steel:  { name: 'Steel', town: 'ridge', tier: 1, price: 13, depth: 1 },
  rails:  { name: 'Rails', town: 'ridge', tier: 2, price: 36, depth: .4 },
  boilers: { name: 'Boilers', town: 'ridge', tier: 2, price: 31, depth: .4 },
  locos:  { name: 'Locomotives', town: 'ridge', tier: 2, price: 165, depth: .1 },
};
