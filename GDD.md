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
| 2 | Iron Ridge | Iron and rail | switchback road | Armored train | Gulch wave 20 + 150K, first life, no charter needed |
| C | The Capital | Government | none | none | Ridge wave 15 + 2M |
| 3 | Silver Falls | Electricity | road + river | Ironclad steamer | Ridge wave 25 + **5 deeds** + 50M (realistically 1 or 2 charters) |
| 4 | Thunder Mesa | Oil and flight | road + sky | Sky pirate airship | Transport node 3 + 1B |
| 5 | Radium Springs | Radio and radium | road + sky + a static field that jams towers | Iron Colossus (a steam walker) | Mesa wave 30 + University node 4 + 50B |

The Empire map shows the 5-deed gate for Silver Falls in plain words: "sign 1 or 2 charters". Without the deed bonus, its coin price is out of reach.

## Outposts (owner request, 2026-11-17)
The game starts in a tiny outpost, not a town. Outposts are small raw-goods camps: two raw buildings, a short road, a few stone pads, nothing else. They feed raw goods into the empire-wide market for the rest of the game.

- **Outpost 1, Dry Creek Outpost: the start of the game.**
  - Two buildings: a Mining Camp (copper ore) and a Stone Camp (stone, a new raw good). No workshops, no research, no other menus.
  - One tower: the Crossbow, paid with coins plus stone.
  - The road comes in through a dry wash in a gap of a rock ridge (a broken windmill at its mouth), loops once around the camp and leaves the same way. Raiders who finish the loop raid the camp's stockpile, which is the outpost's small vault.
  - About 6 stone pads, inside and outside the loop. No mortar pits: outposts never have a Mortar, so the pit rule does not apply to them.
  - Waves 1 to 10, and wave 10 is a bandit wagon (a small boss). Beating wave 10 wins the outpost and opens Copper Gulch, the first town.
- **Each new town opens one more outpost**, so there are outposts between the towns for the whole game. There is no outpost between Dry Creek and Copper Gulch, and none with the Capital. Each one's two raw goods fit the era it opens in:

| # | Outpost | Opens with | Raw goods | Entrance |
|---|---|---|---|---|
| O1 | Dry Creek Outpost | the start | copper ore, stone | a dry wash through a gap in a rock ridge |
| O2 | Pine Hollow | Iron Ridge | timber, clay (more bricks in the Gulch for the Ridge's boilers) | a logging chute down a wooded slope |
| O3 | Sandy Bend | Silver Falls | sand, quartz | a dry riverbed under a fallen water tower |
| O4 | Tar Seep | Thunder Mesa | crude oil, rubber | a gully under a leaning oil derrick |
| O5 | Glowrock Camp | Radium Springs | bauxite, pitchblende | a cracked rock face that glows faintly |

- **Later outposts** play like Dry Creek but a little bigger: the Crossbow and the Cannon, both paid with coins and the outpost's own first raw good, and waves 1 to 15 with a small boss at 10 and 15. Winning wave 15 is the outpost's goal. The bots set the exact numbers in each town's box.
- **They stay useful.** Once won, an outpost keeps working in the background. Its raids stop growing (wave-10 strength, one every 2 minutes or so), and the towers it has fight them on their own. A breach there only takes part of its stockpile and never sets its waves back.
  - **Switching.** Once a second town is open, a row of town buttons sits at the top of the screen (Dry Creek, Copper Gulch); tapping one puts that town in play. The outpost's win card has a Go to Copper Gulch button. A town out of play (not an outpost) waits for the player: the wave on its road finishes, but the clock to its next wave stops until the player comes back, so nothing breaks while they are away. A won outpost keeps its raids. The empire map in M3 grows out of the town buttons.
  - Its goods go first to the town in play: when a town's workshop is short of a raw good an outpost makes, it draws it from the outposts, up to the workshops' 10-second buffer. The rest sells on the shared market, so every outpost adds to the empire's supply of raw goods. While an outpost is out of play, the coins from its sales go to the town in play (it keeps only the bounties its towers earn), so the town feels it at once.
  - Its town chip (and later its camp on the empire map, a small camp around the edge) takes you there to build and upgrade.
- **Dry Creek numbers (first pass, the bot box tunes them).** The Stone Camp (stone, 0.8 a second per level, 10 coins, built at the start) and the Mining Camp (copper ore, 0.6 a second per level, 30 coins, opens at Stone Camp level 2). The Crossbow costs 20 coins and 6 stone. Raiders ride a little slower than in the Gulch (the road is short). The bandit wagon has half the war wagon's health. Light raids come every 120 seconds, and a breach takes a quarter of each good in the stockpile.
- **Saves.** A save already in Copper Gulch when outposts arrive gets Dry Creek as won and running, with its two buildings at level 5 and two Crossbows.

## Town maps
- **The lane winds through the town.** Every town's road (and river or sky lane) doubles back, even triples back, in switchbacks between the workshops, so raiders pass the same towers several times and the town is something to defend, not a yard off to one side.
- Workshop plots sit beside the lane; tower spots sit in the bends, where one tower covers two or three passes.
- The vault sits at the lane's end, in the heart of the town.
- **Every lane has a real entrance**, never a bare start. Raiders come out of it, hidden until they are clear of it, and a dust plume (or that lane's own sign) rises behind it a few seconds before each wave, bigger for a boss. `tools/audit.js` fails a lane without an entrance model.
  - Copper Gulch: a narrow slot canyon between tall layered rock walls that run off the board, with an old timber mine portal in a rockfall, a collapsed trestle at the mouth and a signpost with a wanted poster.
  - Iron Ridge: a railway tunnel portal through the mountain. Silver Falls: boats round a misty river bend under a broken bridge. Thunder Mesa: airships come out of a cloud bank. Radium Springs: out of a glowing fissure.
- **Outpost maps** are smaller: the road enters, loops once around the camp and leaves, past the camp's few pads, with the stockpile (the vault) where the loop closes. They have a real entrance like every lane, and no mortar pits.
- **Mortar pits.** Every town map has 3 to 5 far pads, set well back from the lane and the buildings: outside a normal tower's reach of most of the lane, but with several passes of the lane inside the Mortar's ring. They look different (a ring of sandbags). Only long-range towers (the Mortar) can be built on them, and long-range towers go only there. `tools/audit.js` fails a town without them (outposts are exempt).

## Supply chains
Goods go from raw to intermediate to finished. "<-" marks a good shipped in from another town.

- **Copper Gulch**
  - Raw: timber (Lumber Camp), copper ore (Copper Mine), clay (Clay Pit).
  - Intermediate: planks (Sawmill, 2 timber), copper (Smelter, 2 ore + 1 timber as fuel), bricks (Kiln, 2 clay + 1 timber).
  - Finished: tools (Toolsmith, planks + copper), wagons (Wagon Works, 2 planks + tools + copper).
- **Iron Ridge**
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
  - Paths open at level 5.
- **The Mortar** is the long-range tower. If a normal tower reaches from 0 to R, the Mortar reaches from 0.5R to 2R: it cannot fire at raiders inside 0.5R (its dead zone).
  - Slow fire. A high, arcing shell with a visible flight time, a marker on the ground where it will land, and splash damage on landing.
  - It lobs, so it cannot hit airships. It can hit boats.
  - Its card and the selection highlight draw both circles, with the dead zone shaded.
  - Paths at level 5: Siege Mortar (a bigger blast, reach 2.4R) or Shrapnel (a smaller blast that leaves burning ground, which slows and hurts for a few seconds).
  - Copper Gulch opens it at wave 12, for coins plus copper and bricks. Later towns pay with their own goods (Iron Ridge: pig iron).
  - In the background battle its damage counts only for the share of the lane inside its ring; Auto-towers treats it like any tower.
- **Waves** come in types (mixed, rush, swarm, heavy), with weather, and a boss every 10th wave.
  - The wave pace: the next wave comes a short rest after the last one is cleared, and never sooner than a set time after the last one started (Copper Gulch: 7 s and 40 s). A strong defense does not race through the waves, and Call now skips the wait for bonus coins.
- **Each lane has its own threats**: boats on the river, airships in the sky (only Tesla and drones reach them), and jamming in Radium Springs.
- **The vault** is each town's health. When it falls, the town loses 10% of its coins and drops back 2 waves.
- **Background towns** fight through an analytic battle based on their tower strength. A fallen vault, or a town looping at its boss gate, raises an alert.
- **Charters**: a town's deeds depend on its best wave, so defense matters for prestige.

## Progression: three layers
| Layer | Currency | Buys | Reset by |
|---|---|---|---|
| Town | that town's coins | buildings, towers, town research (6 to 8 items per town), foremen | that town's charter, which pays deeds |
| Empire | Influence, plus treasury coins (a 10% tithe on every town, set by law) | founding each institution once with coins; its levels are nodes in one Empire tree; laws in pairs, locked until the Convention | the Convention, which pays Legacy |
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

### Foremen
- A building you have raised to level 10 by hand can hire a foreman, for 3 times its next level's price.
- A working foreman buys that building's next level whenever it costs half the coins on hand or less, so the other half stays for towers and research. A switch on the building card turns it off.
- Foremen keep working while you are away. The Automation panel (M4) grows Auto-build out of them.

### Charters and deeds
- A town's charter resets that town (coins, buildings, towers, waves, research, foremen) and pays deeds. It keeps the explainers seen, the badges and the stats.
- Deeds paid (set by the charter box with the balance bot, 2026-11-17): 1 at best wave 30 and 1 more for every 5 waves past it, plus 1 at 52K coins earned in this charter (60K until 2026-11-17, lowered when tower prices dropped) and 1 more each time that grows tenfold. The charter is offered once it would pay at least 1 deed (the active bot: at 40-44 minutes, from the coins).
- Deeds are kept for good. Each one adds 25% to the coins earned in every town (sales and bounties), as the named source "Deeds". (10% made a new charter barely faster than the old one.)
- Deed perks come in pairs, and you pick one side of each pair once you hold enough deeds. A pick stays until the next charter, which clears every pick so you choose again (src/data/perks.js):

| Deeds | One side | The other side |
|---|---|---|
| 1 | Boomtown: every building makes 20% more goods | Fort Town: every tower hits 20% harder |
| 2 | Big Guns: tower upgrades cost 30% fewer coins (few strong towers) | Many Hands: new towers cost 40% fewer coins (many cheap towers) |
| 3 | Quick Study: research takes half the time | Hard Bargain: goods sell for 15% more |
| 5 | Bounty Hunters: raiders drop 50% more coins | Stone Walls: the vault takes 50% more hits |
- The Perks button appears at the first charter offer. Its sheet shows the deeds the charter would pay now, the best wave and coins earned with the next deed's mark for each, what signing takes away, the deeds held and the pairs. Sign the charter and Pick each need a second tap.

- **Institutions**: Market Board, Department of Transport, Bank, University, Stock Exchange, War Office. Each has its own branch in the Empire tree.
- **Names** are never reused across institutions, tabs, branches, laws or sliders.
- **Laws** come in three pairs:
  - Free Market vs Planned Economy;
  - Militia vs Standing Army;
  - Open Borders vs Protectionism.
- **Multipliers.** Every one is a named source in `src/core/mods.js`, with a published cap per stat. The "explain" view lists each part.
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

## Onboarding
- **Tutorial**: spotlight steps through the first 30 minutes. It starts in Dry Creek Outpost, the smallest map (one camp, one tower, one loop), and carries on into Copper Gulch.
- **Coach cards** appear once each, when a system unlocks.
- **Tabs appear one by one:**
  - Town at the start (Dry Creek);
  - a town chip at the top when Copper Gulch opens, to switch between Dry Creek and the Gulch;
  - Market at the first sale;
  - Research at about 5 minutes;
  - Perks at the first charter offer;
  - Empire when Iron Ridge is close.
- **Alerts**: tab dots, a town chip on the map, and throttled toasts.

## Pacing targets (proved by the bots)
| Milestone | Target |
|---|---|
| First tower (in Dry Creek) | under 1 min |
| Dry Creek won, Copper Gulch opens | 10-15 min active, 15-20 min for the newcomer bot |
| Copper Gulch wave 10 | 7-9 min after the Gulch opens (balance bot), 10-14 min for the newcomer bot |
| First charter offered | 35-45 min after the Gulch opens (about 45-60 min of play) |
| Iron Ridge | 55-80 min active, under 2 h 15 min for the newcomer bot |
| Capital | 2.5-4 h |
| Silver Falls | 6-10 h with 1 or 2 charters, at least 2.5× longer with none |
| Thunder Mesa | 20-30 h |
| Radium Springs | 50-80 h |
| First Convention worth it (4 or more Legacy) | 80-120 h |
| Second life back to the first life's peak | under 30% of the time |
| Longest stretch with nothing to do in the first hour | under 3 min |

## Look and sound
- **Models.** Low-poly 3D built in code, on vendored three.js.
  - One model file per town.
  - Each builder returns `{obj, movers, smoke, lights}` per tier, merged into one vertex-colored mesh per model, so several dioramas fit a phone's budget.
- **Lighting.** Warm desert light, soft shadows, a day and night cycle, bloom on lamps and fires, and color grading.
- **Interface.** Crisp, flat pixel UI with hard 2px borders and pixel bevels. No glossy gradients or glass. Menu icons are rendered from the 3D models.
- **Sound.** Procedural Western music (WebAudio, no files) and synthesized sound effects.
