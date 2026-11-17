/* A 5x7 pixel font for signs and titles, drawn onto a canvas and scaled up with crisp pixels (no web fonts).
   Each glyph is 7 rows of 5 bits, top row first. */
const G = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [31, 2, 4, 2, 1, 17, 14],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '-': [0, 0, 0, 14, 0, 0, 0],
  '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0], "'": [4, 4, 8, 0, 0, 0, 0],
};

export const GLYPHS = Object.keys(G);

/* The lit pixels of a line of text, as [x, y] in font pixels (6 px per letter including the gap). */
export function pixels(text) {
  const out = [];
  [...String(text).toUpperCase()].forEach((ch, i) => {
    const rows = G[ch] || G['?'];
    rows.forEach((bits, y) => { for (let x = 0; x < 5; x++) if (bits & (16 >> x)) out.push([i * 6 + x, y]); });
  });
  return out;
}

/* Draw text into a new canvas. Each font pixel is a 2x2 block: a flat fill, a light top edge and a dark bottom edge on
   each stroke, a 1-pixel outline, and a hard drop shadow. The canvas is small; show it scaled up with
   image-rendering: pixelated, at a whole-number scale. */
export function drawText(text, o = {}) {
  const fill = o.fill || '#e38d4e', hi = o.hi || '#ffc58f', lo = o.lo || '#b0612f', line = o.line || '#1d120c', shadow = o.shadow || 'rgba(29, 18, 12, .55)';
  const px = pixels(text), on = new Set(px.map(([x, y]) => x + ',' + y));
  const W = (String(text).length * 6 - 1) * 2, H = 14, P = 1; // P: room for the outline
  const c = document.createElement('canvas'); c.width = W + 2 * P + 2; c.height = H + 2 * P + 2;
  const g = c.getContext('2d');
  const mask = new Set(); for (const [x, y] of px) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) mask.add((x * 2 + a) + ',' + (y * 2 + b));
  const grown = new Set(); for (const k of mask) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) grown.add((x + dx) + ',' + (y + dy)); }
  const dot = (x, y, col) => { g.fillStyle = col; g.fillRect(x + P, y + P, 1, 1); };
  for (const k of grown) { const [x, y] = k.split(',').map(Number); dot(x + 2, y + 2, shadow); }
  for (const k of grown) { const [x, y] = k.split(',').map(Number); if (!mask.has(k)) dot(x, y, line); }
  for (const [x, y] of px) {
    const up = on.has(x + ',' + (y - 1)), down = on.has(x + ',' + (y + 1));
    dot(x * 2, y * 2, up ? fill : hi); dot(x * 2 + 1, y * 2, up ? fill : hi);
    dot(x * 2, y * 2 + 1, down ? fill : lo); dot(x * 2 + 1, y * 2 + 1, down ? fill : lo);
  }
  return c;
}
