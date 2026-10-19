// Pure geometry, no p5 dependency. Ported from spectro.js get_visible_polygon,
// but works on arbitrary segments {sx, sy, ex, ey} instead of grid edges.

function visible_polygon(xpos, ypos, radius, segments, bounds)
{
  // bounds: {w, h} - the screen rectangle is added as walls so rays always hit something
  const w = bounds.w, h = bounds.h;
  const n = segments.length + 4;
  const sx = new Float64Array(n), sy = new Float64Array(n), dx = new Float64Array(n), dy = new Float64Array(n);
  const put = (i, x1, y1, x2, y2) => { sx[i] = x1; sy[i] = y1; dx[i] = x2 - x1; dy[i] = y2 - y1; };
  segments.forEach((s, i) => put(i, s.sx, s.sy, s.ex, s.ey));
  const k = segments.length;
  put(k, 0, 0, w, 0); put(k + 1, w, 0, w, h); put(k + 2, w, h, 0, h); put(k + 3, 0, h, 0, 0);

  const poly = [];
  for (let i = 0; i < n; ++i)
  {
    for (let e = 0; e < 2; ++e)
    {
      const base = Math.atan2(sy[i] + (e ? dy[i] : 0) - ypos, sx[i] + (e ? dx[i] : 0) - xpos);
      for (let o = -1; o <= 1; ++o)
      {
        const ang = base + o * 0.00001;
        const rdx = Math.cos(ang) * radius, rdy = Math.sin(ang) * radius;
        let best_t = Infinity;
        for (let j = 0; j < n; ++j)
        {
          const denom = dx[j] * rdy - dy[j] * rdx;
          if (denom > -1e-12 && denom < 1e-12) continue; // parallel
          const t2 = (rdx * (sy[j] - ypos) + rdy * (xpos - sx[j])) / denom;
          if (t2 < 0 || t2 > 1) continue;
          const t1 = (sx[j] + dx[j] * t2 - xpos) / rdx;
          if (t1 > 0 && t1 < best_t) best_t = t1;
        }
        if (best_t !== Infinity)
        {
          const px = xpos + rdx * best_t, py = ypos + rdy * best_t;
          poly.push({theta: Math.atan2(py - ypos, px - xpos), x: px, y: py});
        }
      }
    }
  }
  poly.sort((a, b) => a.theta - b.theta);
  return poly;
}

function point_in_polygon(px, py, poly)
{
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
  {
    const a = poly[i], b = poly[j];
    if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

function dist_point_segment(px, py, s)
{
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - s.sx) * dx + (py - s.sy) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.sx + t * dx), py - (s.sy + t * dy));
}

function project_on_segment(px, py, s)
{
  const dx = s.ex - s.sx, dy = s.ey - s.sy;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - s.sx) * dx + (py - s.sy) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = s.sx + t * dx, y = s.sy + t * dy;
  return {x, y, t, d: Math.hypot(px - x, py - y)};
}

// additive mix of every light whose visibility polygon contains the point
function color_at_polys(polys, lights, x, y)
{
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < lights.length; ++i)
  {
    if (polys[i] && point_in_polygon(x, y, polys[i]))
    {
      r = Math.max(r, lights[i].r); g = Math.max(g, lights[i].g); b = Math.max(b, lights[i].b);
    }
  }
  return {r, g, b};
}

function segments_intersect(ax, ay, bx, by, s)
{
  const d1x = bx - ax, d1y = by - ay, d2x = s.ex - s.sx, d2y = s.ey - s.sy;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return false;
  const t = ((s.sx - ax) * d2y - (s.sy - ay) * d2x) / den;
  const u = ((s.sx - ax) * d1y - (s.sy - ay) * d1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}


