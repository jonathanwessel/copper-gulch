# Copper Gulch: game design

Copper Gulch is a free Old West tycoon and tower-defense game. You run towns along a frontier, grow their supply chains, ship goods between them, and hold the road against raiders. It is phone first and installs as an app. It has no ads, no purchases and no tracking.

## Pillars
1. **Every town is a working diorama.** Production chains fill the yard, and a road, a river or a sky lane runs past it that must be defended.
2. **Goods flow between towns**, and the Capital is what they flow toward.
3. **Every number explains itself.** Tapping any rate shows each source and its factor.
4. **The player decides first, and automation takes over later.** It only covers decisions the player has already made by hand.

## Towns and eras
| # | Town | Era | Lanes | Boss | Opens when |
|---|---|---|---|---|---|
| O1 | Dry Creek Outpost | Frontier camp: ore and stone | one loop round the camp | Bandit wagon | at the start (the first stage) |
| 1 | Copper Gulch | Frontier: wood, clay, copper | road | War wagon | Dry Creek's wave 10 won (about 10-15 min) |
| 2 | Iron Ridge | Iron and rail | switchback road | Armored train | Gulch wave 20 + 15K coins, first life, no charter needed |
| C | The Capital | Government | none | none | Ridge wave 30 + 150K coins (set 2026-11-18; the first sketch said wave 15 + 2M) |
| 3 | Silver Falls | Electricity | road + river | Ironclad steamer | Ridge wave 25 + **5 deeds** + 50M (realistically 1 or 2 charters) |
| 4 | Thunder Mesa | Oil and flight | road + sky | Sky pirate airship | Transport node 3 + 1B |
| 5 | Radium Springs | Radio and radium | road + sky + a static field that jams towers | Iron Colossus (a steam walker) | Mesa wave 30 + University node 4 + 50B |

The Empire map shows the 5-deed gate for Silver Falls in plain words: "sign 1 or 2 charters". Without the deed bonus, its coin price is out of reach.

**One purse for the empire** (owner decision, 2026-11-17, save v12). Coins are one balance, shown at the top in every town. Every town and outpost puts its sales, bounties and Call now bonuses into it, and every purchase anywhere spends from it. Each town still counts what it earned itself in this charter (`town.lifetime`), which is what deeds and the Welcome back line read. Tapping the coins shows the town in play by source, then one line for each other town and outpost. Routes move goods only. A charter never touches the purse. The save migration added every town's old coins into the purse.

**Founding a town** (set 2026-11-17, M3). Each later town names what founding it takes (`town.def.found`, `src/core/empire.js`): the town that pays, the best wave it must have reached, and the coins it pays. Iron Ridge: Copper Gulch's best wave 20 (any life) and 15K coins from the shared purse (was 150K in the first pass; the bots never held that much, see Pacing targets). A new town and its outpost each put their start coins into the purse once (Iron Ridge 60, Pine Hollow 150). Once the paying town's best wave is 5 short of the mark, the next town shows as a locked button in the town row at the top, with a red dot once it can be founded; tapping it opens a sheet with what it takes and a Start button. Founding opens the town and its outpost, and takes the player there.

## The Capital (M4, first part shipped 2026-11-18)
- **Building it.** The Capital sits in the middle of the empire map. It comes into sight once Iron Ridge's best wave is 25: its badge and card show the rules (beat wave 30 in Iron Ridge, 150K coins) with have / need, Map gets a dot when it can be built, and Build the Capital on its card pays from the purse (`src/core/capital.js`, `src/data/capital.js`). It has no board, road or raiders, so it is never "in play": the player stays on the map and its card is its screen. Once built, the map draws a capitol (white hall, columns, a copper dome and a flag) in place of the surveyed plot. The full city with a building for each institution comes later.
- **No treasury.** The first sketch had a treasury filled by a 10% tithe on every town. With one purse for the empire (owner decision), a second pile of coins would only hide coins from the player, so it was dropped: institutions are founded with purse coins. The tithe law goes too.
- **Federal contracts.** The board holds 3 offers. Each asks for one made good (never raw) from the open town that makes it, which must have some to spare (what its buildings make, less what its own workshops and the towns it ships to use). The ask is about 4 to 8 minutes of that spare output, rounded to two figures (at least 20 of an intermediate good or 5 of a finished one). No good is on the board twice, and finished goods come up twice as often. A contract pays 1.5 times the good's base price in coins (no market saturation) and Influence: 4 for an intermediate good or 8 for a finished one, for 6 minutes' worth, scaled by the minutes asked.
- **One at a time** (decision: the choice is which one). Take starts one; while it runs, its town sends the good to the Capital by itself, after routes and before the market, from its stock above its workshops' buffer and its tower reserve. The Sell switch does not stop it, like a route. Taking another offer (Switch, two taps) drops the one running, and what it got is lost. Drop (two taps) does the same without taking another. A full contract pays its coins into the purse as the making town's own earnings ("Contracts for the Capital" when coins are tapped, and they count toward that town's deeds), pays its Influence, says so in a toast, and the board fills again. A spot with nothing to ask for looks again every 10 seconds.
- **Influence** is the Capital's own currency, shown on its card and its map badge. It buys nodes in the Empire tree (next part). Map carries a dot while the Capital has no contract running.
- **Bots.** The active bot (`tools/balance.js`, `empire` with `capital`) plays on in the Ridge after its 90 minutes there, saves for the Capital once the price is no more than 6 minutes of every town's income (holding the Ridge's waves and switching off every town's foremen, which would spend the one purse), builds it at 3.2-3.3 h of play, and then always works on the offer that pays the most Influence: about 5 contracts and 30-45 Influence in 30 minutes.

## Outposts (owner request, 2026-11-17)
The game starts in a tiny outpost, not a town. Outposts are small raw-goods camps: two raw buildings, a short road, a few stone pads, nothing else. They feed raw goods into the empire-wide market for the rest of the game.

- **Outpost 1, Dry Creek Outpost: the start of the game.**
  - Two buildings: a Mining Camp (copper ore) and a Stone Camp (stone, a new raw good). No workshops, no research, no other menus.
  - One tower: the Crossbow, paid with coins plus stone.
  - The road comes in through a dry wash in a gap of a rock ridge (a broken windmill at its mouth), loops once around the camp and leaves the same way. Raiders who finish the loop raid the camp's stockpile, which is the outpost's small vault.
  - About 6 stone pads, inside and outside the loop. No mortar pits: outposts never have a Mortar, so the pit rule does not apply to them.
  - Waves 1 to 10, at least 80 seconds apart unless the player calls them early (a careful player who calls wins it in about 9 minutes, a newcomer in about 13), and wave 10 is a bandit wagon (a small boss). Beating wave 10 wins the outpost and opens Copper Gulch, the first town.
- **Each new town opens one more outpost**, so there are outposts between the towns for the whole game. There is no outpost between Dry Creek and Copper Gulch, and none with the Capital. Each one's two raw goods fit the era it opens in:

| # | Outpost | Opens with | Raw goods | Entrance |
|---|---|---|---|---|
| O1 | Dry Creek Outpost | the start | copper ore, stone | a dry wash through a gap in a rock ridge |
| O2 | Pine Hollow | Iron Ridge | timber, clay (more bricks in the Gulch for the Ridge's boilers) | a logging chute down a wooded slope |
| O3 | Sandy Bend | Silver Falls | sand, quartz | a dry riverbed under a fallen water tower |
| O4 | Tar Seep | Thunder Mesa | crude oil, rubber | a gully under a leaning oil derrick |
| O5 | Glowrock Camp | Radium Springs | bauxite, pitchblende | a cracked rock face that glows faintly |

- **Later outposts** play like Dry Creek but a little bigger: the Crossbow and the Cannon, both paid with coins and the outpost's own first raw good, and waves 1 to 15 with a small boss at 10 and 15. Winning wave 15 is the outpost's goal. The bots set the exact numbers in each town's box.
- **Before it is won**, an outpost out of play plays on like a town (see Background towns under Defense): its waves keep coming once it has a tower, and a loss holds its waves until the player comes back.
- **They stay useful.** Once won, an outpost keeps working in the background. Its raids stop growing (wave-10 strength, one every 2 minutes or so), and the towers it has fight them on their own. A breach there only takes part of its stockpile and never sets its waves back.
  - **Switching** (owner rule, 2026-11-17: the top bar never grows with the number of towns). The top left holds only the place bar: the town's name, a **Map** button once a second town is open (or a town is in sight), and one **back button** named for the last place in play ("< Dry Creek"), so two places are always one tap apart. Every other switch goes through the empire map: tap a town, then Play (or tap it twice). Towns in sight and ready to start live on the map with their Start card. Map carries a red dot when any other place needs you (it lost and holds its waves, raiders broke in while you were elsewhere, or a town is ready to start), and the back button carries one when its place does. A device with no 3D view gets a Places list from Map instead (Go to each town, and each town in sight with its Start sheet). The last place is kept in the save (`game.prev`, save v13; an old save starts with no back button). Until 2026.11.18-2 a row of town buttons sat at the top instead. The outpost's win card has a Go to Copper Gulch button. A town out of play keeps playing (owner rule, 2026-11-17, as in the old game): its wave clock runs and its towers fight (see Background towns under Defense). A won outpost keeps its raids. (Until 2026.11.18 a town out of play waited for the player; the owner found that wrong.)
  - Its goods go first to the town in play: when a town's workshop is short of a raw good an outpost makes, it draws it from the outposts, up to the workshops' 10-second buffer. Then the other towns' workshops draw the same way (so Pine Hollow's clay reaches the Gulch's Kiln while the player is in Iron Ridge). The rest sells on the shared market, so every outpost adds to the empire's supply of raw goods. Its sales and bounties go into the shared purse, so the town in play can spend them at once, and its income shows as its own line when you tap the coins. Out of play it sells at the town in play's prices (that town's research and perks on prices count), as before the purse. (Before the purse, an outpost's sales were paid to the town in play.)
  - Its camp on the empire map (a small camp past its town) takes you there to build and upgrade, and so does the back button once you have been there.
- **Pine Hollow numbers (tuned by the Ridge bots, 2026-11-17).** The Logging Camp (timber, 0.9 a second per level, 12 coins, built at the start) and the Clay Bank (clay, 0.8 a second, 35 coins, opens at Logging Camp level 2). It starts with 150 coins. The Crossbow costs 20 coins and 6 timber, the Cannon 100 coins and 12 timber. Waves 1 to 15, at least 60 seconds apart, the bandit wagon at 10 and 15 (`waves.bosses`). By the time it opens the Gulch floods the market with timber (about 0.02 coins a unit), so Pine Hollow lives on its bounties: its raiders pay three times the usual bounty, and its waves have 70% of the usual health. Won in 12-20 minutes from getting there, by few strong Crossbows and by many cheap ones.
- **Dry Creek numbers (first pass, the bot box tunes them).** The Stone Camp (stone, 0.8 a second per level, 10 coins, built at the start) and the Mining Camp (copper ore, 0.6 a second per level, 30 coins, opens at Stone Camp level 2). The Crossbow costs 20 coins and 6 stone. Raiders ride a little slower than in the Gulch (the road is short). The bandit wagon has half the war wagon's health. Light raids come every 120 seconds, and a breach takes a quarter of each good in the stockpile.
- **Saves.** A save already in Copper Gulch when outposts arrive gets Dry Creek as won and running, with its two buildings at level 5 and two Crossbows.

## Town maps
- **The lane winds through the town.** Every town's road (and river or sky lane) doubles back, even triples back, in switchbacks between the workshops, so raiders pass the same towers several times and the town is something to defend, not a yard off to one side.
- Workshop plots sit beside the lane; tower spots sit in the bends, where one tower covers two or three passes.
- The vault sits at the lane's end, in the heart of the town.
- **Every lane has a real entrance**, never a bare start. Raiders come out of it, hidden until they are clear of it, and a dust plume (or that lane's own sign) rises behind it a few seconds before each wave, bigger for a boss. `tools/audit.js` fails a lane without an entrance model.
  - Copper Gulch: a narrow slot canyon between tall layered rock walls that run off the board, with an old timber mine portal in a rockfall, a collapsed trestle at the mouth and a signpost with a wanted poster.
  - Iron Ridge: a railway tunnel portal through a granite shoulder, rails running out of it, a signal post and a water tank at the mouth. Its line switches back across the town four times (west, east, west, east) with the workshops in three rows between the passes, 12 pads and 4 mortar pits. Silver Falls: boats round a misty river bend under a broken bridge. Thunder Mesa: airships come out of a cloud bank. Radium Springs: out of a glowing fissure.
- **Outpost maps** are smaller: the road enters, loops once around the camp and leaves, past the camp's few pads, with the stockpile (the vault) where the loop closes. They have a real entrance like every lane, and no mortar pits.
- **Mortar pits.** Every town map has 3 to 5 far pads, set well back from the lane and the buildings: outside a normal tower's reach of most of the lane, but with several passes of the lane inside the Mortar's ring. They look different (a ring of sandbags). Only long-range towers (the Mortar) can be built on them, and long-range towers go only there. `tools/audit.js` fails a town without them (outposts are exempt).

## Supply chains
Goods go from raw to intermediate to finished. "<-" marks a good shipped in from another town.

- **Copper Gulch**
  - Raw: timber (Lumber Camp), copper ore (Copper Mine), clay (Clay Pit).
  - Intermediate: planks (Sawmill, 2 timber), copper (Smelter, 2 ore + 1 timber as fuel), bricks (Kiln, 2 clay + 1 timber).
  - Finished: tools (Toolsmith, planks + copper), wagons (Wagon Works, 2 planks + tools + copper).
- **Iron Ridge** (set 2026-11-17, tuned by the Ridge bots)
  - Buildings: Quarry (stone, built at the start), Iron Mine (Quarry 3), Coal Pit (Quarry 5), Blast Furnace (Iron Mine 5 and Coal Pit 3), Steel Mill (Blast Furnace 3, 1200 coins), Boiler Shop (Steel Mill 3, 4000 coins), Rolling Mill (Steel Mill 5), Rolling Mill 3000 coins (was 12K), Locomotive Works (Rolling Mill 5, Boiler Shop 5, 15K coins; was Rolling Mill 10 and 80K, and the bots never reached it in 2.5 hours). The Ridge's goal strip leads through the chain to the Locomotive Works and sends the player to the Gulch for a Toolsmith. The Boiler Shop comes early so the bricks route from the Gulch matters in the Ridge's first hour (it was Steel Mill 5 and 15K, and the bots never reached it).
  - Towers pay with Ridge goods: Crossbow stone, Cannon iron ore, Frost Lens coal and stone, Still iron ore and coal, Mortar pig iron and stone.
  - Research: Steam Drills, Hot Blast, Iron Plating, Rifled Barrels, Railroad Rewards, Freight Depot, and Bessemer Converter (Steel Mill +60%, one more coal per steel: the trade-off). It opens with the Blast Furnace.
  - Raw: iron ore, coal, stone.
  - Intermediate: pig iron (2 iron + coal), steel (pig iron + coal).
  - Finished: rails (2 steel), boilers (steel + 2 bricks <- Gulch), locomotives (boiler + 2 rails + tools <- Gulch).
- **Silver Falls**
  - Raw: sand, quartz. The Water Wheel feeds a power grid; power is not a good.
  - Intermediate: glass (2 sand), wire (copper <- Gulch).
  - Finished: light bulbs (glass + wire), dynamos (wire + steel <- Ridge), telegraphs (2 wire + bulb + rails <- Ridge).
- **Thunder Mesa**
  - Raw: crude oil, bauxite, rubber.
  - Intermediate: fuel, aluminum, tires.
  - Finished: motors (fuel + aluminum + wire <- Falls), automobiles (motor + 4 tires + steel <- Ridge), airships (2 motors + 3 aluminum + dynamo <- Falls).
- **Radium Springs**
  - Raw: pitchblende, helium, and geyser power.
  - Intermediate: radium salts, vacuum tubes (glass + wire <- Falls).
  - Finished: radios (tubes + quartz <- Falls + aluminum <- Mesa), rockets (motor + fuel <- Mesa + radio).
- **The Capital** makes nothing. It posts federal contracts for finished goods from every town.
- **Routes** (set 2026-11-17, M3). A town ships the goods it makes to every later town that imports them, by wagon, automatically: as much as the importing town's workshops are short of (up to their 10-second buffer), from what the maker has above its own workshops' buffer and tower reserve. No coins change hands, since every town spends from the one purse (until the purse in save v12 the importer paid the maker the market price). The maker counts what it sent (`town.sent`). Imported goods are never sold again. Routes go on in every town, in play or not, and the Sell switch does not stop them (it only stops market sales). The building card of a workshop that uses an import says where it comes from, and when it runs short, which building to upgrade in the other town. Decision: no route levels to buy; the choice is how far to grow the Gulch's Kiln and Toolsmith for the Ridge. The empire map draws the wagons.
- **Outposts** make only raw goods (see Outposts). They add supply of goods a town may also make (ore, stone, timber, clay...), and towns draw from them before the market.

**Chain rules** (checked by `tools/audit.js`):
- each step is worth 1.3 to 1.6 times its inputs at base price;
- workshops are balanced at equal levels;
- every imported good has exactly one producing town (outposts do not count, they only add raw supply);
- every town's top good needs at least one import (outposts are exempt, they make only raw goods);
- no town depends on a later town.

## Market
- **Prices.** One empire market. Price = base × saturation × event.
  - Saturation is `rec / (rec + sellRate / depth)`. It recovers over time, and each good shows a depth bar.
  - Selling a spread of goods, and selling higher up the chain, pays best.
- **Booms and busts**: one good at a time, every 3 to 5 minutes.
- **Town orders** have deadlines and build reputation (0 to 100). Rush orders appear from reputation 60.
- **Sell modes per good**: off, always, skip busts, booms only. Every mode keeps what towers and orders need.
- **The tower reserve** (from the first minute): auto-sell never sells a good below what the towers need next, which is the next upgrade of every tower that uses it (the path choice at level 4 is that upgrade), plus the cheapest open tower that uses it with a free pad, and the same for a free mortar pit. Each good has a "Keep for towers" switch, on by default. Building cards and the Goods list say how much is kept; a tower card short of a good says how much there is, about how long it takes, and which building makes it.
- **Federal contracts** at the Capital pay **Influence** plus coins. They are the main Influence source and the reason to ship goods.
- **The Stock Exchange** comes late and is optional. Each town has a share, and prices follow its income and news.
  - A 1% spread means no buy-and-sell loop can earn coins.
  - Holding a majority gives +25% income in that town.

## Defense
- **Towers.** Nine, unlocked by era: crossbow, cannon, frost lens, snake oil still, mortar, tesla coil, gatling, barracks, drone helipad.
  - Each costs coins plus that town's own goods, so the chain feeds the defense. In Copper Gulch (tuned for variety, last on 2026-11-17): the Crossbow takes timber, the Cannon copper ore, the Frost Lens planks and clay, the Snake Oil Still copper ore and planks, the Mortar copper and bricks. So four kinds can be built in the first 7 minutes, before the Smelter, and the Mortar waits for wave 12 and the Smelter and Kiln. Level-1 damage per coin stays within about a third of the Crossbow's, so pricier kinds win where pads run out. A raider carries one dose of poison and one chill at a time, so a second Still or Frost Lens on the same stretch of road adds less than the first.
  - **Each kind has a job** (set 2026-11-17, M2 Tower balance), shown on its card as "Best against": the Crossbow hits Riders twice as hard; the Still's poison is weak on unarmored raiders and 2.2 times as strong on armored ones (Brutes and the wagons), and it grows 15% a level where a hit grows 30%, so one maxed Still can't carry a town; the Mortar hits the wagons 2.5 times as hard and has the widest blast, for packed groups. The Cannon (groups) and the Frost Lens (slows, chips every raider in range) keep their old jobs. No kind may do more than about 35% of the damage for any strategy bot, and every kind must lead some waves for at least one (`tools/balance.js`).
  - Paths open at level 5.
- **The Mortar** is the long-range tower. If a normal tower reaches from 0 to R, the Mortar reaches from 0.5R to 2R: it cannot fire at raiders inside 0.5R (its dead zone).
  - Slow fire. A high, arcing shell with a visible flight time, a marker on the ground where it will land, and splash damage on landing.
  - It lobs, so it cannot hit airships. It can hit boats.
  - Its card and the selection highlight draw both circles, with the dead zone shaded.
  - Paths at level 5: Siege Mortar (a bigger blast, reach 2.4R) or Shrapnel (a smaller blast that leaves burning ground, which slows and hurts for a few seconds).
  - Copper Gulch opens it at wave 12, for coins plus copper and bricks. Later towns pay with their own goods (Iron Ridge: pig iron).
  - In the background battle its damage counts only for the share of the lane inside its ring; Auto-towers treats it like any tower.
- **Waves** come in types (mixed, rush, swarm, heavy), with weather, and a boss every 10th wave.
  - **Boss waves are gates** (owner rule, 2026-11-17: "They should be a gate I can't get past"). A boss wave is beaten only when its boss is killed, in every town and outpost, in play and away. If the boss reaches the vault or stockpile, the wave is lost like a fallen vault: back 2 waves, the purse's share, the vault refills. The next wave number never passes an unbeaten boss. The waves then hold, in play too, so the player decides when to try again: a card says "The war wagon reached your vault. You dropped back to wave 18 and lost 120 coins." and "Your waves are on hold. Build more towers, then tap Resume waves." Call now also tries again at once. A won outpost's light raids bring no boss, so they have no gate (a breach there takes goods, as before).
  - Boss numbers (retuned 2026-11-18 for the gate, by the bots): a boss's health grows slower than its wave's (`bossGrowth` 0.4: the wave-10 health times the wave's growth since wave 10 to the power 0.4), so a careful player who gets ready can stop each one; at the full growth every bot lost the wave-20 war wagon over and over with half its health left. War wagon 12 times a raider's health (was 20), bandit wagon 8 (was 10), armored train 21 (was 26). The bots now get ready for a boss (their towers a level higher while a boss wave is next) and after a loss build a level higher and one tower more, then tap Resume waves after 20 seconds (the newcomer after 45).
  - The wave pace: the next wave comes a short rest after the last one is cleared, and never sooner than a set time after the last one started (Copper Gulch: 7 s and 58 s; Dry Creek: 80 s). Call now starts the next wave at once and pays bonus coins for the time skipped. It is never locked (owner rule, 2026-11-17): it works from the first second of every break, in every town and outpost. What keeps a strong defense from racing far ahead is the wave, not the button: calling in the last 40% of the wait is free, and the share of the wait skipped before that (rush, 0 to 1) brings (1 + 2 x rush) times the wave's raiders, copies of its own in the same order, with one boss still last (Iron Ridge: 1 + 3.5 x rush, `rushMore`). A wave lasts about as long as its raiders take to ride out, so a bigger wave takes longer and racing saves less time. The bonus is half what it was (`RUSH` in `src/core/defense.js`). The first wave and waves beaten before a charter come at normal size however early. Decision (2026-11-17): tougher raiders (up to 2 times the health) were tried first and did not work, because a strong defense killed them just as fast and raced to wave 10 in 6.5 min against 8.7 for economy first. Before this the button was gray until about half the wait was gone (`CALL_OPEN`); the owner found that "dumb".
- **Each lane has its own threats**: boats on the river, airships in the sky (only Tesla and drones reach them), and jamming in Radium Springs.
- **The vault** is each town's health. When it falls, the town drops back 2 waves and the purse loses 10%, but never more than that town earned in about the last 5 minutes (`town.recent`, fading with a 5-minute time constant). Decision (2026-11-17, with the shared purse): a breach in a young town must not wipe out savings the whole empire made, and a busy town still feels it. A won outpost loses goods instead, as before.
- **Background towns** (owner rule, 2026-11-17: "the timer till the next wave stops. That's not how it worked in the previous version"). Every town and outpost keeps playing while the player is not looking at it: out of play, on the empire map, and in time away, closed or in the background.
  - Out of play, its waves run step by step exactly as in play, only not drawn. During time away the first 10 minutes are stepped the same way; after that, in the coarse chunks, each wave is played out on a copy of the town (`waveRun` in `src/core/defense.js`) and its result applied: the bounties of the raiders that fell, the vault hit by those that got through, in order. Decision: a played-out copy instead of the old game's tower-strength formula, so the background battle can never disagree with the battle on screen (a test checks they match). Runs are kept per town and reused when the same wave meets the same towers, so a won outpost's raids cost almost nothing all day.
  - A town with no towers yet waits for the player (decision: a town just opened is never raided before the player has had a look). A won outpost keeps its raids whatever it has.
  - Each town's Hold waves still parks it.
  - **Auto-hold after a loss.** When a town away loses its vault or its boss wave, it pays the loss (back 2 waves, the purse's share), then holds its own waves until the player goes there and taps Resume waves or Call now. So it pays at most once while away, never in a loop. A won outpost never drops back, so it never holds. In the town in play a fallen vault does not hold (the player is watching), but a lost boss does (see Boss waves are gates).
  - It says so: a toast wherever the player is ("The armored train got through in Iron Ridge. Its waves are on hold until you go there."), the Welcome back line after a cold start, a dot on the Map button, and on the map its badge's dot, "On hold" in place of its coins a second, and a line on its card ("Tap Play Copper Gulch, then Resume waves."). Hold waves reads Resume waves while held, and the wave bar says on hold in place of a countdown.
  - Later (M4 Automation): a per-town switch "Keep trying the boss" lets a town drop back and keep playing so Auto-towers can break through.
- **Charters**: a town's deeds depend on its best wave, so defense matters for prestige.

## Progression: three layers
| Layer | Currency | Buys | Reset by |
|---|---|---|---|
| Town | the shared purse (one for the empire) | buildings, towers, town research (6 to 8 items per town), foremen | that town's charter, which pays deeds |
| Empire | Influence, plus coins from the one purse (the treasury and its tithe were dropped with the purse, 2026-11-18) | founding each institution once with coins; its levels are nodes in one Empire tree; laws in pairs, locked until the Convention | the Convention, which pays Legacy |
| Perks | deeds and Legacy | deed perks and Legacy perks, on one Perks screen | never |

### Town research
- Each town has 6 to 8 research items. Each has levels, a coin price that triples per level, and a wait that doubles per level (from 20 s). One item runs at a time. Research keeps going while you are away.
- Research opens in Copper Gulch when the Sawmill is built (about 4 minutes in), with a Research button beside Goods.
- Every bonus is a named source on a stat, so the explain view lists it ("Sharp Saws research").
- Copper Gulch:

| Item | Levels | Each level | Starts at |
|---|---|---|---|
| Sharp Saws | 5 | Lumber Camp and Sawmill +25% | 200 coins |
| Deep Shafts | 5 | Copper Mine and Clay Pit +25% | 400 |
| Thick Walls | 5 | vault +25% | 300 |
| Gunsmith | 5 | towers hit 15% harder | 500 |
| Wanted Posters | 5 | raiders pay 30% more when they fall | 600 |
| Market Stalls | 5 | goods sell for 10% more | 800 |
| Hot Furnaces | 2 | Smelter and Kiln +60%, but they burn one more timber per unit per level (a trade-off) | 1500 |
| Powder Kegs | 3 | Cannon and Mortar blasts 20% wider. Shows up at best wave 26, with a toast, so something new opens between the Mortar and the first charter | 2500 |

### Foremen
- A building you have raised to level 10 by hand can hire a foreman, for 3 times its next level's price.
- A working foreman buys that building's next level whenever it costs half the coins on hand or less, so the other half stays for towers and research. A switch on the building card turns it off.
- Foremen keep working while you are away. The Automation panel (M4) grows Auto-build out of them.

### Charters and deeds
- A town's charter resets that town (buildings, towers, waves, research, foremen, and what it earned toward deeds) and pays deeds. The shared purse is kept (since save v12; before, the town's coins went back to its start coins). It keeps the explainers seen, the badges and the stats.
- Deeds paid (set with the balance bot; last changed 2026-11-17 when the game began in Dry Creek): 1 at best wave 33 and 1 more for every 5 waves past it, plus 1 at 85K coins the town earned itself in this charter and 1 more each time that grows tenfold. Coins an outpost earns count as the outpost's, never toward a town's deeds (before the purse they were paid into the town and filed under `town.fromOutposts`, which deeds still leave out), so a deed measures the town's own work. Earlier marks: wave 30 with 60K, then 52K, then 60K, all before the outpost fed the Gulch; with Dry Creek paying in and drawn on, the Gulch reached those 3-8 minutes sooner. The charter is offered once it would pay at least 1 deed (the active bot: at 37-42 minutes after the Gulch opens, from the coins).
- Deeds are kept for good. Each one adds 25% to the coins earned in every town (sales and bounties), as the named source "Deeds". (10% made a new charter barely faster than the old one.)
- **Old ground.** A signed town remembers its best wave from before (`town.record`). Until it passes that wave again, its towers hit 3 times harder (the named source "Waves you beat before") and Call now works right away, so it races back. The bots showed why: even double income or kept research left the climb back at 45-75% of the first, because the wall near wave 25-30 is a damage wall and the waves come on a clock. Target: back to the old best wave in half the first climb or less (median over the seeds, no seed over two thirds).
- Deed perks come in pairs, and you pick one side of each pair once you hold enough deeds. A pick stays until the next charter, which clears every pick so you choose again (src/data/perks.js):

| Deeds | One side | The other side |
|---|---|---|
| 1 | Boomtown: every building makes 20% more goods | Fort Town: every tower hits 20% harder |
| 2 | Big Guns: tower upgrades cost 30% fewer coins (few strong towers) | Many Hands: new towers cost 40% fewer coins (many cheap towers) |
| 3 | Quick Study: research takes half the time | Hard Bargain: goods sell for 15% more |
| 5 | Bounty Hunters: raiders drop 50% more coins | Stone Walls: the vault takes 50% more hits |
- The Perks button appears at the first charter offer. Its sheet shows the deeds the charter would pay now, the best wave and coins earned with the next deed's mark for each, what signing takes away, the deeds held and the pairs. Sign the charter and Pick each need a second tap.

- **Institutions**: Market Board, Department of Transport, Bank, University, Stock Exchange, War Office. Each has its own branch in the Empire tree.
- **Names** are never reused across institutions, tabs, branches, laws or sliders. `tools/audit.js` fails two goods, buildings, towns, tower kinds, paths, raiders, research items or perks with one name.
- **Laws** come in three pairs:
  - Free Market vs Planned Economy;
  - Militia vs Standing Army;
  - Open Borders vs Protectionism.
- **Multipliers.** Every one is a named source in `src/core/mods.js`, with a published cap per stat. The "explain" view lists each part. `tools/audit.js` fails a perk, research item or core rule that puts a bonus on a stat with no cap.
- **The Convention** resets every town, the Capital, Influence, the tree, laws and shares. It keeps perks, badges and stats, and pays Legacy (×1.25 each).
  - Legacy perks open towns early, found the Capital pre-built, and give a starting Influence pot.
  - A second life must reach the first life's peak in under 30% of the time.

## Automation
One panel, with three switches per town and one spend share per town. The share is capped at 100% of that town's income, and its formula is shown in words.
- **Auto-build**: buildings with a hired foreman. Foremen are hired per building in the town. They save toward the best payback, including ×2 milestones and feeding a starved workshop's supplier.
- **Auto-towers**: unlocked when the War Office is founded. Slow: one upgrade per town every few minutes, faster with War Office nodes.
- **Auto-research**: unlocked when the University is founded.
- **Before the Capital**, research is always a manual choice, which teaches it.

## Empire map
- Zoom out from any town, or use the Empire tab, to see the Capital in the center with town dioramas around it.
- Routes are splines with moving wagons, and later trains, at a speed and count that scale with the route's rate.
- Each town has badges for income, wave, vault and alerts, which pulse when it needs you.
- Tapping a town opens its card; double-tapping, or Play, flies in.
- Locked towns show as surveyed land with their unlock rule.
- **As built (M3, 2026-11-17).**
  - Getting there: a **Map** side button, shown once a second town is open (and only with the 3D view), or zooming a town past its farthest view (a pinch that keeps closing, or three wheel turns out). Decision: a button named Map, not a tab. Since 2026.11.18-2 it sits in the place bar at the top left, next to the town's name and the back button, and it is the one way to every other place.
  - The map (`src/render/empire-view.js`, layout in `src/data/empire.js`): open desert, taller than wide so a phone sees all of it (a wide screen turns it on its side). The Capital's site is in the middle as surveyed land ("Coming later" until M4), the towns ring it and each outpost sits out past its town. Every open town is a diorama of its own board at 0.58 scale: the town's ground, its road, every built building at its tier, its vault or stockpile and its towers, merged into a few meshes and rebuilt when a tier or a tower changes. A town not open yet is surveyed land: stakes, string and a sign.
  - Routes (`mapRoutes` in `src/core/map.js`): a dirt road appears for each link that has carried goods, town to town (`shipped`) and outpost to town (`drawn`), bowing out away from the Capital's site. Wagons on it come from `wagonsFor(rate)`: none while nothing moves, then one more for each doubling of the goods a second (up to 6), rolling faster as the route gets busier. Rates come from `FlowMeter`, which samples coins and goods by simulated time every 2 seconds, so time caught up after being away counts at its real pace.
  - Badges (`siteInfo`): the town's short name, its wave (Won for a won outpost), a vault bar and its coins a second; the town in play has a gold frame. A pulsing dot means it needs you: it lost and holds its waves, raiders broke in while you were elsewhere (until you go there), its vault or stockpile is under half, or a workshop is short of goods. These dots used to sit on the town buttons at the top. Surveyed land shows its next rule ("Wave 20 in Iron Ridge", "15K coins", "Opens with Iron Ridge") or Ready to start with a dot.
  - Tapping a town (or its badge) opens its card with a pulsing gold ring round it on the map, and the camera slides it clear of the card: wave, vault, coins a second, what it makes, what it sends and gets by route, and a warning line for an alert, with Play (or Back to, for the town in play). Tapping it again quickly flies in too. A card for land not open yet lists its rules with have / need and, once they are met, Start. Tapping the coins lists what each town earns.
  - Flying: Play eases the map's camera down onto the town, then the town opens with its camera diving from high above to its home view. Opening the map from a town starts low over that town and rises to the whole map.
  - The game keeps running on the map (the town in play goes on as if the player were watching it). The map has Pause and Back to the town in play; Pause carries over both ways.
  - Checks: `test/map.test.js`, a `map` run in `tools/smoke.js` at every size, `map` screens in `tools/shots.js`, and `node tools/perf.js --town map`.

## Onboarding
- **Tutorial**: spotlight steps through the first 30 minutes. It starts in Dry Creek Outpost, the smallest map (one camp, one tower, one loop), and carries on into Copper Gulch.
  - **The goal strip** (`src/data/goals.js`): one short order at a time under Pause and Hold waves, with a pulsing gold frame on the pad, building tag or button it means. Dry Creek: build a Crossbow, the Stone Camp to 2, the Mining Camp, 3 Crossbows, an upgrade, Call now (the next wave early), the Mining Camp to 5, a path, beat wave 10, go to Copper Gulch. Copper Gulch: a Crossbow, the Lumber Camp to 3, the Copper Mine, a Cannon, the Lumber Camp to 5, the Sawmill, a research, the Clay Pit, a Frost Lens, the Copper Mine to 5, the Smelter, a path, the war wagon, a Mortar.
  - A goal counts the first time it is true, in any order, and a goal that can't be done yet is passed over. Finished goals stay finished in the save. A finished goal shows Done for a moment, then the next one comes in. When a town's goals are all done the strip goes away.
  - The careful bot finishes them all by about 25 minutes into a new game; `tools/balance.js` fails if any goal takes longer than 40 minutes.
- **Coach cards** appear once each, when a system unlocks.
- **Tabs appear one by one:**
  - Town at the start (Dry Creek);
  - Map and the back button at the top when Copper Gulch opens, to switch between Dry Creek and the Gulch;
  - Goods once the town makes two goods (or once the player has met it in another town);
  - Research at about 5 minutes;
  - Perks at the first charter offer;
  - Empire when Iron Ridge is close.
- **Alerts**: a blinking dot on a button when something there wants the player (a new good, research that can start, a perk to pick or more deeds, a town raided while away, an update), and toasts that show one at a time.

## Pacing targets (proved by the bots)
| Milestone | Target |
|---|---|
| First tower (in Dry Creek) | under 1 min |
| Dry Creek won, Copper Gulch opens | 8-12 min active (calls waves early), within 20 min for the newcomer bot, which must be at least 20% slower |
| Copper Gulch wave 10 | 7-9 min after the Gulch opens (active, calls waves early), within 14 min for the newcomer bot, which must be at least 20% slower |
| First charter offered | 35-45 min after the Gulch opens (about 45-60 min of play) |
| Back to the old best wave after the first charter | half the first climb or less (median), no seed over two thirds |
| Something new between minute 23 and the first charter offer | Powder Kegs research (best wave 26) |
| Iron Ridge founded | 55-80 min of play active (signs the Gulch charter first, then holds the waves to save), under 2 h 15 min for the newcomer bot |
| Pine Hollow won | within 20 min of getting there, every strategy within 25% |
| Iron Ridge wave 10 (the armored train) | 7-10 min after getting there, no breach in waves 1-3 (waves 66 s apart, and a called wave grows faster than in the Gulch, since the shared purse arms it at once) |
| Boiler Shop | built in the Ridge's first hour, running on Gulch bricks at least 90% of the time |
| Locomotive Works | built within 90 min of getting to the Ridge (the bots 40-54 min), running on Gulch tools at least 90% of the time (the goal strip leads there, and sends the player to the Gulch for a Toolsmith) |
| Capital | 2.5-4 h of play (active bot, every seed) |
| Silver Falls | 6-10 h with 1 or 2 charters, at least 2.5× longer with none |
| Thunder Mesa | 20-30 h |
| Radium Springs | 50-80 h |
| First Convention worth it (4 or more Legacy) | 80-120 h |
| Second life back to the first life's peak | under 30% of the time |
| Longest stretch with nothing to do in the first hour | under 3 min (newcomer bot) |

Skill pays. Waves come on a clock, and Call now lets a strong defense beat it. The active bot (and every strategy bot) calls the next wave once the last one's time, scaled up by how much bigger the called wave would be (1 + 2 x rush in the Gulch), is within 45% of the wave pace, nothing got through in the last two waves and the vault is above 60%, and never calls a boss wave early. The newcomer bot never calls on its own, only once when the goal strip asks. `tools/firstplay.js` (slow taps, 30% wrong buys, only the buttons that are out) must win Dry Creek and reach the Gulch's wave 10 within the newcomer limits, and its median times must be at least 20% slower than the active bot's on both.

**Saving for a town.** Founding a town is the one big purchase the player saves toward. Once the Gulch has beaten wave 20, the goal strip says "Tap Hold waves and save 15K coins for Iron Ridge", then "Tap Map, Iron Ridge, then Start Iron Ridge". The careful bots (`tools/balance.js`, `empire`) sign the Gulch's first charter when it pays a deed, climb back, and once the price is no more than 6 minutes of the Gulch's income they hold the waves, switch the foremen off and buy only buildings that pay back within 2 minutes until they can found it (about 6-10 minutes held). Then they win Pine Hollow and play the Ridge for an hour, raising the Gulch's Kiln (or what feeds it) when the Ridge runs short of bricks. The newcomer bot (`tools/firstplay.js`) follows the strip: it holds the waves when the strip says so and taps Start; it never signs a charter, so it gets there sooner (about 49-58 min). Decision: a player who skips the charter reaches the Ridge first, and one who signs it gets the deeds; both are fine.

## Look and sound
- **Models.** Low-poly 3D built in code, on vendored three.js.
  - One model file per town.
  - Each builder returns `{obj, movers, smoke, lights}` per tier, merged into one vertex-colored mesh per model, so several dioramas fit a phone's budget.
  - Every building, tower kind and raider has its own model; `tools/audit.js` fails one that would fall back to a stand-in.
- **Lighting.** Warm desert light, soft shadows, a day and night cycle, bloom on lamps and fires, and color grading.
- **Camera framing.** The home view fits the town's frame into the part of the screen the top bar leaves free, close enough that every stone pad is at least 32 px across (on a short landscape or a narrow phone the ends of the town are a pan away). A wide screen looks along the town's length from a lower angle. An entrance's walls sink to a third of their height when the camera looks across or into them, so they never hide the road or a pad. While a card covers the selected thing, the camera slides it into the free part, and slides back when the card closes unless the player moved the map. A short landscape screen puts the town name, the wave and Pause on one row with the goal under them. `tools/smoke.js` checks the pad size and the selection at every size.
- **Interface.** Crisp, flat pixel UI with hard 2px borders and pixel bevels. No glossy gradients or glass. Menu icons are rendered from the 3D models.
- **Sound.** Procedural Western music (WebAudio, no files) and synthesized sound effects (`src/audio/`).
  - Four tunes, written bar by bar from a seed so they never loop the same way: a lonesome whistle on the title; a calm build theme (boom-chick guitar, hooves on a wood block) between waves and on the empire map; a faster galloping tune while raiders are on the road; and a driving fiddle tune for a whole boss wave. A new tune starts on the next bar.
  - Effects: a hammer knock for every building, tower and upgrade; a shot sound per tower kind (crossbow twang, cannon boom, frost ping, still bubble, mortar thump and its shell landing); a coin blip for each bounty; a low horn when a boss wave starts; a thud when a raider gets through. Only the town in play makes sound, never catch-up, and a burst is thinned to at most 14 effects a second.
  - Music and Sound sliders in the Menu, kept under `cg-audio` (defaults 50% and 60%; 0 is Off). Sound starts on the first tap or key (browser rules) and the app in the background suspends it.
