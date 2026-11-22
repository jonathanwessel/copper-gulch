/* Town orders (GDD.md, Market): buyers in each town ask for a load of a good the town makes, by a deadline. A filled
   order pays coins and raises the town's reputation, a missed one lowers it.
   wave: orders open once two towns (not outposts) have each beaten this wave, then `first` seconds later (a minute, so
     the card never lands on the win of that wave). Decided 2026.11.22-4: a clock of 10 minutes from a second town
     opened them while the player was still in Pine Hollow, and the active bot's Iron Ridge wave 10 came at 11.5 min on
     one seed (want 7-10).
   board: offers on a town's board at once. minutes: an ask is about this many minutes of the town's spare output,
     picked at random in the range. time: the deadline is this many times the ask's minutes, so a town that keeps
     making the good has room to spare. pay: coins per unit, times what the market pays for it now (base times saturation and
     the town's price bonus, with no boom or bust), so an order beats selling but never by more on a flooded good.
     Set 2026-11-22 with tools/order-probe.js: at 1.2 times the base price orders paid 16-20M coins a run and Silver
     Falls came 0.6 h sooner (6.05-6.12 h against a window from 6). repPay: at reputation 100 orders pay this much more.
   least: the smallest ask in units, by the good's tier. fill / miss: reputation won by a filled order (rush: rushFill)
     and lost by a missed one or one given up. max: the top reputation.
   rush: from reputation rushAt, an offer is a rush order with chance `chance`: a smaller ask (its own minutes) and a
     tighter deadline (its own time) for `pay` times the coins.
   stale: an offer nobody takes is replaced after this many seconds, so the board follows the town as it grows.
   retry: seconds before an empty spot on the board draws again. */
export const ORDERS = {
  wave: 10,
  first: 60,
  board: 2,
  minutes: [3, 6],
  time: 2,
  pay: 1.3,
  repPay: .5,
  least: { 0: 40, 1: 20, 2: 5 },
  fill: 8, rushFill: 12, miss: 15, max: 100,
  rushAt: 60,
  rush: { chance: .4, minutes: [2, 3], time: 1.4, pay: 1.6 },
  stale: 600,
  retry: 45,
};
