// Solution-first level generation (same idea as spectro's solvable_random_level):
// build permanent walls, place lights, build a solution out of player walls, put detectors
// where the solution lights them in an exact color, drop walls that aren't needed,
// then scramble the lights. The solution (walls + light positions) is kept for "give up".
// Pure data / geometry, no p5 dependency.

let AREA_W = 900, AREA_H = 600;
const MARGIN = 24, LIGHT_RADIUS = 3000;
const LIGHT_COLORS = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
const AREA = {w: AREA_W, h: AREA_H};

function set_area(w, h) { AREA_W = AREA.w = w; AREA_H = AREA.h = h; }
const PROBE = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]];

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function seg(x1, y1, x2, y2) { return {sx: x1, sy: y1, ex: x2, ey: y2}; }

// The outer border of the level being generated: a closed polygon of {x, y}.
let BORDER = [];
let BORDER_SEGS = []; // permanent walls of the border and the holes' rims
let HOLES = [];      // every hole polygon (walled or open)
let HOLE_EDGES = []; // edges of open holes, kept clear of lights and detectors

// Irregular outline hugging the screen edge: chamfered corners, uneven inset and a few
// notches. It never eats more than ~45px of playing space.
function make_border()
{
  const m = MARGIN, w = AREA_W, h = AREA_H;
  const corners = [[m, m], [w - m, m], [w - m, h - m], [m, h - m]];
  const pts = [];
  for (let i = 0; i < 4; ++i)
  {
    const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const nx = -uy, ny = ux; // inward for a clockwise walk
    const chamfer = rnd(22, 55);
    let t = chamfer;
    pts.push({x: ax + ux * t, y: ay + uy * t});
    while (t < len - chamfer - 40)
    {
      t += rnd(45, 110);
      if (t > len - chamfer - 20) break;
      if (Math.random() < 0.3)
      {
        // notch: a flat-bottomed bump into the room
        const d = rnd(18, 42), wd = rnd(18, 40);
        const o = [[0, 0], [8, d], [wd - 8, d], [wd, 0]];
        for (const [dt, dd] of o)
          pts.push({x: ax + ux * (t + dt) + nx * dd, y: ay + uy * (t + dt) + ny * dd});
        t += wd;
      }
      else
      {
        const d = rnd(0, 20);
        pts.push({x: ax + ux * t + nx * d, y: ay + uy * t + ny * d});
      }
    }
    pts.push({x: ax + ux * (len - chamfer), y: ay + uy * (len - chamfer)});
  }
  return pts;
}

function set_border(poly, holes = [])
{
  BORDER = poly;
  HOLES = holes.map(h => h.poly);
  HOLE_EDGES = holes.filter(h => !h.walled).flatMap(h => poly_edges(h.poly));
  BORDER_SEGS = rim_walls(poly, holes.filter(h => h.walled).map(h => h.poly));
}

function inside(x, y, pad)
{
  return point_in_polygon(x, y, BORDER) && !HOLES.some(h => point_in_polygon(x, y, h)) &&
    min_seg_dist(x, y, BORDER_SEGS) >= pad && (!HOLE_EDGES.length || min_seg_dist(x, y, HOLE_EDGES) >= pad);
}

function rnd_point(pad)
{
  for (let k = 0; k < 200; ++k)
  {
    const x = rnd(MARGIN, AREA_W - MARGIN), y = rnd(MARGIN, AREA_H - MARGIN);
    if (inside(x, y, pad)) return {x, y};
  }
  return {x: AREA_W / 2, y: AREA_H / 2};
}

function crosses_border(s)
{
  return BORDER_SEGS.some(b => segments_intersect(s.sx, s.sy, s.ex, s.ey, b)) ||
         segment_hits_hole(s.sx, s.sy, s.ex, s.ey, HOLES);
}
function min_seg_dist(x, y, segs) { return Math.min(...segs.map(s => dist_point_segment(x, y, s))); }
function same_color(a, b) { return a.r === b.r && a.g === b.g && a.b === b.b; }

function polys_for(lights, raw)
{
  return lights.map(l => l.on ? visible_polygon(l.x, l.y, LIGHT_RADIUS, raw, AREA) : null);
}

// color at a point, or null if it changes within a few pixels (too fragile to be fair)
function robust_color(polys, lights, x, y)
{
  const c = color_at_polys(polys, lights, x, y);
  for (const [ox, oy] of PROBE)
    if (!same_color(c, color_at_polys(polys, lights, x + ox, y + oy))) return null;
  return c;
}

// true when switching lights on/off alone (no walls, no moving) already satisfies every detector
function solvable_by_toggling(lights, perm, dets)
{
  const polys = polys_for(lights.map(l => ({...l, on: true})), perm);
  for (let mask = 0; mask < (1 << lights.length); ++mask)
  {
    const sub_polys = polys.map((p, i) => (mask & (1 << i) ? p : null));
    if (dets.every(d => same_color(color_at_polys(sub_polys, lights, d.x, d.y), d))) return true;
  }
  return false;
}

// each solution wall should be the only thing keeping some detector right (removal is tested in
// the pruning pass), and the walls must not all serve the very same detector
function dets_need_distinct_walls(lights, perm, sol, dets)
{
  const served = new Set();
  for (let i = 0; i < sol.length; ++i)
  {
    const pp = polys_for(lights, perm.concat(sol.filter((_, j) => j !== i)));
    const broken = dets.filter(d => { const c = robust_color(pp, lights, d.x, d.y); return !(c && same_color(c, d)); });
    if (!broken.length) return false;
    if (broken.every(d => served.has(d))) continue;
    broken.forEach(d => served.add(d));
  }
  return served.size >= Math.min(sol.length + 1, dets.length);
}

// big: a deliberately complex level (many walls, detectors and permanent walls) for the menu backdrop
function generate_level(level_num, big = false)
{
  const diff = big ? 22 : Math.min(level_num, 14);
  for (let attempt = 0; attempt < 1000; ++attempt)
  {
    const lvl = try_generate(diff, big);
    if (lvl) return lvl;
  }
  throw new Error("could not generate a level");
}


// ---------- level personality ----------
// Each level picks a theme that shapes its permanent walls, and a formation for the lights, so
// levels read as designed spaces (pillar halls, rings, spokes, chambers...) instead of random scatter.

const THEMES = ['scatter', 'pillars', 'ring', 'spokes', 'chambers', 'slats', 'zigzag', 'mirror'];

function centre() { return {x: AREA_W / 2, y: AREA_H / 2, u: Math.min(AREA_W, AREA_H)}; }

function theme_walls(theme)
{
  const {x: cx, y: cy, u} = centre();
  const out = [];
  if (theme === 'pillars')
  {
    const cols = Math.max(2, Math.round(AREA_W / (u * 0.3))), rows = Math.max(2, Math.round(AREA_H / (u * 0.3)));
    const ang = pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]), half = rnd(16, 30), alt = Math.random() < 0.5;
    for (let i = 0; i < cols; ++i)
      for (let j = 0; j < rows; ++j)
      {
        const x = AREA_W * (i + 0.5) / cols, y = AREA_H * (j + 0.5) / rows;
        const a = alt && (i + j) % 2 ? ang + Math.PI / 2 : ang;
        out.push(seg(x - Math.cos(a) * half, y - Math.sin(a) * half, x + Math.cos(a) * half, y + Math.sin(a) * half));
      }
  }
  else if (theme === 'ring')
  {
    const sides = pick([6, 8, 10]), R = u * rnd(0.17, 0.27), a0 = rnd(0, Math.PI * 2);
    const gaps = new Set();
    while (gaps.size < 2) gaps.add(Math.floor(Math.random() * sides));
    for (let i = 0; i < sides; ++i)
    {
      if (gaps.has(i)) continue;
      const a = a0 + Math.PI * 2 * i / sides, b = a0 + Math.PI * 2 * (i + 1) / sides;
      out.push(seg(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(b) * R, cy + Math.sin(b) * R));
    }
    if (Math.random() < 0.5) // a small inner ring
    {
      const r2 = R * 0.45;
      for (let i = 0; i < 4; ++i)
      {
        if (i === 1) continue;
        const a = a0 + Math.PI / 2 * i, b = a0 + Math.PI / 2 * (i + 1);
        out.push(seg(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, cx + Math.cos(b) * r2, cy + Math.sin(b) * r2));
      }
    }
  }
  else if (theme === 'spokes')
  {
    const n = pick([3, 4, 5, 6]), a0 = rnd(0, Math.PI * 2), r0 = u * rnd(0.06, 0.12), r1 = u * rnd(0.26, 0.38);
    for (let i = 0; i < n; ++i)
    {
      const a = a0 + Math.PI * 2 * i / n;
      out.push(seg(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1));
    }
  }
  else if (theme === 'chambers')
  {
    const vertical = AREA_W >= AREA_H ? Math.random() < 0.75 : Math.random() < 0.25;
    const parts = pick([2, 3]);
    for (let k = 1; k < parts; ++k)
    {
      const t = k / parts;
      const door = rnd(0.35, 0.65), gap = rnd(0.1, 0.16);
      if (vertical)
      {
        const x = AREA_W * t;
        out.push(seg(x, AREA_H * 0.08, x, AREA_H * (door - gap)), seg(x, AREA_H * (door + gap), x, AREA_H * 0.92));
      }
      else
      {
        const y = AREA_H * t;
        out.push(seg(AREA_W * 0.08, y, AREA_W * (door - gap), y), seg(AREA_W * (door + gap), y, AREA_W * 0.92, y));
      }
    }
  }
  else if (theme === 'slats')
  {
    const n = pick([3, 4, 5]), ang = rnd(0, Math.PI), len = u * rnd(0.22, 0.34), spread = u * rnd(0.16, 0.22);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let i = 0; i < n; ++i)
    {
      const o = (i - (n - 1) / 2) * spread;
      const x = cx + nx * o, y = cy + ny * o, sh = (i % 2 ? 1 : -1) * len * 0.15;
      out.push(seg(x - Math.cos(ang) * len / 2 + sh, y - Math.sin(ang) * len / 2, x + Math.cos(ang) * len / 2 + sh, y + Math.sin(ang) * len / 2));
    }
  }
  else if (theme === 'zigzag')
  {
    const n = pick([4, 5, 6]), horizontal = AREA_W >= AREA_H, amp = u * rnd(0.12, 0.2);
    const span = (horizontal ? AREA_W : AREA_H) * 0.7, y0 = rnd(0.35, 0.65);
    const pts = [];
    for (let i = 0; i <= n; ++i)
    {
      const t = (i / n - 0.5) * span, o = (i % 2 ? 1 : -1) * amp / 2;
      pts.push(horizontal ? {x: cx + t, y: AREA_H * y0 + o} : {x: AREA_W * y0 + o, y: cy + t});
    }
    for (let i = 0; i < n; ++i) out.push(seg(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
  }
  else if (theme === 'mirror')
  {
    const n = floor_int(rnd(2, 4));
    for (let i = 0; i < n; ++i)
    {
      const c = rnd_point(50), ang = rnd(0, Math.PI), half = rnd(35, 90);
      out.push(seg(c.x - Math.cos(ang) * half, c.y - Math.sin(ang) * half, c.x + Math.cos(ang) * half, c.y + Math.sin(ang) * half));
    }
  }
  else
  {
    const n = floor_int(rnd(1, 4));
    for (let i = 0; i < n; ++i)
    {
      const c = rnd_point(50), ang = rnd(0, Math.PI), half = rnd(40, 100);
      out.push(seg(c.x - Math.cos(ang) * half, c.y - Math.sin(ang) * half, c.x + Math.cos(ang) * half, c.y + Math.sin(ang) * half));
    }
  }
  return out;
}

function floor_int(v) { return Math.floor(v); }

// reflect a set of walls (and keep the originals): left/right, top/bottom or half-turn
function mirrored(walls, kind)
{
  const f = kind === 'x' ? (x, y) => [AREA_W - x, y] : kind === 'y' ? (x, y) => [x, AREA_H - y] : (x, y) => [AREA_W - x, AREA_H - y];
  return walls.concat(walls.map(s => { const [a, b] = f(s.sx, s.sy), [c, d] = f(s.ex, s.ey); return seg(a, b, c, d); }));
}

// n light positions in a pattern, or null entries to be filled randomly
function light_formation(kind, n)
{
  const {x: cx, y: cy, u} = centre();
  const pts = [];
  if (kind === 'ring')
  {
    const r = u * rnd(0.2, 0.32), a0 = rnd(0, Math.PI * 2);
    for (let i = 0; i < n; ++i) pts.push({x: cx + Math.cos(a0 + Math.PI * 2 * i / n) * r, y: cy + Math.sin(a0 + Math.PI * 2 * i / n) * r});
  }
  else if (kind === 'line')
  {
    const a = pick([0, Math.PI / 2, Math.PI / 4]), gap = u * rnd(0.22, 0.34), ox = rnd(-0.1, 0.1) * AREA_W, oy = rnd(-0.1, 0.1) * AREA_H;
    for (let i = 0; i < n; ++i) pts.push({x: cx + ox + Math.cos(a) * gap * (i - (n - 1) / 2), y: cy + oy + Math.sin(a) * gap * (i - (n - 1) / 2)});
  }
  else if (kind === 'corners')
  {
    const m = Math.min(110, u * 0.2), cs = [[m, m], [AREA_W - m, m], [AREA_W - m, AREA_H - m], [m, AREA_H - m]];
    const start = floor_int(rnd(0, 4));
    for (let i = 0; i < n; ++i) pts.push({x: cs[(start + i) % 4][0], y: cs[(start + i) % 4][1]});
  }
  else for (let i = 0; i < n; ++i) pts.push(null);
  return pts;
}

const FORMATIONS = ['random', 'ring', 'line', 'corners'];

// ---------- light variants ----------
// classic: one light per color, lighting the whole room
// twins:   two lights share a color (walls have to shade both)
// local:   every light only reaches a limited radius
// mixed:   some lights are local, some fill the room
// anchored: some lights are bolted down, only walls can solve those
// crowd:   four or five lights, with repeated colors, usually a mix of local ones
const VARIANTS = ['classic', 'twins', 'local', 'mixed', 'anchored', 'crowd'];

function pick_variant(diff, big)
{
  if (big) return pick(['mixed', 'crowd', 'anchored']);
  if (diff < 2) return 'classic';
  if (diff < 4) return pick(['classic', 'twins', 'local', 'mixed']);
  return pick(VARIANTS);
}

function light_setup(variant, diff)
{
  const u = Math.min(AREA_W, AREA_H);
  const n = variant === 'crowd' ? (diff >= 9 && Math.random() < 0.4 ? 5 : 4) : (diff < 3 && variant !== 'twins' ? 2 : 3);
  const base = LIGHT_COLORS.slice().sort(() => Math.random() - 0.5);
  const colors = [];
  for (let i = 0; i < n; ++i) colors.push(i < 3 ? base[i] : pick(base));
  if (variant === 'twins') colors[1] = colors[0]; // lights 0 and 1 share a color, light 2 (if any) differs
  const local = new Set(), fixed = new Set();
  const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  if (variant === 'local') order.forEach(i => local.add(i));
  else if (variant === 'mixed') order.slice(0, Math.max(1, Math.floor(n / 2))).forEach(i => local.add(i));
  else if (variant === 'crowd') order.slice(0, Math.floor(n * 0.6)).forEach(i => local.add(i));
  else if (variant === 'anchored') order.slice(0, n > 2 && Math.random() < 0.4 ? 2 : 1).forEach(i => fixed.add(i));
  if (variant === 'anchored' && Math.random() < 0.5) local.add(order[order.length - 1]);
  return colors.map((c, i) => ({
    r: c[0], g: c[1], b: c[2],
    range: local.has(i) ? Math.round(u * rnd(0.3, 0.48) * (variant === 'crowd' ? 0.85 : 1)) : 0,
    fixed: fixed.has(i)
  }));
}

function try_generate(diff, big)
{
  const border = make_border();
  const hole_kind = Math.random() < (diff < 2 ? 0.3 : 0.6) ? pick(HOLE_KINDS) : null;
  const holes = hole_kind ? assign_hole_types(make_holes(hole_kind)) : [];
  set_border(border, holes);
  const perm = BORDER_SEGS.map(b => ({...b}));

  // generated permanent walls, shaped by the level's theme
  const theme = diff < 2 ? pick(['scatter', 'chambers', 'spokes']) : pick(THEMES);
  let themed = theme_walls(theme);
  const sym = theme === 'mirror' ? pick(['x', 'y', 'xy']) : (Math.random() < 0.15 ? pick(['x', 'y', 'xy']) : null);
  if (sym) themed = mirrored(themed, sym);
  const free_perm = [];
  const cap = big ? 14 : 10 + Math.floor(diff / 2);
  for (const s of themed)
  {
    if (free_perm.length >= cap) break;
    if (!inside(s.sx, s.sy, 15) || !inside(s.ex, s.ey, 15) || crosses_border(s)) continue;
    free_perm.push(s);
    perm.push(s);
  }
  if (free_perm.length < (theme === 'scatter' ? 0 : 2)) return null;

  // which parts of the floor can reach each other (holes and walls cut the level into islands)
  const space = analyze_space(perm, (x, y) => inside(x, y, 6));
  if (holes.length && space.free_n < space.total * 0.3) return null;

  // lights, in a pattern when one fits
  const lights = [];
  const variant = pick_variant(diff, big);
  const setup = light_setup(variant, diff);
  const n_lights = setup.length;
  const formation = pick(FORMATIONS);
  const form = light_formation(formation, n_lights);
  for (let i = 0; i < n_lights; ++i)
  {
    let placed = false;
    for (let k = 0; k < 100 && !placed; ++k)
    {
      const p = k === 0 && form[i] ? form[i] : rnd_point(25);
      if (!inside(p.x, p.y, 25)) continue;
      if (min_seg_dist(p.x, p.y, perm) < 30) continue;
      if (lights.some(l => Math.hypot(l.x - p.x, l.y - p.y) < (n_lights > 3 ? 70 : 90))) continue;
      if (holes.length && space.sizes[space.region(p.x, p.y)] < space.free_n * 0.08) continue; // not a sliver of an island
      const {r, g, b, range, fixed} = setup[i];
      lights.push({x: p.x, y: p.y, r, g, b, on: true, ...(range ? {range} : {}), ...(fixed ? {fixed: true} : {})});
      placed = true;
    }
    if (!placed) return null;
  }

  // the solution: player-built walls, chained from each other or from permanent walls
  const sol = [];
  const n_sol = Math.min(3 + Math.floor(diff / 2), big ? 10 : 7);
  for (let i = 0; i < n_sol; ++i)
  {
    for (let k = 0; k < 30; ++k)
    {
      let start;
      const roll = Math.random();
      if (sol.length && roll < 0.35)
      {
        const s = pick(sol);
        start = Math.random() < 0.5 ? {x: s.sx, y: s.sy} : {x: s.ex, y: s.ey};
      }
      else if (free_perm.length && roll < 0.6)
      {
        const s = pick(free_perm), t = rnd(0.2, 0.8);
        start = {x: s.sx + (s.ex - s.sx) * t, y: s.sy + (s.ey - s.sy) * t};
      }
      else start = rnd_point(25);

      const ang = rnd(0, Math.PI * 2), len = rnd(70, 220);
      const ex = start.x + Math.cos(ang) * len, ey = start.y + Math.sin(ang) * len;
      if (!inside(ex, ey, 10)) continue;
      const s = seg(start.x, start.y, ex, ey);
      if (lights.some(l => dist_point_segment(l.x, l.y, s) < 22)) continue;
      if (crosses_border(s)) continue;
      sol.push(s);
      break;
    }
  }
  if (sol.length === 0) return null;

  // detectors: only where the solution lights them in a color the bare room doesn't
  const all_sol = perm.concat(sol);
  const polys_bare = polys_for(lights, perm);
  const polys_sol = polys_for(lights, all_sol);
  const dets = [];
  const n_dets = Math.min(3 + Math.floor(diff / 2), big ? 14 : 9);
  // rare: shadow detectors (black) that must stay completely dark, lit by the bare room so a wall has to shade them
  const max_shadows = diff >= 3 && Math.random() < 0.3 ? (big ? 2 : 1 + (diff >= 8 && Math.random() < 0.3 ? 1 : 0)) : 0;
  let shadows = 0;
  for (let t = 0; t < 800 && dets.length < n_dets; ++t)
  {
    const p = rnd_point(10);
    if (min_seg_dist(p.x, p.y, all_sol) < 18) continue;
    if (lights.some(l => Math.hypot(l.x - p.x, l.y - p.y) < 40)) continue;
    if (dets.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 60)) continue;
    const c = robust_color(polys_sol, lights, p.x, p.y);
    if (!c) continue;
    const dark = c.r + c.g + c.b === 0;
    if (dark && shadows >= max_shadows) continue;
    if (same_color(c, color_at_polys(polys_bare, lights, p.x, p.y))) continue;
    if (dark) ++shadows;
    dets.push({x: p.x, y: p.y, r: c.r, g: c.g, b: c.b, lit: false});
  }
  if (dets.length < (big ? 8 : diff >= 3 ? 3 : 2) || dets.length === shadows) return null;

  // drop solution walls that aren't needed
  let changed = true;
  while (changed)
  {
    changed = false;
    for (let i = sol.length - 1; i >= 0; --i)
    {
      const pp = polys_for(lights, perm.concat(sol.filter((_, j) => j !== i)));
      if (dets.every(d => { const c = robust_color(pp, lights, d.x, d.y); return c && same_color(c, d); }))
      {
        sol.splice(i, 1);
        changed = true;
      }
    }
  }
  // the bar for "needs enough walls" rises with the level; every kept wall is necessary
  const min_walls = big ? 5 : diff < 2 ? 1 : diff < 5 ? 2 : diff < 9 ? 3 : 4;
  if (sol.length < min_walls) return null;
  // every wall has to matter in a different place: reject solutions that are just one wall repeated
  if (sol.length > 1 && !dets_need_distinct_walls(lights, perm, sol, dets)) return null;

  // scramble the lights, into a (different) pattern when one fits
  const start_form = light_formation(pick(FORMATIONS), lights.length);
  const start_lights = lights.map((l, i) => {
    for (let k = 0; k < 100; ++k)
    {
      const p = k === 0 && start_form[i] ? start_form[i] : rnd_point(25);
      if (l.fixed) break;
      if (inside(p.x, p.y, 25) && space.region(p.x, p.y) === space.region(l.x, l.y) && min_seg_dist(p.x, p.y, perm) >= 30 && dets.every(d => Math.hypot(d.x - p.x, d.y - p.y) >= 40))
        return {...l, x: p.x, y: p.y, on: Math.random() > 0.3};
    }
    return {...l, on: l.fixed ? Math.random() > 0.3 : l.on};
  });
  const pp = polys_for(start_lights, perm);
  if (dets.every(d => same_color(color_at_polys(pp, start_lights, d.x, d.y), d))) return null;
  // the opening position should be mostly wrong, and shouldn't be fixable by just flipping switches
  const start_ok = dets.filter(d => same_color(color_at_polys(pp, start_lights, d.x, d.y), d)).length;
  if (diff >= 2 && start_ok > Math.ceil(dets.length * 0.4)) return null;
  if (diff >= 3 && solvable_by_toggling(start_lights, perm, dets)) return null;

  return {
    w: AREA_W,
    h: AREA_H,
    seed: Math.floor(Math.random() * 1e9),
    theme,
    variant,
    border,
    holes,
    perm_walls: perm,
    lights: start_lights,
    detectors: dets,
    solution: {walls: sol, lights: lights.map(l => ({...l}))},
    budget: sol.length
  };
}
