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
  // The board, in world units (1 unit = 1 map cell; x east, z south toward the camera). Each plot is 2x2, centered.
  board: {
    cols: 12, rows: 10,
    plots: {
      camp: [1.5, 2], mine: [4.5, 2], pit: [7.5, 2], toolsmith: [10.5, 2],
      saw: [1.5, 5], smelter: [4.5, 5], kiln: [7.5, 5], wagonworks: [10.5, 5],
    },
    // the road raiders walk, from off the board in the west to the vault in the east
    road: [[-8, 8.4], [-1, 8.4], [2, 8.9], [5, 8.1], [8, 8.8], [11, 8.4]],
    vault: [11.4, 8.4],
    look: { sand: '#d8b382', sandD: '#bf9465', dirt: '#8c6242', rut: '#6a4630', mesa: ['#b35a3a', '#d98a55', '#a94f33', '#e0a46c'] },
  },
};
