/* Explainers: the short cards that teach each feature the first time it appears, with a spotlight on the thing.
   Text follows the owner's writing rule (PLAN.md): plain short sentences, name the real button, say what happens.
   Each is shown once and remembered in the save. Every feature of the game must be covered by one: tools/audit.js
   works out the features from the game itself (each system, tower kind and goods tier, and the named mechanics
   below) and fails when any has no explainer.
     covers: the feature ids it teaches.     when(h): true once it should show; h reads the town (src/ui/coach.js).
     at(h): what to spotlight: { plot }, { spot }, { tower }, { vault: true } or { el: css selector }; or nothing. */
export const EXPLAINERS = [
  {
    id: 'welcome', covers: ['system:economy', 'tier:0'],
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
    text: 'Everything you make is sold right away. Sell too much of one good and its price drops for a while, so making several goods earns more. To keep a good instead, say copper for a Cannon, tap its building and switch Selling to Holding.',
    when: h => h.flags.firstSale && h.t > 20, at: () => ({ el: '#coins' }),
  },
  {
    id: 'goods', covers: ['goods'],
    title: 'Goods',
    text: 'Tap Goods to see what your town has in stock and what each good sells for right now. Tap Selling next to a good to keep it instead of selling it.',
    when: h => h.flags.firstSale && h.t > 60, at: () => ({ el: '#goodsBtn' }),
  },
  {
    id: 'waves', covers: ['call'],
    title: 'Waves',
    text: 'Raiders come in waves. The green bar is your vault\'s health. Tap Call now to start the next wave early and get bonus coins for the time you skip.',
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
    id: 'vault', covers: ['vault', 'breach'],
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
    id: 'short', covers: ['starved'],
    title: 'Out of materials',
    text: 'A red edge on a building\'s tag means it ran out of what it needs. Upgrade the building that supplies it.',
    when: h => !!h.starved, at: h => ({ plot: h.starved }),
  },
  {
    id: 'cannon', covers: ['tower:cannon'],
    title: 'Cannon',
    text: 'You\'ve made copper, so you can build a Cannon. It\'s slow, but each shot hits a whole group of raiders.',
    when: h => (h.made.copper || 0) > 0, at: () => ({ spot: 1 }),
  },
  {
    id: 'frost', covers: ['tower:frost'],
    title: 'Frost Lens',
    text: 'You\'ve made bricks, so you can build a Frost Lens. It slows every raider in range, so your other towers get more shots.',
    when: h => (h.made.bricks || 0) > 0, at: () => ({ spot: 4 }),
  },
  {
    id: 'finished', covers: ['tier:2', 'tower:still'],
    title: 'Tools',
    text: 'The Toolsmith makes tools, which sell for much more than the planks and copper that go in. Tools also build the Snake Oil Still. Its poison hurts armored raiders.',
    when: h => h.unlocked('toolsmith'), at: () => ({ plot: 'toolsmith' }),
  },
  {
    id: 'paths', covers: ['path'],
    title: 'Choose an upgrade',
    text: 'At level 5 this tower turns into one of two kinds. Tap it and pick the one you want. The choice is for good.',
    when: h => h.towerAtLevel(4) !== null, at: h => ({ tower: h.towerAtLevel(4) }),
  },
  {
    id: 'boss', covers: ['boss'],
    title: 'The war wagon',
    text: 'Every 10th wave brings the war wagon. It\'s slow and heavily armored. If it reaches the vault, it does a lot of damage.',
    when: h => h.wave % 10 === 0 && h.phase === 'wave', at: () => ({ el: '#wave' }),
  },
  {
    id: 'pit', covers: ['pit'],
    title: 'Mortar pit',
    text: 'This spot is too far from the road for most towers. A Mortar fits here. It fires over long distances but can\'t hit raiders close to it. Opens at wave 12.',
    when: h => h.bestWave >= 4 && h.phase === 'break' && h.firstPit !== null, at: h => ({ spot: h.firstPit }),
  },
  {
    id: 'mortar', covers: ['tower:mortar'],
    title: 'The Mortar is open',
    text: 'Tap a mortar pit, the ring of sandbags far from the road, and build a Mortar. Its shells blast a whole group of raiders far away. It can\'t hit raiders close to it.',
    when: h => !!h.flags['open:mortar'] && h.firstPit !== null, at: h => ({ spot: h.firstPit }),
  },
];
