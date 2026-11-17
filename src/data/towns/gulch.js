/* Copper Gulch: the first town. Frontier era: wood, clay and copper, on one road. */
export const GULCH = {
  id: 'gulch',
  name: 'Copper Gulch',
  era: 'Frontier',
  goods: ['timber', 'ore', 'clay', 'planks', 'copper', 'bricks', 'tools', 'wagons'],
  buildings: ['camp', 'mine', 'pit', 'saw', 'smelter', 'kiln', 'toolsmith', 'wagonworks'],
  top: 'wagons',                  // the town's top good
  start: { coins: 15, buildings: { camp: 1 } },
  imports: [],                    // goods shipped in from other towns (none: the Gulch is first)
};
