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
    id: 'dc-welcome', town: 'drycreek', covers: ['welcome:drycreek'],
    title: 'Welcome to Dry Creek',
    text: 'Raiders are on their way to this camp. Hold them off for 10 waves and Copper Gulch opens.',
    when: () => true,
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
    text: 'Raiders ride for this pile of goods. Each one that gets there damages it. If it breaks, you lose a tenth of your coins and go back two waves.',
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
    text: 'You beat wave 10 at Dry Creek. Copper Gulch has more buildings and towers. Dry Creek keeps making coins while you play there.',
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
    text: 'Everything you make is sold right away. Sell too much of one good and its price drops for a while, so making several goods earns more. To keep a good instead, tap its building and switch Selling to Holding.',
    when: h => h.flags.firstSale && h.t > 20, at: () => ({ el: '#coins' }),
  },
  {
    id: 'goods', covers: ['goods'],
    title: 'Goods',
    text: 'Tap Goods to see what your town has in stock and what each good sells for right now. Tap Selling next to a good to keep it instead of selling it.',
    when: h => h.flags.firstSale && h.t > 60, at: () => ({ el: '#goodsBtn' }),
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
    text: 'Raiders come in waves. The green bar drops each time one gets through. Tap Call now to start the next wave early and get bonus coins for the time you skip.',
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
    text: 'Every raider that gets through damages the vault. If it breaks, you lose a tenth of your coins and go back two waves. Build more towers or upgrade the ones you have.',
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
    text: "Tap Hire foreman on this building's card. The foreman buys the next level for you when it costs half your coins or less.",
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
    text: 'You can build a Snake Oil Still now. Tap a stone pad to build one. Its poison hurts armored raiders too.',
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
    text: 'Tap Perks, then Sign the charter. Your town starts over at wave 1. You get deeds you keep forever. Each deed gives you more coins.',
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
    id: 'townchip', covers: ['townchip'],
    title: 'Your towns',
    text: 'The buttons at the top show your towns. Tap Dry Creek to go back to the outpost. Tap Copper Gulch to come back here.',
    when: h => h.towns > 1 && !h.outpost && h.t > 20, at: () => ({ el: '#townChip' }),
  },
  {
    id: 'outposts', covers: ['system:outpost'],
    title: 'Dry Creek keeps working',
    text: 'Raiders still come to Dry Creek while you are here. Its Crossbows fight them off. The coins from its stone and ore come to this town.',
    when: h => h.outpostWon && !h.outpost && h.t > 50, at: () => ({ el: '#coins' }),
  },
  {
    id: 'draw', covers: ['outpost:draw'],
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
];
