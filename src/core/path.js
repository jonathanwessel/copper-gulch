/* A lane as a polyline of [x, z] points: its length, and the point at a distance along it. Pure geometry for the
   simulation (raiders move by distance along their lane). */
export function makePath(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, cum, length: cum[cum.length - 1] };
}

/* [x, z] at distance s along the path (clamped to its ends). */
export function pointAt(path, s) {
  const { points, cum } = path;
  if (s <= 0) return points[0].slice();
  if (s >= path.length) return points[points.length - 1].slice();
  let i = 1;
  while (cum[i] < s) i++;
  const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1]), a = points[i - 1], b = points[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
