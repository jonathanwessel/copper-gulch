/* The empire map (GDD.md, Empire map): where each town and outpost sits, in map units. The Capital's site is in the
   middle (it is built in M4); towns ring it and each outpost sits out past the town it feeds. The map is taller than
   it is wide, so a phone sees it whole; a wide screen turns it on its side. Later towns add their place here. */
export const CAPITAL = [0, 0];
export const SITES = {
  drycreek: [-8.5, 19],
  gulch: [-6.5, 7.5],
  ridge: [6.5, -7.5],
  pinehollow: [9, -19.5],
  falls: [7.5, 8.5],
  sandybend: [10.5, 19.5],
};
export const DIORAMA = .58; // a town's board drawn on the map at this scale
