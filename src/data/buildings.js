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
  smelter: { name: 'Smelter', town: 'gulch', makes: 'copper', inputs: { ore: 2, timber: 1 }, rate: .4, cost: 500, growth: 1.17, needs: { mine: 5 }, model: 'smelt' },
  kiln:    { name: 'Kiln', town: 'gulch', makes: 'bricks', inputs: { clay: 2, timber: 1 }, rate: .5, cost: 600, growth: 1.17, needs: { pit: 5 }, model: 'kiln' },
  toolsmith: { name: 'Toolsmith', town: 'gulch', makes: 'tools', inputs: { planks: 1, copper: 1 }, rate: .4, cost: 9000, growth: 1.2, needs: { saw: 10, smelter: 5 }, model: 'toolsmith' },
  wagonworks: { name: 'Wagon Works', town: 'gulch', makes: 'wagons', inputs: { planks: 2, tools: 1, copper: 1 }, rate: .2, cost: 40000, growth: 1.2, needs: { toolsmith: 10 }, model: 'wagonworks' },
  // Dry Creek Outpost: raw goods only. An outpost may make a good a town makes too (GDD.md, Outposts).
  quarry:  { name: 'Stone Camp', town: 'drycreek', makes: 'stone', inputs: {}, rate: .8, cost: 10, growth: 1.15, model: 'quarry' },
  dmine:   { name: 'Copper Camp', town: 'drycreek', makes: 'ore', inputs: {}, rate: .6, cost: 30, growth: 1.15, needs: { quarry: 2 }, model: 'dmine' },
  // Iron Ridge: iron and rail. Its Boiler Shop needs bricks and its Locomotive Works tools, both shipped from the Gulch.
  rquarry: { name: 'Quarry', town: 'ridge', makes: 'stone', inputs: {}, rate: 1, cost: 15, growth: 1.15, model: 'rquarry' },
  ironmine: { name: 'Iron Mine', town: 'ridge', makes: 'iron', inputs: {}, rate: .8, cost: 60, growth: 1.15, needs: { rquarry: 3 }, model: 'ironmine' },
  colliery: { name: 'Coal Pit', town: 'ridge', makes: 'coal', inputs: {}, rate: 1, cost: 180, growth: 1.15, needs: { rquarry: 5 }, model: 'colliery' },
  furnace: { name: 'Blast Furnace', town: 'ridge', makes: 'pigiron', inputs: { iron: 2, coal: 1 }, rate: .4, cost: 700, growth: 1.17, needs: { ironmine: 5, colliery: 3 }, model: 'furnace' },
  steelmill: { name: 'Steel Mill', town: 'ridge', makes: 'steel', inputs: { pigiron: 1, coal: 1 }, rate: .35, cost: 1200, growth: 1.17, needs: { furnace: 3 }, model: 'steelmill' },
  rolling: { name: 'Rolling Mill', town: 'ridge', makes: 'rails', inputs: { steel: 2 }, rate: .15, cost: 3000, growth: 1.2, needs: { steelmill: 5 }, model: 'rolling' },
  boilershop: { name: 'Boiler Shop', town: 'ridge', makes: 'boilers', inputs: { steel: 1, bricks: 2 }, rate: .2, cost: 4000, growth: 1.2, needs: { steelmill: 3 }, model: 'boilershop' },
  loco:    { name: 'Locomotive Works', town: 'ridge', makes: 'locos', inputs: { boilers: 1, rails: 2, tools: 1 }, rate: .05, cost: 15000, growth: 1.2, needs: { rolling: 5, boilershop: 5 }, model: 'loco' },
  // Pine Hollow: the second outpost, opened with Iron Ridge. Timber and clay, so the Gulch makes more bricks.
  // Silver Falls. Every workshop draws power from the Water Wheel (power: 1 for each unit it makes); the pits do not.
  sandpit: { name: 'Sand Pit', town: 'falls', makes: 'sand', inputs: {}, rate: 1.2, cost: 60, growth: 1.15, model: 'sandpit' },
  quartzmine: { name: 'Quartz Mine', town: 'falls', makes: 'quartz', inputs: {}, rate: .8, cost: 300, growth: 1.15, needs: { sandpit: 3 }, model: 'quartzmine' },
  waterwheel: { name: 'Water Wheel', town: 'falls', makes: 'power', inputs: {}, rate: 1, cost: 900, growth: 1.15, needs: { sandpit: 4 }, model: 'waterwheel' },
  glassworks: { name: 'Glassworks', town: 'falls', makes: 'glass', inputs: { sand: 2, power: 1 }, rate: .5, cost: 3000, growth: 1.17, needs: { sandpit: 5, waterwheel: 1 }, model: 'glassworks' },
  wiremill: { name: 'Wire Mill', town: 'falls', makes: 'wire', inputs: { copper: 1, power: 1 }, rate: .4, cost: 5000, growth: 1.17, needs: { glassworks: 3 }, model: 'wiremill' },
  bulbworks: { name: 'Bulb Works', town: 'falls', makes: 'bulbs', inputs: { glass: 1, wire: 1, power: 1 }, rate: .25, cost: 12000, growth: 1.2, needs: { wiremill: 3 }, model: 'bulbworks' },
  dynamo: { name: 'Dynamo Works', town: 'falls', makes: 'dynamos', inputs: { wire: 1, steel: 1, power: 1 }, rate: .2, cost: 20000, growth: 1.2, needs: { wiremill: 5 }, model: 'dynamo' },
  telegraph: { name: 'Telegraph Works', town: 'falls', makes: 'telegraphs', inputs: { wire: 2, bulbs: 1, rails: 1, power: 1 }, rate: .08, cost: 60000, growth: 1.2, needs: { bulbworks: 5, dynamo: 3 }, model: 'telegraph' },
  // Sandy Bend, the third outpost
  sandwash: { name: 'Sand Wash', town: 'sandybend', makes: 'sand', inputs: {}, rate: .9, cost: 15, growth: 1.15, model: 'sandwash' },
  quartzdig: { name: 'Quartz Diggings', town: 'sandybend', makes: 'quartz', inputs: {}, rate: .6, cost: 40, growth: 1.15, needs: { sandwash: 2 }, model: 'quartzdig' },
  logcamp: { name: 'Logging Camp', town: 'pinehollow', makes: 'timber', inputs: {}, rate: .9, cost: 12, growth: 1.15, model: 'logcamp' },
  claybank: { name: 'Clay Bank', town: 'pinehollow', makes: 'clay', inputs: {}, rate: .8, cost: 35, growth: 1.15, needs: { logcamp: 2 }, model: 'claybank' },
};

/* Reaching each of these levels doubles a building's output (the "x2 milestones"). */
export const MILESTONES = [10, 25, 50, 100, 150, 200];
