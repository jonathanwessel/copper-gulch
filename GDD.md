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
| 1 | Copper Gulch | Frontier: wood, clay, copper | road | War wagon | at the start |
| 2 | Iron Ridge | Iron and rail | switchback road | Armored train | Gulch wave 20 + 150K, first life, no charter needed |
| C | The Capital | Government | none | none | Ridge wave 15 + 2M |
| 3 | Silver Falls | Electricity | road + river | Ironclad steamer | Ridge wave 25 + **5 deeds** + 50M (realistically 1 or 2 charters) |
| 4 | Thunder Mesa | Oil and flight | road + sky | Sky pirate airship | Transport node 3 + 1B |
| 5 | Radium Springs | Radio and radium | road + sky + a static field that jams towers | Iron Colossus (a steam walker) | Mesa wave 30 + University node 4 + 50B |

The Empire map shows the 5-deed gate for Silver Falls in plain words: "sign 1 or 2 charters". Without the deed bonus, its coin price is out of reach.

## Town maps
- **The lane winds through the town.** Every town's road (and river or sky lane) doubles back, even triples back, in switchbacks between the workshops, so raiders pass the same towers several times and the town is something to defend, not a yard off to one side.
- Workshop plots sit beside the lane; tower spots sit in the bends, where one tower covers two or three passes.
- The vault sits at the lane's end, in the heart of the town.

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

**Chain rules** (checked by `tools/audit.js`):
- each step is worth 1.3 to 1.6 times its inputs at base price;
- workshops are balanced at equal levels;
- every imported good has exactly one producing town;
- every town's top good needs at least one import;
- no town depends on a later town.

## Market
- **Prices.** One empire market. Price = base × saturation × event.
  - Saturation is `rec / (rec + sellRate / depth)`. It recovers over time, and each good shows a depth bar.
  - Selling a spread of goods, and selling higher up the chain, pays best.
- **Booms and busts**: one good at a time, every 3 to 5 minutes.
- **Town orders** have deadlines and build reputation (0 to 100). Rush orders appear from reputation 60.
- **Sell modes per good**: off, always, skip busts, booms only. Every mode keeps what towers and orders need.
- **Federal contracts** at the Capital pay **Influence** plus coins. They are the main Influence source and the reason to ship goods.
- **The Stock Exchange** comes late and is optional. Each town has a share, and prices follow its income and news.
  - A 1% spread means no buy-and-sell loop can earn coins.
  - Holding a majority gives +25% income in that town.

## Defense
- **Towers.** Eight, unlocked by era: crossbow, cannon, frost lens, snake oil still, tesla coil, gatling, barracks, drone helipad.
  - Each costs coins plus that town's own goods, so the chain feeds the defense.
  - Paths open at level 5.
- **Waves** come in types (mixed, rush, swarm, heavy), with weather, and a boss every 10th wave.
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
- **Tutorial**: spotlight steps through the first 30 minutes.
- **Coach cards** appear once each, when a system unlocks.
- **Tabs appear one by one:**
  - Town at the start;
  - Market at the first sale;
  - Research at about 5 minutes;
  - Perks at the first charter offer;
  - Empire when Iron Ridge is close.
- **Alerts**: tab dots, a town chip on the map, and throttled toasts.

## Pacing targets (proved by the bots)
| Milestone | Target |
|---|---|
| First tower | under 1 min |
| Wave 10 | 7-9 min active (balance bot), 10-14 min for the newcomer bot |
| First charter offered | about 40 min |
| Iron Ridge | 45-70 min active, under 2 h for the newcomer bot |
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
