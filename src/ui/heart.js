/* The vault's mark: a small pixel heart beside the hits it can take, on the wave bar and the map labels, the same at a
   town and an outpost (review of 2026.11.20-14: "Vault 20/20" read as gold, and outposts said Stock with no reason). */
const PIX = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const D = PIX.map((row, y) => [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')).join('')).join('');
export const HEART_PATH = D;
export function heart(cls = 'heart') {
  const i = document.createElement('i'); i.className = cls; i.setAttribute('aria-hidden', 'true');
  i.innerHTML = `<svg viewBox="0 0 7 6" shape-rendering="crispEdges"><path d="${D}"/></svg>`;
  return i;
}
