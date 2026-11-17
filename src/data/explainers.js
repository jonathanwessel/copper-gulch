/* Explainers: the short cards that teach each feature the first time it appears, with a spotlight on the thing.
   Each is shown once and remembered in the save. Every feature of the game must be covered by one: tools/audit.js
   works out the features from the game itself (each system, tower kind and goods tier, and the named mechanics
   below) and fails when any has no explainer.
     covers: the feature ids it teaches.     when(h): true once it should show; h reads the town (src/ui/coach.js).
     at(h): what to spotlight: { plot }, { spot }, { tower }, { vault: true } or { el: css selector }; or nothing. */
export const EXPLAINERS = [
  {
    id: 'welcome', covers: ['system:economy', 'tier:0'],
    title: 'Welcome to Copper Gulch',
    text: 'Your Lumber Camp cuts timber. Tap it to see what it makes, and to build it up: every level makes more.',
    when: () => true, at: () => ({ plot: 'camp' }),
  },
  {
    id: 'towers', covers: ['system:defense', 'tower:crossbow'],
    title: 'Raiders ride this road',
    text: 'The road winds through town to your vault. Tap a stone pad and build a Crossbow with a few coins and timber. A pad between two stretches of road reaches both.',
    when: h => h.t > 8 && !h.towers.length, at: () => ({ spot: 0 }),
  },
  {
    id: 'market', covers: ['system:market'],
    title: 'Goods sell themselves',
    text: 'Goods sell on the empire market as they are made. Flood one good and its price sinks for a while, so a spread of goods pays best. A building card can hold a good back.',
    when: h => h.flags.firstSale && h.t > 20, at: () => ({ el: '#coins' }),
  },
  {
    id: 'waves', covers: ['call'],
    title: 'A wave is coming',
    text: 'Raiders come in waves; the green bar is your vault. Between waves, Call now starts the next wave early and pays coins for the time you skip.',
    when: h => h.towers.length > 0 || h.phase === 'wave', at: () => ({ el: '#wave' }),
  },
  {
    id: 'pause', covers: ['pause'],
    title: 'Pause any time',
    text: 'Pause stops everything: the town, the market and the raiders. The game also waits whenever you leave the app.',
    when: h => h.towers.length > 0 && h.t > 40, at: () => ({ el: '#pauseBtn' }),
  },
  {
    id: 'hold', covers: ['hold'],
    title: 'Hold the waves',
    text: 'Need a breather? Hold waves lets the raid on the road finish, then keeps the next one away while your town keeps working. Tap it again to let them come.',
    when: h => h.bestWave >= 1 && h.phase === 'break', at: () => ({ el: '#holdWaves' }),
  },
  {
    id: 'vault', covers: ['vault', 'breach'],
    title: 'A raider reached the vault',
    text: 'Each one that gets through weakens the vault. If it falls, raiders take a tenth of your coins and the town falls back two waves. Add towers, or raise the ones you have.',
    when: h => h.vault.hp < h.vault.max || h.breaches > 0, at: () => ({ vault: true }),
  },
  {
    id: 'milestone', covers: ['milestone', 'upgrade'],
    title: 'Milestones double output',
    text: 'Levels 10, 25, 50, 100 and more each double a building\'s output, and the building grows to show it. Tap the "Makes" line on a card to see where every number comes from.',
    when: h => h.anyLevel >= 6, at: h => ({ plot: h.topBuilding }),
  },
  {
    id: 'workshop', covers: ['tier:1'],
    title: 'Workshops',
    text: 'The Sawmill is open. Workshops turn goods into better goods that sell for more. Keep the buildings that feed them leveled to match.',
    when: h => h.unlocked('saw'), at: () => ({ plot: 'saw' }),
  },
  {
    id: 'short', covers: ['starved'],
    title: 'Running short',
    text: 'A red edge on a tag means this workshop is waiting on its inputs. Raise the building that feeds it.',
    when: h => !!h.starved, at: h => ({ plot: h.starved }),
  },
  {
    id: 'cannon', covers: ['tower:cannon'],
    title: 'Copper for cannons',
    text: 'Your Smelter makes copper, and copper buys a Cannon: slow, but it blasts a whole cluster of raiders at once.',
    when: h => (h.made.copper || 0) > 0, at: () => ({ spot: 1 }),
  },
  {
    id: 'frost', covers: ['tower:frost'],
    title: 'Bricks for the Frost Lens',
    text: 'Bricks from the Kiln build a Frost Lens. It chills every raider in reach, so they spend longer under your other towers.',
    when: h => (h.made.bricks || 0) > 0, at: () => ({ spot: 4 }),
  },
  {
    id: 'finished', covers: ['tier:2', 'tower:still'],
    title: 'Finished goods',
    text: 'The Toolsmith makes tools, a finished good worth far more than what goes in. Tools also build the Snake Oil Still, whose poison gets past armor.',
    when: h => h.unlocked('toolsmith'), at: () => ({ plot: 'toolsmith' }),
  },
  {
    id: 'paths', covers: ['path'],
    title: 'Pick a path',
    text: 'This tower\'s next level picks one of two paths for good: the card shows both. Mix paths along the road.',
    when: h => h.towerAtLevel(4) !== null, at: h => ({ tower: h.towerAtLevel(4) }),
  },
  {
    id: 'boss', covers: ['boss'],
    title: 'The war wagon',
    text: 'Every tenth wave brings the war wagon: armored, slow and very tough. Stop it before the vault, or it takes a big bite out of it.',
    when: h => h.wave % 10 === 0 && h.phase === 'wave', at: () => ({ el: '#wave' }),
  },
];
