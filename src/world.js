// Free-form level data: points, walls between points, lights, detectors.
// Permanent points/walls (outside border, generated walls) can't be removed and show no markers.
// A wall can be attached to a permanent wall: that splits it with a "junction" point, which
// disappears (and re-merges the permanent wall) once nothing is attached to it.

const SNAP_RADIUS = 14;
const WALL_TOL = 7;

class World
{
  constructor()
  {
    this.points = [];      // {id, x, y, perm, junction}
    this.walls = [];       // {a, b, perm} point ids
    this.lights = [];      // {x, y, r, g, b, on}
    this.detectors = [];   // {x, y, r, g, b, lit}
    this.holes = [];       // polygons of {x, y}: voids in the floor
    this.next_id = 1;
  }

  in_hole(x, y) { return this.holes.some(h => point_in_polygon(x, y, h)); }

  over_hole(x1, y1, x2, y2) { return segment_hits_hole(x1, y1, x2, y2, this.holes); }

  add_point(x, y, perm = false)
  {
    const p = {id: this.next_id++, x, y, perm, junction: false};
    this.points.push(p);
    return p;
  }

  get_point(id) { return this.points.find(p => p.id === id); }

  nearest(pred, x, y, radius)
  {
    let best = null, best_d = radius;
    for (const p of this.points)
    {
      if (!pred(p)) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= best_d) { best = p; best_d = d; }
    }
    return best;
  }

  // any point, including permanent ones (walls can start/end on them)
  point_at(x, y, radius = SNAP_RADIUS) { return this.nearest(() => true, x, y, radius); }

  // only points the player can remove
  user_point_at(x, y, radius = SNAP_RADIUS) { return this.nearest(p => !p.perm, x, y, radius); }

  add_perm_wall(x1, y1, x2, y2, straight = false)
  {
    const a = this.nearest(p => p.perm, x1, y1, 0.01) || this.add_point(x1, y1, true);
    const b = this.nearest(p => p.perm, x2, y2, 0.01) || this.add_point(x2, y2, true);
    this.walls.push({a: a.id, b: b.id, perm: true, straight});
  }

  perm_wall_at(x, y, tol = WALL_TOL)
  {
    let best = null, best_d = tol;
    for (const w of this.walls)
    {
      if (!w.perm) continue;
      const a = this.get_point(w.a), b = this.get_point(w.b);
      const hit = project_on_segment(x, y, {sx: a.x, sy: a.y, ex: b.x, ey: b.y});
      if (hit.d <= best_d) { best = {wall: w, x: hit.x, y: hit.y}; best_d = hit.d; }
    }
    return best;
  }

  // existing point near (x, y), or a new junction on a permanent wall, or null
  anchor_at(x, y, snap = SNAP_RADIUS, wall_tol = WALL_TOL)
  {
    const p = this.point_at(x, y, snap);
    if (p) return p;
    const hit = this.perm_wall_at(x, y, wall_tol);
    if (!hit) return null;
    const j = this.add_point(hit.x, hit.y);
    j.junction = true;
    this.walls = this.walls.filter(w => w !== hit.wall);
    const st = hit.wall.straight;
    this.walls.push({a: hit.wall.a, b: j.id, perm: true, straight: st}, {a: j.id, b: hit.wall.b, perm: true, straight: st});
    return j;
  }

  add_wall(p1, p2)
  {
    if (p1.id === p2.id) return false;
    if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 12) return false;
    if (this.over_hole(p1.x, p1.y, p2.x, p2.y)) return false;
    if (this.walls.some(w => !w.perm && ((w.a === p1.id && w.b === p2.id) || (w.a === p2.id && w.b === p1.id)))) return false;
    this.walls.push({a: p1.id, b: p2.id, perm: false});
    return true;
  }

  user_wall_count() { return this.walls.filter(w => !w.perm).length; }

  has_user_wall(p) { return this.walls.some(w => !w.perm && (w.a === p.id || w.b === p.id)); }

  // removes a non-permanent point, re-merging the permanent wall if it was a junction
  drop_point(p)
  {
    if (p.junction)
    {
      const pw = this.walls.filter(w => w.perm && (w.a === p.id || w.b === p.id));
      if (pw.length === 2)
      {
        const ends = pw.map(w => (w.a === p.id ? w.b : w.a));
        this.walls = this.walls.filter(w => !pw.includes(w));
        this.walls.push({a: ends[0], b: ends[1], perm: true, straight: pw[0].straight});
      }
    }
    this.points = this.points.filter(q => q.id !== p.id);
  }

  // removes the point and its walls; neighbors left with no walls go too
  remove_point(p)
  {
    if (p.perm) return;
    const neighbors = this.walls
      .filter(w => !w.perm && (w.a === p.id || w.b === p.id))
      .map(w => this.get_point(w.a === p.id ? w.b : w.a));
    this.walls = this.walls.filter(w => w.perm || (w.a !== p.id && w.b !== p.id));
    this.drop_point(p);
    for (const q of neighbors)
      if (q && !q.perm && !this.has_user_wall(q)) this.drop_point(q);
  }

  // no wall end is ever left dangling
  prune_orphans()
  {
    for (const p of this.points.slice())
      if (!p.perm && !this.has_user_wall(p)) this.drop_point(p);
  }

  clear_user()
  {
    this.walls = this.walls.filter(w => w.perm);
    this.prune_orphans();
  }

  // wall segments; lights and drawing both use these
  segments()
  {
    return this.walls.map(w =>
    {
      const a = this.get_point(w.a), b = this.get_point(w.b);
      return {sx: a.x, sy: a.y, ex: b.x, ey: b.y, perm: w.perm};
    });
  }

  light_at(x, y, radius = 16)
  {
    return this.lights.find(l => Math.hypot(l.x - x, l.y - y) <= radius) || null;
  }

  // Moves a light toward (x, y) in small steps. A step that would hit a wall, hole edge or detector
  // is pushed back out along the obstacle's normal, so the light slides along it at any angle
  // instead of locking to an axis. Returns false when the light couldn't make progress.
  move_light(l, x, y, bounds, margin, clearance = 9, det_clearance = 26)
  {
    const obstacles = this.segments().concat(this.holes.flatMap(poly_edges));
    const inside_bounds = (px, py) => px >= margin && px <= bounds.w - margin && py >= margin && py <= bounds.h - margin;
    const clamp = (px, py) => [Math.min(bounds.w - margin, Math.max(margin, px)), Math.min(bounds.h - margin, Math.max(margin, py))];
    // detectors a light already overlaps don't trap it
    const dets = this.detectors.filter(d => Math.hypot(d.x - l.x, d.y - l.y) >= det_clearance);

    const resolve = (px, py) =>
    {
      for (let pass = 0; pass < 4; ++pass)
      {
        let moved = false;
        for (const s of obstacles)
        {
          const hit = project_on_segment(px, py, s);
          if (hit.d >= clearance) continue;
          const nx = hit.d > 1e-6 ? (px - hit.x) / hit.d : -(s.ey - s.sy), ny = hit.d > 1e-6 ? (py - hit.y) / hit.d : s.ex - s.sx;
          const len = Math.hypot(nx, ny) || 1;
          px = hit.x + nx / len * clearance;
          py = hit.y + ny / len * clearance;
          moved = true;
        }
        for (const d of dets)
        {
          const dd = Math.hypot(px - d.x, py - d.y);
          if (dd >= det_clearance) continue;
          const ux = dd > 1e-6 ? (px - d.x) / dd : 1, uy = dd > 1e-6 ? (py - d.y) / dd : 0;
          px = d.x + ux * det_clearance;
          py = d.y + uy * det_clearance;
          moved = true;
        }
        [px, py] = clamp(px, py);
        if (!moved) break;
      }
      return [px, py];
    };
    const valid = (px, py) =>
      inside_bounds(px, py) && !this.in_hole(px, py) &&
      obstacles.every(s => dist_point_segment(px, py, s) >= clearance - 0.01) &&
      dets.every(d => Math.hypot(px - d.x, py - d.y) >= det_clearance - 0.01);

    const dist = Math.hypot(x - l.x, y - l.y);
    const steps = Math.min(160, Math.ceil(dist / 3) * 2);
    let progressed = false;
    for (let i = 0; i < steps; ++i)
    {
      const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy);
      if (d < 0.5) break;
      const k = Math.min(3, d) / d;
      let [nx, ny] = resolve(l.x + dx * k, l.y + dy * k);
      if (!valid(nx, ny) || obstacles.some(s => segments_intersect(l.x, l.y, nx, ny, s))) break;
      if (Math.hypot(nx - l.x, ny - l.y) < 0.05) break;
      l.x = nx; l.y = ny;
      progressed = true;
    }
    return progressed;
  }

  // moves a user point toward (x, y), staying inside the border and keeping its walls clear of
  // lights, detectors, permanent walls and a minimum length; slides along an axis if blocked.
  // Junction points on permanent walls are fixed.
  move_point(p, x, y, border, clearance = 12)
  {
    if (p.perm || p.junction) return false;
    const mine = this.walls.filter(w => !w.perm && (w.a === p.id || w.b === p.id));
    const others = mine.map(w => this.get_point(w.a === p.id ? w.b : w.a));
    const perm_segs = this.segments().filter(s => s.perm);
    const ok = (nx, ny) =>
      point_in_polygon(nx, ny, border) && !this.in_hole(nx, ny) &&
      perm_segs.every(s => dist_point_segment(nx, ny, s) >= 10) &&
      others.every(q => Math.hypot(q.x - nx, q.y - ny) >= 12 && !this.over_hole(q.x, q.y, nx, ny)) &&
      others.every(q =>
      {
        const s = {sx: q.x, sy: q.y, ex: nx, ey: ny};
        return this.lights.every(l => dist_point_segment(l.x, l.y, s) >= clearance) &&
               this.detectors.every(d => dist_point_segment(d.x, d.y, s) >= clearance);
      });
    for (const [nx, ny] of [[x, y], [x, p.y], [p.x, y]])
    {
      if (ok(nx, ny)) { p.x = nx; p.y = ny; return true; }
    }
    return false;
  }

  // a detector is lit when the summed color of the lights reaching it matches its color
  update_detectors(bounds, radius)
  {
    const segs = this.segments();
    const polys = this.lights.map(l => l.on ? visible_polygon(l.x, l.y, radius, segs, bounds) : null);
    for (const d of this.detectors)
    {
      const c = color_at_polys(polys, this.lights, d.x, d.y);
      d.lit = c.r === d.r && c.g === d.g && c.b === d.b;
    }
    return polys;
  }
}
