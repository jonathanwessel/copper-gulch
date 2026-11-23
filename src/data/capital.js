/* The Capital (GDD.md, The Capital). It makes nothing and has no road or raiders. It is founded once, from Iron Ridge,
   and posts federal contracts: an order for goods one of your towns makes. A filled contract pays coins and Influence.
   found: what founding it takes (the town that pays, the best wave it must have reached, the coins from the purse,
          and the best wave at which it first shows as in sight).
   contracts: board (offers on the board at once), minutes (an ask is about this many minutes of the maker's spare
          output, picked at random in the range), pay (coins per unit, times the good's base price), influence
          (Influence for an ask of `per` minutes, by the good's tier), least (the smallest ask, in units, by tier),
          retry (seconds before an empty spot on the board looks again). */
export const CAPITAL_DEF = {
  name: 'Capital',               // the map label's name too (review of 2026.11.20-10: "Capital" against "The Capital")
  short: 'Capital',
  // set 2026-11-18 with tools/balance.js: the GDD's first sketch (Ridge wave 15 + 2M) was written before the economy was
  // tuned; the bots hold about 20-60K coins a minute at the Ridge's second hour, so 2M was hours of saving.
  // 60K since clarity fix 3 (2026-11-23): the newcomer bot reaches the Ridge's wave 30 at 109-123 min earning 6.5-10K
  // a minute (tools/capital-probe.js), so 150K was 15-23 minutes of every coin and it never saved; 60K is 6-9 minutes
  // there and 4-5 minutes of saving for the active bot
  found: { from: 'ridge', wave: 30, coins: 25000, shows: 25 }, // 60K until clarity fix 3b part 2: a held Ridge earns about 3K a minute, so 60K was 19 minutes of holding
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

/* The Capital's city on the empire map (src/assets/models/capital.js), in map units round the Capital's site. A round
   stone plaza; the capitol toward the back with its steps toward +z (the camera's home side) and the contract board in
   front of them; one lot for each institution round it, the Market Board at the plaza's front gate, so every building
   faces the camera and none hides behind the dome. A lot shows survey stakes until its institution is founded, then
   its building rises there. Footprints are rectangles (w across, d deep, turned by ry); trees are [x, z].
   test/city.test.js checks they all stay on the plaza and clear of each other and of the towns. */
export const CITY = {
  plaza: 2.5,
  capitol: { at: [0, -1], w: 2.3, d: 1.66, ry: 0 },
  board: { at: [0, .4], w: .9, d: .3, ry: 0 },
  lots: {
    market: { at: [0, 1.75], w: .9, d: .7, ry: 0 },
    bank: { at: [-1.55, .9], w: .8, d: .7, ry: .6 },
    transport: { at: [1.55, .9], w: .9, d: .7, ry: -.6 },
    university: { at: [-1.8, -.55], w: .8, d: .7, ry: 1.1 },
    war: { at: [1.8, -.55], w: .72, d: .8, ry: -1.1 },
  },
  lamps: [[-.72, .5], [.72, .5]],
  trees: [.1, 1.05, 2.09, 3.03, -1.57, -2.3, -.84].map(a => [+(Math.cos(a) * 2.2).toFixed(2), +(Math.sin(a) * 2.2).toFixed(2)]),
};
