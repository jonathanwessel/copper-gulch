# Copper Gulch fresh-eyes review: a newcomer's first play (2026-11-23)

The progression and first-play clarity pass, part 1 (PLAN.md M6a). `tools/playthrough.js` ran the newcomer bot of
`tools/firstplay.js` for 5.5 hours of play on seed 1 and loaded each moment that mattered in the real game at phone
size: 83 moments (every tip card, unlock, new button and the sheet it opens, the first boss and the first lost wave in
each place, the charter offer, and every stretch of 2 minutes or more with nothing new). A subagent got only those
screenshots, the list of moments and the bot tables, never the code, and read them as a 12-year-old seeing the game
for the first time. The earlier reviews (Evaluations 1 and 2) are in git history.

## What the core run showed before the reviewer looked

Traced on the release before this one (2026.11.23-1), seed 1:

- **The strip went blank.** Once Iron Ridge was founded the Gulch had no goal left, and the strip was empty for stretches of 7, 15, 19 and 25 minutes, about half of the time from minute 65 to 330. Nothing ever pointed at Silver Falls or the Capital.
- **Goals the player could not act on.** "Tap the Smelter lot, then tap Build" sat 20 minutes (500 coins, never held at once, no count shown). "Tap a Mortar pit and build a Mortar" sat 17 minutes: the Mortar needs bricks and no Kiln was built or asked for. "Tap the Toolsmith lot, then tap Build" sat 14 of its 24 minutes on a lot still locked (Sawmill 10 and Smelter 5).
- **The newcomer never reached the Capital or Silver Falls in 5.5 hours.** The purse stayed between 300 and 22K against the Capital's 150K, and Silver Falls also needs 5 deeds, which a player who never signs a charter never gets. From about hour 3 the Gulch and the Ridge sat at waves 40-45.

Fixed in 2026.11.23-2 (the first fix box): the strip always names a step that can be taken now. A new lot shows its price as have / need, a locked lot asks for the level that opens it, a tower whose goods nothing here makes asks for that building first (the Mortar asks for the Kiln), and a town with no goal left shows the empire's next step (the wave, the deeds, the coins, then the map). On the same seed the Mortar wait fell from 17 minutes to 2, Iron Ridge came at 48 minutes instead of 61, and no stretch has a blank strip. The 20-minute Smelter and the Capital's coins remain: the newcomer still spends every coin.

## The reviewer's top 10 (ranked by the reviewer)

1. **The Capital coin wall ends the game.** The strip reads "2.18K / 150K" for hours, the purse peaks at 22K, and the quiet stretches run 18, 25, 23 and 102 minutes (079-083). Fix idea: tie the Capital's price to income, or open it on waves and goods. Check: the newcomer opens the Capital by minute 150, with no quiet stretch over 10 minutes after hour 1.
2. **Coin goals never fill because nothing says save.** The Smelter goal held 20 minutes with coins bouncing (037-045), and the Toolsmith 26 minutes at "1.72K / 9K" (076). Fix idea: say how soon it is ready if you save. Check: the Smelter goal held under 3 minutes in the median newcomer run.
3. **Goals ask for things you cannot do yet.** In Dry Creek, "0 / 12" and "2.9 / 30" sat at +0/s for minutes, since every stone is saved for towers and none is sold (005-016). Research asked for 200 coins with 85 (032). A Mortar pit card shows before the Mortar opens at wave 12 (036). "You can build the Capital soon" with 1.6K of 150K (072). Check: no strip goal needs coins while income is 0 for more than 30 seconds.
4. **The strip showed another town's count as if it were this town's.** "9 / 30" in the Gulch at wave 26 read as the Gulch's wave (061-073). Fixed in this release: the count says "wave 9 / 30" and the line says "Win waves in Iron Ridge to open the Capital".
5. **Danger and losses are quiet.** A lost wave drops the wave number with no card (046, 074). The Gulch on hold while the strip talks about saving coins, with no dot on Map (047, 054). 2 hearts left in a boss fight while the strip talks about Iron Ridge (071).
6. **Production chains stall without a word.** Tools at 0 after the Toolsmith is built (079, 083), Steel, Rails and Boilers at 0 (074-082), Pine Hollow promises clay that stays at 0 (054-060), and 33.4K timber piles up (083).
7. **Too many cards early.** 18 cards in the first 5 minutes (001-018), Milestones (levels 10 to 100) at minute 4. (The "Booms and busts" card showing five times was the tool's fault, fixed: off the page the card was never due, so never marked seen.)
8. **Names that do not match.** "Sell" and "Off" in a card against "Sell spare" and "Always" on the sheet (009, 017). "Save for towers off" against the "2 upgrades / 4 upgrades" buttons (010). Stockpile and vault, bandit wagon and war wagon, Copper Camp and Copper Mine. "A charter or two" against 5 deeds (070).
9. **The charter, deeds and Silver Falls are never guided.** The Perks sheet's "Best wave 29 · 0 deeds / 85.2K coins earned here · 1 deed" is unreadable (067-open), the strip never asks for a charter, and the newcomer never signs, so Silver Falls stays shut.
10. **Numbers that mislead, and spotlights that miss.** Coins climb while the rate reads +0/s (026-031), hearts go over 20 with no reason (043), decimal coins on the strip (fixed in this release), the spotlight on Hold waves rather than the pit (036, 040), and a Sawmill card that did not show (031).

Also flagged, words that read as a manual, a narrator or jargon: 005 "Tap it right away and the wave has more raiders.", 009 "Sell too much of one good and its price drops for a while, so making several goods earns more.", 010 "It does not sell them, and other buildings leave them alone.", 016 "Tap Makes on its card to see how the number adds up.", 030 "The thin bar under a town fills as its wave goes on.", 037 "Tap a tower to see what it is best against.", 056 "That is a bust.", 077 "Boilers sells for less", 065 "reputation", 067 "deeds" and "charter", 026 and 060 "Raid in 1:56" and "Raids" (never explained).

## What the plan does with it

The fix boxes are in PLAN.md right after part 2 (the bots' progression table), ranked with what part 2 finds.
