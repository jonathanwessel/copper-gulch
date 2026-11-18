/* The Capital (GDD.md, The Capital). It makes nothing and has no road or raiders. It is founded once, from Iron Ridge,
   and posts federal contracts: an order for goods one of your towns makes. A filled contract pays coins and Influence.
   found: what founding it takes (the town that pays, the best wave it must have reached, the coins from the purse,
          and the best wave at which it first shows as in sight).
   contracts: board (offers on the board at once), minutes (an ask is about this many minutes of the maker's spare
          output, picked at random in the range), pay (coins per unit, times the good's base price), influence
          (Influence for an ask of `per` minutes, by the good's tier), least (the smallest ask, in units, by tier),
          retry (seconds before an empty spot on the board looks again). */
export const CAPITAL_DEF = {
  name: 'The Capital',
  short: 'Capital',
  // set 2026-11-18 with tools/balance.js: the GDD's first sketch (Ridge wave 15 + 2M) was written before the economy was
  // tuned; the bots hold about 20-60K coins a minute at the Ridge's second hour, so 2M was hours of saving
  found: { from: 'ridge', wave: 30, coins: 150000, shows: 25 },
  contracts: {
    board: 3,
    minutes: [4, 8],
    per: 6,
    pay: 1.5,
    influence: { 1: 4, 2: 8 },
    least: { 1: 20, 2: 5 },
    retry: 10,
  },
};
