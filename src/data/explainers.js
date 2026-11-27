/* Explainers: the short cards that teach each feature the first time it appears, with a spotlight on the thing.
   Text follows the owner's writing rule (PLAN.md): plain short sentences, name the real button, say what happens.
   Each is shown once and remembered in the save. Every feature of the game must be covered by one: tools/audit.js
   works out the features from the game itself (each system, tower kind and goods tier, and the named mechanics
   below) and fails when any has no explainer.
     covers: the feature ids it teaches.     when(h): true once it should show; h reads the town (src/ui/coach.js).
     at(h): what to spotlight: { plot }, { spot }, { tower }, { vault: true } or { el: css selector }; or nothing.
     town: show it only while this town is in play.   go, button: a second button that takes the player to that town.
     say(h): the text with what is on screen in it, such as a button's name (text stays the plain form the audit reads). */
import { TOWNS } from './towns/index.js';
import { ARMS } from './arms.js';
import { GOODS } from './goods.js';
import { BUILDINGS } from './buildings.js';
import { BOOM } from '../core/market.js';
export const EXPLAINERS = [
  // Dry Creek Outpost, where a new game starts
  {
    id: 'dc-welcome', town: 'drycreek', now: 1, covers: ['welcome:drycreek', 'system:goals'],
    title: 'Welcome to Dry Creek',
    text: 'Raiders are on their way to this camp. Hold them off for 10 waves and Copper Gulch opens. Do what the Goal at the top says.',
    when: () => true, at: () => ({ el: '#goal' }),
  },
  {
    id: 'dc-stone', town: 'drycreek', now: true, covers: ['system:economy', 'tier:0'],
    title: 'The Stone Camp',
    text: 'This is your Stone Camp. It cuts stone. Tap it to upgrade it. Every level cuts more. Crossbows here are built with stone.',
    // once wave 1 is called, when the goal asks for its upgrade (clarity fix 7: it came a second after the welcome)
    when: h => h.towers.length >= 1 && (h.phase === 'wave' || h.bestWave >= 1), at: () => ({ plot: 'quarry' }),
  },
  {
    id: 'dc-stockpile', town: 'drycreek', now: true, covers: ['stockpile'],
    title: 'The stockpile',
    text: 'Raiders ride for this pile of goods. Each one that gets there damages it. If it falls, you lose some coins and go back two waves.',
    // when the first raiders are on the road (clarity fix 7)
    when: h => h.t > 12 && !h.won && (h.phase === 'wave' || h.bestWave >= 1), at: () => ({ vault: true }),
  },
  {
    id: 'dc-mine', town: 'drycreek', now: true, covers: ['building:dmine'],
    title: 'The Copper Camp',
    text: 'You can build a Copper Camp now. It digs copper ore, which sells for more than stone. Tap it to build it.',
    when: h => h.unlocked('dmine'), at: () => ({ plot: 'dmine' }),
  },
  {
    id: 'dc-boss', town: 'drycreek', now: true, covers: ['boss:bandits'],
    title: 'The bandit wagon',
    text: 'Wave 10 brings the bandit wagon. It is tougher than other raiders. At half health two horsemen ride off it. Stop the wagon and Dry Creek is yours.',
    when: h => h.wave >= 9 && !h.won, at: () => ({ el: '#wave' }),
  },
  {
    id: 'dc-won', town: 'drycreek', now: true, covers: ['outpost:won'], go: 'gulch', button: 'Play Copper Gulch',
    title: 'Copper Gulch is open',
    text: 'You beat wave 10 at Dry Creek. Tap Play Copper Gulch to start building there. Small raids keep coming to Dry Creek, and its Crossbows hold them off.',
    when: h => h.won,
  },
  // any town: the raider card (owner, 2026-11-22), the first time a raider out on the road carries an effect, or from wave 4
  {
    id: 'foe-tap', covers: ['foecard'],
    title: 'Tap a raider',
    text: 'Tap any raider on the road to see its health and armor, and what your towers did to it, like poison or frost.',
    when: h => !!h.foeOut && (h.foeOut.fx || h.wave >= 4), at: h => (h.foeOut ? { foe: h.foeOut.id } : null),
  },
  // any town: the workers' card, the first time workers are out on the road (roadmap review 2026.11.22-9)
  {
    id: 'worker-tap', now: true, covers: ['workercard'],
    title: 'Your workers',
    text: 'Your workers are fighting by the road. Their buildings make nothing while they are out. Tap a pair of workers to see their time left.',
    when: h => !!h.workerOut, at: h => (h.workerOut ? { worker: h.workerOut } : null),
  },
  // any town: the boss bar (owner, 2026-11-22), the first time a boss is on the road
  {
    id: 'boss-bar', now: true, covers: ['bossbar'],
    // it names the town's own boss, the name on the bar (clarity fix 8i: "The boss bar" and "boss" were words no other screen used)
    title: 'The war wagon',
    head: h => (h.boss ? 'The ' + h.boss : null),
    text: 'The war wagon changes when it is badly hurt. Tap its bar at the top to see what your towers did to it.',
    say: h => (h.boss ? 'The ' + h.boss + ' changes when it is badly hurt. Tap its bar at the top to see what your towers did to it.' : null),
    when: h => h.bossUp, at: () => ({ el: '#bossBar' }),
  },
  // Copper Gulch
  {
    id: 'welcome', town: 'gulch', now: 1, covers: ['welcome:gulch'],
    title: 'Welcome to Copper Gulch',
    text: 'This is your Lumber Camp. It cuts timber. Tap it to upgrade it. Every level cuts more.',
    when: () => true, at: () => ({ plot: 'camp' }),
  },
  {
    id: 'camera', covers: ['camera'],
    title: 'Moving around',
    text: 'Drag to move the map. Pinch to zoom. Twist two fingers to turn it.',
    // Dry Creek fits on the screen, so it waits for the Gulch's bigger map (clarity fix 7)
    when: h => h.t > 4 && (h.towns >= 2 || h.t > 480),
  },
  {
    id: 'towers', now: true, covers: ['system:defense', 'tower:crossbow'],
    title: 'Raiders are coming',
    text: 'They ride down the road to rob you. Tap a stone pad and build a Crossbow. A pad between two bends of the road can shoot at both.',
    when: h => h.t > 8 && !h.towers.length, at: () => ({ spot: 0 }),
  },
  // selling and the Goods button in one card, since both said how to keep a good (clarity fix 7)
  {
    id: 'goods', covers: ['system:market', 'goods'],
    title: 'Selling',
    text: 'Spare goods sell right after they are made. When you sell a lot of one, its price drops for a while. Tap Goods to see prices, or to stop selling one.',
    when: h => !!h.tabs.goods, at: () => ({ el: '#goodsBtn' }),
  },
  {
    id: 'strip', covers: ['strip'],
    title: 'Your goods',
    text: 'Towers cost goods as well as coins. Tap a good at the bottom to see its price.',
    when: h => !!h.tabs.strip && h.towers.length >= 1, at: () => ({ el: '#goodsStrip' }),
  },
  {
    id: 'reserve', covers: ['reserve'],
    title: 'Saved for towers',
    text: 'Your town keeps goods for the next upgrades of every tower and for new towers. Kept goods are never sold or used by other buildings. To sell all of a good, tap its building and switch Save for towers off.',
    // the switch on the card names its good (clarity fix 8a: one name, Save for towers, was on two different controls)
    say: h => { const b = BUILDINGS[h.keptPlot], g = b && GOODS[b.makes]; return g ? 'Your town keeps goods for the next upgrades of every tower and for new towers. Kept goods are never sold or used by other buildings. To sell all of your ' + g.name.toLowerCase() + ', tap the ' + b.name + ' and switch Save ' + g.name.toLowerCase() + ' for towers off.' : null; },
    when: h => h.towers.length > 0 && h.keptPlot !== null && h.t > 45, at: h => ({ plot: h.keptPlot }),
  },
  {
    id: 'stock', covers: ['stock'],
    title: 'Goods for towers',
    text: 'Tap Lots to save goods for 4 upgrades of every tower, not 2. Building towers waits less, but you sell fewer goods.',
    when: h => h.stockOpen && h.towers.length > 0, at: () => ({ el: '#stockTowers' }),
  },
  {
    id: 'waves', now: 1, covers: ['call'],
    title: 'Waves',
    text: 'Raiders come in waves. Each raider that gets through lowers the number by the heart. Tap Call now to bring the next wave early. The sooner you call, the more raiders come and the more bonus coins you get.',
    when: h => h.towers.length > 0 || h.phase === 'wave', at: () => ({ el: '#wave' }),
  },
  {
    id: 'pause', covers: ['pause'],
    title: 'Pause',
    text: 'Pause stops everything. The game also pauses itself when you leave the app.',
    when: h => h.towers.length > 0 && h.t > 40, at: () => ({ el: '#pauseBtn' }),
  },
  {
    id: 'hold', covers: ['hold'],
    title: 'Hold waves',
    text: 'Hold waves stops new waves from coming. The wave on the road still finishes, and your town keeps working. Tap it again when you\'re ready.',
    when: h => h.bestWave >= 1 && h.phase === 'break', at: () => ({ el: '#holdWaves' }),
  },
  {
    id: 'menu', covers: ['menu', 'slots', 'export'],
    title: 'Menu',
    text: 'Tap Menu to change the graphics, start a new game in another save slot, or copy your save to keep it safe.',
    when: h => h.towers.length > 0 && h.t > 150 && h.towns >= 2, at: () => ({ el: '#menuBtn' }),
  },
  {
    id: 'vault', town: 'gulch', now: true, covers: ['vault', 'breach'],
    title: 'Your vault took a hit',
    // the Vault sheet's own words, gets in and hits left, and the spotlight on the heart ties it to the vault (clarity
    // fix 8g: "The heart at the top counts the hits the vault can still take" read as a manual)
    text: 'Raiders that get in take hits off your vault. At 0 hits left you lose coins and go back two waves. Each wave you beat mends it a little.',
    // the spotlight on the vault it names, slid above the card when off screen, so the card sits low and leaves the top
    // bar and its heart in view (review of 2026.11.23-11: on a phone the card lay over the top bar; clarity fix 8l: the
    // box lay on the heart while the vault itself was under the card)
    when: h => h.vault.hp < h.vault.max || h.breaches > 0, at: () => ({ vault: true }),
  },
  {
    id: 'milestone', covers: ['milestone', 'upgrade'],
    title: 'Milestones',
    text: 'At levels 10, 25, 50 and 100, a building makes twice as much.',
    // when the first level 10 is one level away (clarity fix 7: it came at minute 4 with levels at 6)
    when: h => h.anyLevel >= 9, at: h => ({ plot: h.topBuilding }),
  },
  {
    id: 'workshop', now: true, covers: ['tier:1'],
    title: 'The Sawmill',
    text: 'The Sawmill turns timber into planks, which sell for more. Upgrade the Lumber Camp along with it so it never runs out of timber.',
    when: h => h.unlocked('saw'), at: () => ({ plot: 'saw' }),
  },
  {
    id: 'research', covers: ['system:research'],
    title: 'Research',
    text: 'Tap Research to make your saws, mines and towers better. Each item costs coins and takes some time. Each town researches its own list, one at a time.',
    when: h => !!h.flags['open:research'], at: () => ({ el: '#researchBtn' }),
  },
  {
    id: 'foremen', covers: ['system:foremen'],
    title: 'Foremen',
    text: "Tap Hire foreman on this building's card. The foreman buys the next level for you whenever you have twice its price.",
    when: h => h.foremanPlot !== null, at: h => ({ plot: h.foremanPlot }),
  },
  {
    id: 'short', now: true, covers: ['starved'],
    title: 'Out of materials',
    // the pill's red line as it looks now (clarity fix 8r: "red edge on a tag" was the old big tag's look)
    text: 'A red line under a building level means it ran out of what it needs. Tap the building to see what it is missing.',
    when: h => !!h.starved, at: h => ({ plot: h.starved }),
  },
  {
    id: 'cannon', now: true, covers: ['tower:cannon'],
    title: 'Cannon',
    text: 'Your Copper Mine digs ore, so you can build a Cannon. Tap a stone pad to build one. It\'s slow, but each shot also hits the raiders around the one it aims at.',
    when: h => h.can('cannon') && (h.made.ore || 0) > 0, at: () => ({ spot: 1 }),
  },
  {
    id: 'frost', now: true, covers: ['tower:frost'],
    title: 'Frost Lens',
    text: 'You can build a Frost Lens now. Tap a stone pad to build one. It slows every raider in range, so your other towers get more shots.',
    when: h => h.can('frost') && (h.made.planks || 0) > 0 && (h.made.clay || 0) > 0, at: () => ({ spot: 4 }),
  },
  {
    id: 'still', now: true, covers: ['tower:still'],
    title: 'Snake Oil Still',
    text: 'You can build a Snake Oil Still now. Tap a stone pad to build one. Its poison hurts brutes and bosses most. From level 10 it also eats half their armor, so your other towers hit them harder.',
    when: h => h.can('still') && (h.made.ore || 0) > 0 && (h.made.planks || 0) > 0, at: () => ({ spot: 2 }),
  },
  {
    id: 'finished', now: true, covers: ['tier:2'],
    title: 'Tools',
    text: 'The Toolsmith makes tools, which sell for much more than the planks and copper that go in.',
    when: h => h.unlocked('toolsmith'), at: () => ({ plot: 'toolsmith' }),
  },
  {
    id: 'paths', now: true, covers: ['path'],
    title: 'Choose an upgrade',
    text: 'At level 5 this tower turns into one of two kinds. Tap it and pick the one you want. The choice is for good.',
    when: h => h.towerAtLevel(4) !== null, at: h => ({ tower: h.towerAtLevel(4) }),
  },
  {
    id: 'fork', now: true, covers: ['fork'],
    title: 'Still at level 20',
    text: 'The next upgrade for this Still is a choice of two. Slow Rot poisons raiders until they fall. Last Call hits raiders low on health much harder. Tap the Still to pick.',
    when: h => h.forkReady !== null, at: h => ({ tower: h.forkReady }),
  },
  {
    id: 'fork-cannon', now: true, covers: ['fork:cannon'],
    title: 'Cannon at level 20',
    text: 'The next upgrade for this Cannon is a choice of two. Rocket Battery fires 4 rockets at once and reaches far. Big Shell fires one huge shot. Tap the Cannon to pick.',
    when: h => h.forkCannon != null, at: h => ({ tower: h.forkCannon }),
  },
  {
    id: 'fork-crossbow', now: true, covers: ['fork:crossbow'],
    title: 'Crossbow at level 20',
    text: 'The next upgrade for this Crossbow is a choice of two. Piercing Bolts go through up to 3 raiders. Sharpshooter aims at the toughest raider and hits much harder. Tap the Crossbow to pick.',
    when: h => h.forkCrossbow != null, at: h => ({ tower: h.forkCrossbow }),
  },
  {
    id: 'fork-frost', now: true, covers: ['fork:frost'],
    title: 'Frost Lens at level 20',
    text: 'The next upgrade for this Frost Lens is a choice of two. Blizzard reaches much farther. Cold Snap slows raiders much more. Tap the Frost Lens to pick.',
    when: h => h.forkFrost != null, at: h => ({ tower: h.forkFrost }),
  },
  {
    id: 'boss', town: 'gulch', now: true, covers: ['boss'],
    title: 'The war wagon',
    text: 'Every 10th wave brings the war wagon. It is slow and heavily armored. At half health its crew jumps off and runs for the vault. If the wagon gets there, the wave is lost.',
    when: h => h.wave % 10 === 0 && h.phase === 'wave', at: () => ({ el: '#wave' }),
  },
  {
    id: 'charter', covers: ['system:charter'],
    title: 'Your charter',
    text: 'Tap Perks, then Sign the charter. Your town starts over at wave 1, but your coins stay. You get deeds you keep forever. Each deed gives you more coins.',
    when: h => h.offered && !h.outpost, at: () => ({ el: '#perksBtn' }),
  },
  {
    id: 'perks', covers: ['perks', 'deeds'],
    title: 'Pick a perk',
    text: 'Tap Perks and pick one of two perks. More deeds open more perks. Each time you sign the charter, you pick again.',
    when: h => h.toPick > 0 && !h.outpost, at: () => ({ el: '#perksBtn' }),
  },
  {
    id: 'numbers', covers: ['explain'],
    title: 'Tap to see why',
    text: 'Tap your coins at the top to see what earns them. Tap Damage, Range or another line on a card to see what adds to it.',
    when: h => h.flags.firstSale && h.towers.length > 0 && h.t > 150 && h.towns >= 2, at: () => ({ el: '#coins' }),
  },
  {
    id: 'dots', covers: ['dots'],
    title: 'Red dots',
    text: 'A red dot on a button means something new is waiting there. Tap the button to see it.',
    when: h => !!(h.dots.goods || h.dots.research || h.dots.perks || Object.keys(h.dots.towns).length), at: () => ({ el: '.play .btn.dot' }),
  },
  {
    id: 'back', covers: ['back'],
    title: 'Jump back',
    text: 'Tap ◂ to go to the place you played last.',
    // the button as it reads, "◂ Dry Creek" (review 2026-11-19)
    say: h => (TOWNS[h.back] ? 'Tap ◂ ' + (TOWNS[h.back].short || TOWNS[h.back].name) + ' to play there again.' : null), // the name once (review of 2026.11.20-10)
    when: h => !!h.back && h.t > 8, at: () => ({ el: '#backBtn' }),
  },
  {
    id: 'away', covers: ['away'],
    title: 'Your towns keep fighting',
    text: 'Your other towns keep fighting while you are here. Tap Map to check on them. If raiders beat a town, its waves stop until you go back.',
    when: h => h.awayFighting && h.t > 5, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'lost', now: true, covers: ['lost'],
    title: 'Waves on hold',
    text: 'Raiders beat this town while you were away, so its waves are on hold. Build or upgrade towers. Then tap Resume waves.',
    when: h => h.autoHold && h.phase === 'break', at: () => ({ el: '#holdWaves' }),
  },
  {
    id: 'map', covers: ['map'],
    title: 'The map',
    text: 'Tap Map to see all your towns. Tap a town there, then tap Play to go to it. A red dot on Map means a town needs you. Under each town you see if it is fighting, waiting for a wave, or on hold.',
    when: h => h.towns > 1 && !h.outpost && h.t > 30, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'outposts', town: 'gulch', covers: ['system:outpost'],
    title: 'Dry Creek keeps working',
    text: 'Raiders still come to Dry Creek while you are here. Its Crossbows fight them off. Its stone and ore still sell, and you can spend those coins here.',
    when: h => h.outpostWon && !h.outpost && h.t > 50, at: () => ({ el: '#coins' }),
  },
  {
    id: 'draw', town: 'gulch', covers: ['outpost:draw'],
    title: 'Ore from Dry Creek',
    text: 'Your Smelter now takes copper ore from Dry Creek before it runs short.',
    when: h => h.drew && h.t > 30, at: () => ({ plot: 'smelter' }),
  },
  {
    // it covers the pits too: their own card showed at wave 4, 8 waves before a Mortar could stand there (clarity fix 4)
    id: 'mortar', now: true, covers: ['tower:mortar', 'pit'],
    title: 'The Mortar is open',
    text: 'Tap a mortar pit, the ring of sandbags far from the road, and build a Mortar. Its shells blast a whole group of raiders far away. A dark spot shows where each one will land. It can\'t hit raiders close to it.',
    when: h => !!h.flags['open:mortar'] && h.firstPit !== null, at: h => ({ spot: h.firstPit }),
  },
  {
    id: 'best', town: 'gulch', covers: ['best'],
    title: 'Best against',
    text: 'Each tower hits some raiders harder. Crossbows are best against horsemen. The Still is best against brutes and bosses.',
    when: h => h.wave >= 6 && h.phase === 'wave' && Object.keys(h.kinds).length > 1, at: h => ({ spot: h.kinds.still ?? h.kinds.crossbow ?? Object.values(h.kinds)[0] }),
  },
  {
    id: 'oldground', covers: ['oldground'],
    title: 'Towers hit harder on old waves',
    text: 'You beat these waves before you signed. Until you pass your old best wave, your towers hit 3 times harder and Call now works right away.',
    when: h => h.oldGround && h.phase === 'break' && h.towers.length > 0, at: () => ({ el: '#callWave' }),
  },
  // Iron Ridge and Pine Hollow
  {
    id: 'found', now: true, covers: ['found'],
    title: 'A new town',
    text: 'Iron Ridge is in sight. Tap Map, then tap Iron Ridge to see what it takes to start it.',
    when: h => h.next.includes('ridge'), at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'capital-sight', covers: ['capital:sight'],
    title: 'The Capital',
    text: 'The Capital is on the map now. Tap Map, then tap Capital to see what it needs.',
    when: h => h.capitalSight, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'capital', covers: ['system:capital', 'contract'],
    title: 'Contracts',
    text: 'The Capital wants goods from your towns. Tap Map, then Capital, and take a contract. The town on the contract sends the goods by itself. A finished contract pays coins and Influence.',
    when: h => h.capitalOpen && h.t > 3, at: () => ({ el: '#mapBtn' }),
  },
  // the contract kinds that open as the Capital fills contracts (src/data/capital.js, kinds)
  {
    id: 'contract-rush', covers: ['contract:rush'],
    title: 'Rush contracts',
    text: 'The Capital now posts rush contracts. They are small and pay extra Influence. Each has a clock. If it runs out, the goods you sent are lost.',
    when: h => !!h.contractKinds.rush, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'contract-big', covers: ['contract:big'],
    title: 'Big contracts',
    text: 'The Capital now posts big contracts. They ask for many more goods and take up to 20 minutes.',
    when: h => !!h.contractKinds.big, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'tree', covers: ['system:tree', 'institution'],
    title: 'Capital buildings',
    text: 'Tap Map, then Capital, then Buildings. Build one with coins. Its upgrades cost Influence and help every town.',
    when: h => h.treeReady, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'automation', covers: ['system:automation'],
    title: 'Automation',
    text: 'Tap Auto. This town can upgrade its towers and run its research on its own. It only buys what you bought before, and it never spends more than half your coins.',
    when: h => !!h.tabs.auto && h.t > 2, at: () => ({ el: '#autoBtn' }),
  },
  {
    id: 'arms', covers: ['system:arms'],
    title: 'To arms',
    text: 'Tap To arms when raiders are about to break through. Your workers fight on the road for ' + ARMS.seconds + ' sec, and the buildings make nothing until they come back. Then you wait ' + ARMS.cooldown / 60 + ' min to call them again.',
    when: h => !!h.tabs.arms && h.t > 2, at: () => ({ el: '#armsBtn' }),
  },
  {
    // the first boom or bust on a good this town shows on its strip (src/core/market.js, GDD.md Market)
    id: 'boom', covers: ['boom'],
    title: 'Booms and busts',
    text: 'Right now one good sells for more than usual. A price that jumps up is a boom, and one that drops is a bust. Each lasts ' + BOOM.last + ' sec. Tap the good below, then Sell spare, to pick when it sells.',
    say: h => { const g = GOODS[h.boom.good].name, up = h.boom.f > 1; return 'The price of ' + g.toLowerCase() + (up ? ' is up right now.' : ' is down right now.') + ' A price that jumps up is a boom, and one that drops is a bust. Each lasts ' + BOOM.last + ' sec. Tap ' + g + ' below, then Sell spare, to pick when it sells.'; }, // the price is, so a plural good reads right (clarity fix 8a: "Boilers sells for less")
    when: h => !!h.boom && h.boomChip && h.t > 2, at: h => ({ el: '#goodsStrip [data-good="' + h.boom.good + '"]' }),
  },
  {
    // town orders open here (src/core/orders.js, GDD.md Market)
    id: 'orders', covers: ['system:orders'],
    title: 'Town orders',
    text: 'Buyers in this town want goods by a set time. Tap Goods, then Take on an order. Your town sends the goods by itself. Fill it in time to get coins and reputation. More reputation brings rush orders, which pay more. Miss one and your reputation drops.',
    when: h => !!h.ordersOpen && !!h.tabs.goods && h.t > 2, at: () => ({ el: '#goodsBtn' }),
  },
  {
    id: 'crowd', covers: ['crowd'],
    title: 'More towers cost more',
    text: 'Each new tower here costs more than the one before. Upgrades cost the same as always.',
    say: h => 'You have ' + h.towerCount + ' towers here. Each new tower costs more than the one before. Upgrades cost the same as always.',
    when: h => h.crowded && h.t > 2,
  },
  {
    id: 'auto-research', covers: ['auto-research'],
    title: 'Auto-research',
    text: 'The University is built. Tap Auto and turn on Auto-research. It starts the next research by itself. Tap Research in any town to see what is running.',
    when: h => h.autoResearch && !!h.tabs.auto && !!h.tabs.research && h.t > 2, at: () => ({ el: '#autoBtn' }),
  },
  {
    id: 'retry', now: true, covers: ['retry'],
    title: 'Try again',
    text: 'Tap Auto and turn on Try the boss again. After a boss gets through or the vault falls, this town plays the wave before it again and again. Once a tower goes up a level, it tries again.',
    say: h => 'Tap Auto and turn on Fight the ' + h.boss + ' again. After the ' + h.boss + ' gets through or the vault falls, this town plays the wave before it again and again. Once a tower goes up a level, it tries again.', // the town's own boss, as the switch names it (review of 2026.11.20-8)
    when: h => h.bossLost && !!h.tabs.auto && h.phase === 'break', at: () => ({ el: '#autoBtn' }),
  },
  {
    id: 'ridge-welcome', town: 'ridge', now: 1, covers: ['welcome:ridge'],
    title: 'Welcome to Iron Ridge',
    text: 'Raiders come out of the railway tunnel and ride past every row of buildings. Start with the Quarry. Crossbows here are built with stone.',
    when: () => true, at: () => ({ plot: 'rquarry' }),
  },
  {
    id: 'ridge-route', town: 'ridge', covers: ['route'],
    title: 'Goods from Copper Gulch',
    text: 'The Boiler Shop uses bricks and the Locomotive Works uses tools. Copper Gulch sends them by wagon. Upgrade the Kiln and the Toolsmith there to send more.',
    when: h => h.level('boilershop') > 0 || h.level('loco') > 0, at: h => ({ plot: h.level('boilershop') > 0 ? 'boilershop' : 'loco' }),
  },
  {
    id: 'ridge-boss', town: 'ridge', now: true, covers: ['boss:train'],
    title: 'The armored train',
    text: 'Wave 10 brings the armored train. Its plates stop part of every hit. At half health they fall off and the train goes faster. Mortars and the Still hurt it most.',
    when: h => h.wave >= 9, at: () => ({ el: '#wave' }),
  },
  {
    id: 'ph-welcome', town: 'pinehollow', now: 1, covers: ['welcome:pinehollow'],
    title: 'Welcome to Pine Hollow',
    text: 'Hold this logging camp for 15 waves. Its timber and clay go to your towns, so the Gulch can make more bricks for Iron Ridge.',
    when: () => true, at: () => ({ plot: 'logcamp' }),
  },
  // Silver Falls and Sandy Bend
  {
    id: 'found-falls', covers: ['found:falls'],
    title: 'Silver Falls',
    text: 'Silver Falls is in sight. Tap Map, then tap the new town to see what it takes. It needs 5 deeds. Each charter you sign gives you deeds.',
    when: h => h.next.includes('falls'), at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'falls-welcome', town: 'falls', now: 1, covers: ['welcome:falls', 'river'],
    title: 'Welcome to Silver Falls',
    text: 'Raiders ride the road, and boats come down the river. Build towers by the water too. Start with the Sand Pit. Crossbows here are built with sand.',
    when: () => true, at: () => ({ plot: 'sandpit' }),
  },
  {
    id: 'falls-power', town: 'falls', covers: ['power'],
    title: 'Power',
    text: 'The Water Wheel makes power for the buildings here that need it. When they need more than it makes, they all slow down. Tap it and upgrade it to keep up.',
    when: h => h.level('glassworks') > 0, at: () => ({ plot: 'waterwheel' }),
  },
  {
    id: 'falls-boss', town: 'falls', now: true, covers: ['boss:steamer'],
    title: 'The ironclad steamer',
    text: 'Wave 10 brings an ironclad steamer down the river. Its plates stop part of every hit. When it is nearly beaten it lets off steam and goes faster. Mortars and the Still hurt it most.',
    when: h => h.wave >= 9, at: () => ({ el: '#wave' }),
  },
  // Thunder Mesa (PLAN.md M6b, part 1a)
  {
    id: 'found-mesa', covers: ['found:mesa'],
    title: 'Thunder Mesa',
    text: 'Thunder Mesa is in sight. Tap Map, then tap the new town to see what it takes. It needs 12 deeds and 3 Rail Office upgrades at the Capital.',
    when: h => h.next.includes('mesa'), at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'mesa-welcome', town: 'mesa', now: 1, covers: ['welcome:mesa'],
    title: 'Welcome to Thunder Mesa',
    text: 'This town pumps oil and builds motors and airships. Start with the Oil Derrick. Crossbows here are built with crude oil.',
    when: () => true, at: () => ({ plot: 'derrick' }),
  },
  {
    id: 'tesla', town: 'mesa', now: true, covers: ['tower:tesla'],
    title: 'The Tesla Coil',
    text: 'You can build a Tesla Coil now. Tap a stone pad. Its spark hits up to 3 raiders close together. It is the only tower that can hit airships.',
    when: h => !!h.flags['open:tesla'], at: h => ({ spot: h.freePad ?? Object.values(h.kinds)[0] ?? 0 }),
  },
  {
    id: 'sb-welcome', town: 'sandybend', now: 1, covers: ['welcome:sandybend'],
    title: 'Welcome to Sandy Bend',
    text: 'Hold this camp for 15 waves. Its sand and quartz go to your towns.',
    when: () => true, at: () => ({ plot: 'sandwash' }),
  },
];
