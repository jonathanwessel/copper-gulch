/* Buildings that make goods. Per level, a building makes `rate` units of `makes` per second, using `inputs` per unit.
   cost: the price of level 1; each further level costs `growth` times the last. needs: levels of other buildings
   before it can be built. model: the model recipe in src/assets/models/<town>.js.
   Balance rule (checked by tools/audit.js): at equal levels, every supplier keeps up with each of its consumers. */
export const BUILDINGS = {
  // Copper Gulch
  camp:    { name: 'Lumber Camp', town: 'gulch', makes: 'timber', inputs: {}, rate: 1, cost: 10, growth: 1.15, model: 'camp' },
  mine:    { name: 'Copper Mine', town: 'gulch', makes: 'ore', inputs: {}, rate: .8, cost: 40, growth: 1.15, needs: { camp: 3 }, model: 'cumine' },
  pit:     { name: 'Clay Pit', town: 'gulch', makes: 'clay', inputs: {}, rate: 1, cost: 120, growth: 1.15, needs: { camp: 5 }, model: 'claypit' },
  saw:     { name: 'Sawmill', town: 'gulch', makes: 'planks', inputs: { timber: 2 }, rate: .5, cost: 250, growth: 1.17, needs: { camp: 5 }, model: 'saw' },
  smelter: { name: 'Smelter', town: 'gulch', makes: 'copper', inputs: { ore: 2, timber: 1 }, rate: .4, cost: 900, growth: 1.17, needs: { mine: 5 }, model: 'smelt' },
  kiln:    { name: 'Kiln', town: 'gulch', makes: 'bricks', inputs: { clay: 2, timber: 1 }, rate: .5, cost: 1000, growth: 1.17, needs: { pit: 5 }, model: 'kiln' },
  toolsmith: { name: 'Toolsmith', town: 'gulch', makes: 'tools', inputs: { planks: 1, copper: 1 }, rate: .4, cost: 9000, growth: 1.2, needs: { saw: 10, smelter: 5 }, model: 'toolsmith' },
  wagonworks: { name: 'Wagon Works', town: 'gulch', makes: 'wagons', inputs: { planks: 2, tools: 1, copper: 1 }, rate: .2, cost: 40000, growth: 1.2, needs: { toolsmith: 10 }, model: 'wagonworks' },
};

/* Reaching each of these levels doubles a building's output (the "x2 milestones"). */
export const MILESTONES = [10, 25, 50, 100, 150, 200];
