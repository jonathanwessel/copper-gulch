/* Explainers: the short cards that teach each feature the first time it appears, with a spotlight on the thing.
   Text follows the owner's writing rule (PLAN.md): plain short sentences, name the real button, say what happens.
   Each is shown once and remembered in the save. Every feature of the game must be covered by one: tools/audit.js
   works out the features from the game itself (each system, tower kind and goods tier, and the named mechanics
   below) and fails when any has no explainer.
     covers: the feature ids it teaches.     when(h): true once it should show; h reads the town (src/ui/coach.js).
     at(h): what to spotlight: { plot }, { spot }, { tower }, { vault: true } or { el: css selector }; or nothing.
     town: show it only while this town is in play.   go, button: a second button that takes the player to that town. */
export const EXPLAINERS = [
  // Dry Creek Outpost, where a new game starts
  {
    id: 'dc-welcome', town: 'drycreek', covers: ['welcome:drycreek', 'system:goals'],
    title: 'Welcome to Dry Creek',
    text: 'Raiders are on their way to this camp. Hold them off for 10 waves and Copper Gulch opens. Start with the goal shown here.',
    when: () => true, at: () => ({ el: '#goal' }),
  },
  {
    id: 'dc-stone', town: 'drycreek', covers: ['system:economy', 'tier:0'],
    title: 'The Stone Camp',
    text: 'This is your Stone Camp. It cuts stone. Tap it to upgrade it. Every level cuts more. Crossbows here are built with stone.',
    when: () => true, at: () => ({ plot: 'quarry' }),
  },
  {
    id: 'dc-stockpile', town: 'drycreek', covers: ['stockpile'],
    title: 'The stockpile',
    text: 'Raiders ride for this pile of goods. Each one that gets there damages it. If it breaks, you lose some coins and go back two waves.',
    when: h => h.t > 12 && !h.won, at: () => ({ vault: true }),
  },
  {
    id: 'dc-mine', town: 'drycreek', covers: ['building:dmine'],
    title: 'The Mining Camp',
    text: 'You can build a Mining Camp now. It digs copper ore, which sells for more than stone. Tap it to build it.',
    when: h => h.unlocked('dmine'), at: () => ({ plot: 'dmine' }),
  },
  {
    id: 'dc-boss', town: 'drycreek', covers: ['boss:bandits'],
    title: 'The bandit wagon',
    text: 'Wave 10 brings the bandit wagon. It is tougher than other raiders. Stop it and Dry Creek is yours.',
    when: h => h.wave >= 9 && !h.won, at: () => ({ el: '#wave' }),
  },
  {
    id: 'dc-won', town: 'drycreek', covers: ['outpost:won'], go: 'gulch', button: 'Go to Copper Gulch',
    title: 'Copper Gulch is open',
    text: 'You beat wave 10 at Dry Creek. Copper Gulch has more buildings and towers. Dry Creek keeps making coins while you are away.',
    when: h => h.won,
  },
  // Copper Gulch
  {
    id: 'welcome', town: 'gulch', covers: ['welcome:gulch'],
    title: 'Welcome to Copper Gulch',
    text: 'This is your Lumber Camp. It cuts timber. Tap it to upgrade it. Every level cuts more.',
    when: () => true, at: () => ({ plot: 'camp' }),
  },
  {
    id: 'camera', covers: ['camera'],
    title: 'Moving around',
    text: 'Drag to move the map. Pinch to zoom. Twist two fingers to turn it.',
    when: h => h.t > 4,
  },
  {
    id: 'towers', covers: ['system:defense', 'tower:crossbow'],
    title: 'Raiders are coming',
    text: 'They follow the road to your vault. Tap a stone pad and build a Crossbow. A pad between two bends of the road can shoot at both.',
    when: h => h.t > 8 && !h.towers.length, at: () => ({ spot: 0 }),
  },
  {
    id: 'market', covers: ['system:market'],
    title: 'Selling',
    text: 'Everything you make is sold right away. Sell too much of one good and its price drops for a while, so making several goods earns more. To keep a good instead, tap its building and switch Sell to Off.',
    when: h => h.flags.firstSale && h.t > 20, at: () => ({ el: '#coins' }),
  },
  {
    id: 'goods', covers: ['goods'],
    title: 'Goods',
    text: 'Tap Goods to see what your town has in stock and what each good sells for right now. Tap Sell next to a good to keep it instead of selling it.',
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
    text: "Your town saves goods for every tower's next upgrade and one new tower. To sell everything a building makes, tap it and switch Keep for towers off.",
    when: h => h.towers.length > 0 && h.keptPlot !== null && h.t > 45, at: h => ({ plot: h.keptPlot }),
  },
  {
    id: 'waves', covers: ['call'],
    title: 'Waves',
    text: 'Raiders come in waves. The green bar is your vault. It drops when a raider gets through. Tap Call now to start the next wave early and get bonus coins. Tap it right away and the wave has more raiders.',
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
    when: h => h.towers.length > 0 && h.t > 150, at: () => ({ el: '#menuBtn' }),
  },
  {
    id: 'vault', town: 'gulch', covers: ['vault', 'breach'],
    title: 'Your vault took a hit',
    text: 'Every raider that gets through damages the vault. If it breaks, you lose some coins and go back two waves. Build more towers or upgrade the ones you have.',
    when: h => h.vault.hp < h.vault.max || h.breaches > 0, at: () => ({ vault: true }),
  },
  {
    id: 'milestone', covers: ['milestone', 'upgrade'],
    title: 'Milestones',
    text: 'At levels 10, 25, 50 and 100, a building makes twice as much. Tap Makes on its card to see how the number adds up.',
    when: h => h.anyLevel >= 6, at: h => ({ plot: h.topBuilding }),
  },
  {
    id: 'workshop', covers: ['tier:1'],
    title: 'The Sawmill',
    text: 'The Sawmill turns timber into planks, which sell for more. Upgrade the Lumber Camp along with it so it never runs out of timber.',
    when: h => h.unlocked('saw'), at: () => ({ plot: 'saw' }),
  },
  {
    id: 'research', covers: ['system:research'],
    title: 'Research',
    text: 'Tap Research to make your saws, mines and towers better. Each item costs coins and takes some time. Only one can work at a time.',
    when: h => !!h.flags['open:research'], at: () => ({ el: '#researchBtn' }),
  },
  {
    id: 'foremen', covers: ['system:foremen'],
    title: 'Foremen',
    text: "Tap Hire foreman on this building's card. The foreman buys the next level for you whenever you have twice its price.",
    when: h => h.foremanPlot !== null, at: h => ({ plot: h.foremanPlot }),
  },
  {
    id: 'short', covers: ['starved'],
    title: 'Out of materials',
    text: 'A red edge on a building\'s tag means it ran out of what it needs. Upgrade the building that supplies it.',
    when: h => !!h.starved, at: h => ({ plot: h.starved }),
  },
  {
    id: 'cannon', covers: ['tower:cannon'],
    title: 'Cannon',
    text: 'Your Copper Mine digs ore, so you can build a Cannon. Tap a stone pad to build one. It\'s slow, but each shot hits a whole group of raiders.',
    when: h => h.can('cannon') && (h.made.ore || 0) > 0, at: () => ({ spot: 1 }),
  },
  {
    id: 'frost', covers: ['tower:frost'],
    title: 'Frost Lens',
    text: 'You can build a Frost Lens now. Tap a stone pad to build one. It slows every raider in range, so your other towers get more shots.',
    when: h => h.can('frost') && (h.made.planks || 0) > 0 && (h.made.clay || 0) > 0, at: () => ({ spot: 4 }),
  },
  {
    id: 'still', covers: ['tower:still'],
    title: 'Snake Oil Still',
    text: 'You can build a Snake Oil Still now. Tap a stone pad to build one. Its poison is best against Brutes and war wagons.',
    when: h => h.can('still') && (h.made.ore || 0) > 0 && (h.made.planks || 0) > 0, at: () => ({ spot: 2 }),
  },
  {
    id: 'finished', covers: ['tier:2'],
    title: 'Tools',
    text: 'The Toolsmith makes tools, which sell for much more than the planks and copper that go in.',
    when: h => h.unlocked('toolsmith'), at: () => ({ plot: 'toolsmith' }),
  },
  {
    id: 'paths', covers: ['path'],
    title: 'Choose an upgrade',
    text: 'At level 5 this tower turns into one of two kinds. Tap it and pick the one you want. The choice is for good.',
    when: h => h.towerAtLevel(4) !== null, at: h => ({ tower: h.towerAtLevel(4) }),
  },
  {
    id: 'boss', town: 'gulch', covers: ['boss'],
    title: 'The war wagon',
    text: 'Every 10th wave brings the war wagon. It\'s slow and heavily armored. If it reaches the vault, it does a lot of damage.',
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
    id: 'pit', covers: ['pit'],
    title: 'Mortar pit',
    text: 'This spot is too far from the road for most towers. A Mortar fits here. It fires over long distances but can\'t hit raiders close to it. You can build one here at wave 12.',
    when: h => h.bestWave >= 4 && h.phase === 'break' && h.firstPit !== null, at: h => ({ spot: h.firstPit }),
  },
  {
    id: 'numbers', covers: ['explain'],
    title: 'Tap to see why',
    text: 'Tap your coins at the top to see what earns them. Tap Damage, Range or another line on a card to see what adds to it.',
    when: h => h.flags.firstSale && h.towers.length > 0 && h.t > 150, at: () => ({ el: '#coins' }),
  },
  {
    id: 'dots', covers: ['dots'],
    title: 'Red dots',
    text: 'A red dot on a button means something new is waiting there. Tap the button to see it.',
    when: h => !!(h.dots.goods || h.dots.research || h.dots.perks || Object.keys(h.dots.towns).length), at: () => ({ el: '.play .btn.dot' }),
  },
  {
    id: 'back', covers: ['back'],
    title: 'Go back',
    text: 'Tap the arrow button next to Map to go to the town you played last. Tap the same button there to come back.',
    when: h => !!h.back && h.t > 8, at: () => ({ el: '#backBtn' }),
  },
  {
    id: 'away', covers: ['away'],
    title: 'Your towns keep fighting',
    text: 'Your other towns keep fighting while you are here. Tap Map to check on them. If raiders beat a town, its waves stop until you go back.',
    when: h => h.awayFighting && h.t > 5, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'lost', covers: ['lost'],
    title: 'Waves on hold',
    text: 'Raiders beat this town while you were away, so its waves are on hold. Build or upgrade towers. Then tap Resume waves.',
    when: h => h.autoHold && h.phase === 'break', at: () => ({ el: '#holdWaves' }),
  },
  {
    id: 'map', covers: ['map'],
    title: 'The map',
    text: 'Tap Map to see all your towns. Tap a town there, then tap Play to go to it. A red dot on Map means a town needs you.',
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
    id: 'mortar', covers: ['tower:mortar'],
    title: 'The Mortar is open',
    text: 'Tap a mortar pit, the ring of sandbags far from the road, and build a Mortar. Its shells blast a whole group of raiders far away. It can\'t hit raiders close to it.',
    when: h => !!h.flags['open:mortar'] && h.firstPit !== null, at: h => ({ spot: h.firstPit }),
  },
  {
    id: 'best', town: 'gulch', covers: ['best'],
    title: 'Best against',
    text: 'Each tower hits some raiders harder. Crossbows are best against Riders. The Still is best against Brutes. Tap a tower to see what it is best against.',
    when: h => h.wave >= 6 && h.phase === 'wave' && Object.keys(h.kinds).length > 1, at: h => ({ spot: h.kinds.still ?? h.kinds.crossbow ?? Object.values(h.kinds)[0] }),
  },
  {
    id: 'oldground', covers: ['oldground'],
    title: 'Bonus on waves you beat before',
    text: 'You beat these waves before you signed. Until you pass your old best wave, your towers hit 3 times harder and Call now works right away.',
    when: h => h.oldGround && h.phase === 'break' && h.towers.length > 0, at: () => ({ el: '#callWave' }),
  },
  // Iron Ridge and Pine Hollow
  {
    id: 'found', covers: ['found'],
    title: 'A new town',
    text: 'Iron Ridge is in sight. Tap Map, then tap Iron Ridge to see what it takes to start it.',
    when: h => h.next.includes('ridge'), at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'capital-sight', covers: ['capital:sight'],
    title: 'The Capital',
    text: 'You can build the Capital soon. Tap Map, then tap Capital to see what it needs.',
    when: h => h.capitalSight, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'capital', covers: ['system:capital', 'contract'],
    title: 'Contracts',
    text: 'The Capital wants goods from your towns. Tap Map, then Capital, and take a contract. The town on the contract sends the goods by itself. A finished contract pays coins and Influence.',
    when: h => h.capitalOpen && h.t > 3, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'tree', covers: ['system:tree', 'institution'],
    title: 'Institutions',
    text: 'Tap Map, then Capital, then Institutions. Build one with coins. Its upgrades cost Influence and help every town.',
    when: h => h.treeReady, at: () => ({ el: '#mapBtn' }),
  },
  {
    id: 'ridge-welcome', town: 'ridge', covers: ['welcome:ridge'],
    title: 'Welcome to Iron Ridge',
    text: 'Raiders come out of the railway tunnel and ride past every row of workshops. Start with the Quarry. Crossbows here are built with stone.',
    when: () => true, at: () => ({ plot: 'rquarry' }),
  },
  {
    id: 'ridge-route', town: 'ridge', covers: ['route'],
    title: 'Goods from Copper Gulch',
    text: 'The Boiler Shop uses bricks and the Locomotive Works uses tools. Copper Gulch sends them by wagon. Upgrade the Kiln and the Toolsmith there to send more.',
    when: h => h.level('boilershop') > 0 || h.level('loco') > 0, at: h => ({ plot: h.level('boilershop') > 0 ? 'boilershop' : 'loco' }),
  },
  {
    id: 'ridge-boss', town: 'ridge', covers: ['boss:train'],
    title: 'The armored train',
    text: 'Wave 10 brings the armored train. Its plates stop part of every hit. Mortars and the Still hurt it most.',
    when: h => h.wave >= 9, at: () => ({ el: '#wave' }),
  },
  {
    id: 'ph-welcome', town: 'pinehollow', covers: ['welcome:pinehollow'],
    title: 'Welcome to Pine Hollow',
    text: 'Hold this logging camp for 15 waves. Its timber and clay go to your towns, so the Gulch can make more bricks for Iron Ridge.',
    when: () => true, at: () => ({ plot: 'logcamp' }),
  },
];
