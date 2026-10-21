// Holes in the floor: polygonal voids that light (and lights) can't cross. Their rims are
// permanent walls, so they split the level into islands, sides, stripes... The generator only
// keeps lights on islands where their solution position lives, so levels stay solvable.
// Generation is pure geometry; draw_holes paints the void onto the floor graphics.

const HOLE_KINDS = ['chasm', 'chasm', 'stripes', 'pits', 'lake', 'checker', 'corner', 'cross', 'moat'];

// walled holes have solid rims; open holes let light pass but nothing can be built or dragged over
function assign_hole_types(polys)
{
  const mode = pick(['walled', 'open', 'open', 'mixed', 'mixed']), offset = Math.random() < 0.5 ? 0 : 1;
  return polys.map((poly, i) => ({poly, walled: mode === 'walled' || (mode === 'mixed' && (i + offset) % 2 === 0)}));
}

function normalize_holes(holes)
{
  return (holes || []).map(h => (Array.isArray(h) ? {poly: h, walled: true} : h));
}

// true when the open stretch of the segment lies over a hole (its ends may sit on a rim)
function segment_hits_hole(x1, y1, x2, y2, polys)
{
  if (!polys.length) return false;
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.ceil(len / 5));
  for (let i = 1; i < n; ++i)
  {
    const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    if (polys.some(h => point_in_polygon(x, y, h))) return true;
  }
  return false;
}

function poly_of(pts) { return pts.map(([x, y]) => ({x, y})); }

// a long strip along a direction through (cx, cy), from t0 to t1, with optionally jagged edges
function band_poly(cx, cy, ang, width, wobble, t0, t1)
{
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const ts = [t0];
  while (ts[ts.length - 1] < t1 - 70) ts.push(ts[ts.length - 1] + rnd(45, 90));
  ts.push(t1);
  const edge = side => ts.map((t, i) =>
  {
    const o = side * (width / 2 + (wobble && i > 0 && i < ts.length - 1 ? rnd(-wobble, wobble) * width : 0));
    return [cx + dx * t + nx * o, cy + dy * t + ny * o];
  });
  return poly_of(edge(1).concat(edge(-1).reverse()));
}

function blob_poly(cx, cy, r, sides, wobble)
{
  const a0 = rnd(0, Math.PI * 2), pts = [];
  for (let i = 0; i < sides; ++i)
  {
    const a = a0 + Math.PI * 2 * i / sides, rr = r * (1 + rnd(-wobble, wobble));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly_of(pts);
}

function make_holes(kind)
{
  const {x: cx, y: cy, u} = centre();
  const reach = Math.hypot(AREA_W, AREA_H);
  const holes = [];
  const ang = pick([0, Math.PI / 2, rnd(0, Math.PI), rnd(-0.3, 0.3), Math.PI / 2 + rnd(-0.3, 0.3)]);

  if (kind === 'chasm')
  {
    const off = rnd(-0.28, 0.28) * u, nx = -Math.sin(ang), ny = Math.cos(ang);
    const x = cx + nx * off, y = cy + ny * off, w = rnd(45, 110), wob = pick([0, 0.2, 0.35]);
    if (Math.random() < 0.4) // a bridge
    {
      const g = rnd(-0.2, 0.2) * reach, half = rnd(40, 70);
      holes.push(band_poly(x, y, ang, w, wob, -reach / 2, g - half), band_poly(x, y, ang, w, wob, g + half, reach / 2));
    }
    else holes.push(band_poly(x, y, ang, w, wob, -reach / 2, reach / 2));
  }
  else if (kind === 'stripes')
  {
    const n = pick([2, 3, 4]), gap = u / (n + 1) * rnd(0.9, 1.1), w = Math.min(rnd(28, 55), gap * 0.45);
    const nx = -Math.sin(ang), ny = Math.cos(ang), wob = pick([0, 0.15]);
    const bridges = Math.random() < 0.5;
    for (let i = 0; i < n; ++i)
    {
      const o = (i - (n - 1) / 2) * gap, x = cx + nx * o, y = cy + ny * o;
      if (bridges)
      {
        const g = rnd(-0.25, 0.25) * reach, half = rnd(40, 65);
        holes.push(band_poly(x, y, ang, w, wob, -reach / 2, g - half), band_poly(x, y, ang, w, wob, g + half, reach / 2));
      }
      else holes.push(band_poly(x, y, ang, w, wob, -reach / 2, reach / 2));
    }
  }
  else if (kind === 'pits')
  {
    const n = floor_int(rnd(3, 7)), placed = [];
    for (let k = 0; k < 200 && placed.length < n; ++k)
    {
      const r = rnd(26, 62), p = rnd_point(r + 20);
      if (placed.some(q => Math.hypot(q.x - p.x, q.y - p.y) < q.r + r + 40)) continue;
      placed.push({x: p.x, y: p.y, r});
    }
    for (const q of placed) holes.push(blob_poly(q.x, q.y, q.r, floor_int(rnd(4, 9)), 0.3));
  }
  else if (kind === 'lake')
  {
    holes.push(blob_poly(cx + rnd(-0.12, 0.12) * AREA_W, cy + rnd(-0.12, 0.12) * AREA_H, u * rnd(0.18, 0.3), floor_int(rnd(7, 13)), 0.25));
  }
  else if (kind === 'checker')
  {
    const cell = rnd(95, 130), half = rnd(0.16, 0.24) * cell, a = pick([0, Math.PI / 4]);
    const cols = Math.floor(AREA_W / cell), rows = Math.floor(AREA_H / cell);
    for (let i = 0; i < cols; ++i)
      for (let j = 0; j < rows; ++j)
      {
        if ((i + j) % 2) continue;
        const x = (AREA_W - (cols - 1) * cell) / 2 + i * cell, y = (AREA_H - (rows - 1) * cell) / 2 + j * cell;
        holes.push(poly_of([0, 1, 2, 3].map(k => [x + Math.cos(a + Math.PI / 4 + k * Math.PI / 2) * half * 1.41,
                                                  y + Math.sin(a + Math.PI / 4 + k * Math.PI / 2) * half * 1.41])));
      }
  }
  else if (kind === 'corner')
  {
    // a big or small wedge bitten out of one corner by a jagged diagonal
    const sx = Math.random() < 0.5 ? 0 : AREA_W, sy = Math.random() < 0.5 ? 0 : AREA_H;
    const dx = sx ? -1 : 1, dy = sy ? -1 : 1, size = rnd(0.3, 0.75) * u;
    const a = [sx + dx * size, sy], b = [sx, sy + dy * size];
    const pts = [[sx - dx * 60, sy - dy * 60], [a[0], a[1] - dy * 60]];
    const steps = floor_int(rnd(2, 5));
    for (let i = 1; i < steps; ++i)
    {
      const t = i / steps, j = rnd(-0.12, 0.12) * size;
      pts.push([a[0] + (b[0] - a[0]) * t + dx * j, a[1] + (b[1] - a[1]) * t + dy * j]);
    }
    pts.push([b[0] - dx * 60, b[1]]);
    holes.push(poly_of(pts));
  }
  else if (kind === 'cross')
  {
    const w = rnd(40, 80), x = cx + rnd(-0.1, 0.1) * AREA_W, y = cy + rnd(-0.1, 0.1) * AREA_H;
    holes.push(band_poly(x, y, ang, w, 0, -reach / 2, reach / 2), band_poly(x, y, ang + Math.PI / 2, w, 0, -reach / 2, reach / 2));
  }
  else if (kind === 'moat')
  {
    // a C-shaped moat around a central island, open on one side
    const R = u * rnd(0.22, 0.32), th = rnd(34, 60), gap = rnd(0.35, 0.6), a0 = rnd(0, Math.PI * 2), steps = 12;
    const outer = [], inner = [];
    for (let i = 0; i <= steps; ++i)
    {
      const a = a0 + gap / 2 + (Math.PI * 2 - gap) * i / steps;
      outer.push([cx + Math.cos(a) * (R + th / 2), cy + Math.sin(a) * (R + th / 2)]);
      inner.push([cx + Math.cos(a) * (R - th / 2), cy + Math.sin(a) * (R - th / 2)]);
    }
    holes.push(poly_of(outer.concat(inner.reverse())));
  }
  return holes;
}

// pieces of segment s on the inside (or outside) of a polygon
function clip_segment(s, poly, keep_inside)
{
  const ts = [0, 1];
  for (let i = 0; i < poly.length; ++i)
  {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const d1x = s.ex - s.sx, d1y = s.ey - s.sy, d2x = q.x - p.x, d2y = q.y - p.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((p.x - s.sx) * d2y - (p.y - s.sy) * d2x) / den;
    const u = ((p.x - s.sx) * d1y - (p.y - s.sy) * d1x) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const len = Math.hypot(s.ex - s.sx, s.ey - s.sy), out = [];
  for (let i = 0; i + 1 < ts.length; ++i)
  {
    if ((ts[i + 1] - ts[i]) * len < 1) continue;
    const m = (ts[i] + ts[i + 1]) / 2;
    if (point_in_polygon(s.sx + (s.ex - s.sx) * m, s.sy + (s.ey - s.sy) * m, poly) !== keep_inside) continue;
    out.push(seg(s.sx + (s.ex - s.sx) * ts[i], s.sy + (s.ey - s.sy) * ts[i], s.sx + (s.ex - s.sx) * ts[i + 1], s.sy + (s.ey - s.sy) * ts[i + 1]));
  }
  return out;
}

function poly_edges(poly) { return poly.map((p, i) => { const q = poly[(i + 1) % poly.length]; return seg(p.x, p.y, q.x, q.y); }); }

// permanent wall segments of the border and the holes, with the parts hidden by holes or
// lying outside the border removed
function rim_walls(border, holes)
{
  let out = [];
  for (const e of poly_edges(border))
  {
    let pieces = [e];
    for (const h of holes) pieces = pieces.flatMap(p => clip_segment(p, h, false));
    out = out.concat(pieces);
  }
  holes.forEach((h, i) =>
  {
    for (const e of poly_edges(h))
    {
      let pieces = clip_segment(e, border, true);
      holes.forEach((o, j) => { if (j !== i) pieces = pieces.flatMap(p => clip_segment(p, o, false)); });
      out = out.concat(pieces);
    }
  });
  return out;
}

// ---------- connectivity ----------
// Flood fill over the free floor so lights are never scrambled onto an island that their
// solution position can't be reached from.

const CELL = 14;

function analyze_space(walls, is_free)
{
  const cols = Math.ceil(AREA_W / CELL), rows = Math.ceil(AREA_H / CELL);
  const free = new Uint8Array(cols * rows);
  let free_n = 0;
  for (let j = 0; j < rows; ++j)
    for (let i = 0; i < cols; ++i)
      if (is_free((i + 0.5) * CELL, (j + 0.5) * CELL)) { free[j * cols + i] = 1; ++free_n; }
  const id = new Int32Array(cols * rows).fill(-1);
  const sizes = [];
  const linked = (i, j, k, l) =>
  {
    const ax = (i + 0.5) * CELL, ay = (j + 0.5) * CELL, bx = (k + 0.5) * CELL, by = (l + 0.5) * CELL;
    return !walls.some(s => segments_intersect(ax, ay, bx, by, s));
  };
  for (let start = 0; start < free.length; ++start)
  {
    if (!free[start] || id[start] >= 0) continue;
    const c = sizes.length;
    let n = 0;
    const stack = [start];
    id[start] = c;
    while (stack.length)
    {
      const cur = stack.pop();
      ++n;
      const i = cur % cols, j = (cur - i) / cols;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
      {
        const k = i + di, l = j + dj;
        if (k < 0 || l < 0 || k >= cols || l >= rows) continue;
        const nb = l * cols + k;
        if (!free[nb] || id[nb] >= 0 || !linked(i, j, k, l)) continue;
        id[nb] = c;
        stack.push(nb);
      }
    }
    sizes.push(n);
  }
  const region = (x, y) =>
  {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : id[j * cols + i];
  };
  return {region, sizes, free_n, total: cols * rows};
}

// ---------- drawing ----------
// Paints the voids onto the floor graphics (call while clipped to the border).

function draw_holes(g, holes)
{
  if (!holes.length) return;
  const ctx = g.drawingContext;
  const style = random(['plain', 'stars', 'grid']);
  const glow = random([[90, 60, 200], [200, 70, 60], [50, 170, 190], [60, 190, 90], [200, 160, 60]]);
  for (const hole of holes)
  {
    const h = hole.poly, open = !hole.walled;
    ctx.save();
    ctx.beginPath();
    h.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = open ? 'rgb(14,14,24)' : 'rgb(6,6,10)';
    ctx.fill();
    ctx.clip();
    const xs = h.map(p => p.x), ys = h.map(p => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (style === 'stars' && !open)
    {
      const n = Math.min(160, Math.round((x1 - x0) * (y1 - y0) / 1800));
      for (let i = 0; i < n; ++i)
      {
        ctx.fillStyle = `rgba(200,210,255,${random(0.15, 0.7)})`;
        const r = random(0.5, 1.6);
        ctx.fillRect(random(x0, x1), random(y0, y1), r, r);
      }
    }
    else if (style === 'grid' || open)
    {
      ctx.strokeStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},0.12)`;
      ctx.lineWidth = 1;
      for (let x = Math.floor(x0 / 20) * 20; x < x1; x += 20) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = Math.floor(y0 / 20) * 20; y < y1; y += 20) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    }
    // faint glow from the depths along the rim
    ctx.beginPath();
    h.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = `rgba(${glow[0]},${glow[1]},${glow[2]},0.22)`;
    ctx.lineWidth = open ? 24 : 36;
    ctx.stroke();
    ctx.restore();
    if (open)
    {
      // a bright dashed lip so the edge of the drop reads clearly even under light
      ctx.beginPath();
      h.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = `rgba(${Math.min(255, glow[0] + 70)},${Math.min(255, glow[1] + 70)},${Math.min(255, glow[2] + 70)},0.75)`;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
