// Per-level generative floor. Each level picks one primary fractal family (squares, circles,
// triangles, hex cells, coral, or one of the extras in floor_extra.js), a random symmetry transform, and a couple of secondary
// overlays. Everything is drawn very close to the floor color so it reads as background.
// Returns a p5.Graphics sized to the board, clipped to the level border.

function make_floor_art(w, h, border, palette, seed, holes = [])
{
  randomSeed(seed); // same seed => same floor, so saved games restore their background
  const g = createGraphics(w, h);
  g.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  g.background(palette.outside);

  // very subtle colour: a per-level accent pair tints the floor and its lines
  FLOOR_ACCENT = random(FLOOR_ACCENTS);
  const base = [37, 37, 41].map((v, i) => v + (FLOOR_ACCENT[0][i] - 100) * 0.07);
  const line_col = accent_line(g, 0.32);

  // fill and clip to the irregular border
  const ctx = g.drawingContext;
  ctx.save();
  ctx.beginPath();
  border.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fill();
  ctx.clip();

  const families = [fractal_squares, fractal_circles, fractal_triangles, hex_cells, coral, ...FLOOR_EXTRA_FAMILIES];
  const primary = random(families);
  const overlays = shuffle([ribbed_squares, veins, concentric_arcs, speckle, ...FLOOR_EXTRA_OVERLAYS]).slice(0, floor(random(1, 3)));

  color_wash(g, w, h, line_col);

  // draw the primary pattern on an oversized area so rotation, stretching and mirroring leave no gaps
  const size = Math.hypot(w, h) * 1.3;
  g.push();
  g.translate(w / 2, h / 2);
  draw_symmetric(g, primary, size, line_col);
  g.pop();

  // sometimes a second, fainter family on top at a different angle
  if (random() < 0.3)
  {
    const second = random(families.filter(f => f !== primary));
    g.push();
    g.translate(w / 2, h / 2);
    g.rotate(random(TWO_PI));
    second(g, -size / 2, -size / 2, size, size, a => line_col(a * 0.55));
    g.pop();
  }

  for (const f of overlays) f(g, w, h, line_col);
  // lived-in grime and alien details on top
  for (const f of shuffle(DECOR_OVERLAYS.slice()).slice(0, floor(random(3, 6)))) f(g, w, h, decor_line(g));

  draw_holes(g, holes);

  ctx.restore();
  randomSeed(Math.floor(Math.random() * 1e9));
  return g;
}

function fractal_squares(g, x0, y0, w, h, line_col)
{
  const cell = random(110, 200);
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const cw = w / cols, ch = h / rows;
  const eager = random(0.45, 0.8);
  const style = random(['round', 'round', 'diamond', 'cut']);

  const plate = (x, y, sx, sy, depth) =>
  {
    const inset = Math.min(sx, sy) * 0.07;
    g.stroke(line_col(34 - depth * 5));
    g.strokeWeight(Math.max(0.6, 1.6 - depth * 0.3));
    if (random() < 0.5) g.fill(255, 255, 255, random(1, 5)); else g.noFill();
    const px = x + inset, py = y + inset, pw = sx - 2 * inset, ph = sy - 2 * inset;
    if (style === 'diamond' && depth % 2 === 1)
    {
      g.quad(px + pw / 2, py, px + pw, py + ph / 2, px + pw / 2, py + ph, px, py + ph / 2);
    }
    else if (style === 'cut')
    {
      const c = Math.min(pw, ph) * random(0.1, 0.3);
      g.beginShape();
      g.vertex(px + c, py); g.vertex(px + pw, py); g.vertex(px + pw, py + ph - c);
      g.vertex(px + pw - c, py + ph); g.vertex(px, py + ph); g.vertex(px, py + c);
      g.endShape(CLOSE);
    }
    else
    {
      const r = Math.min(sx, sy) * random(0.04, 0.22);
      g.rect(px, py, pw, ph, r, r * 0.3, r, r * 0.3);
    }

    if (depth < 4 && Math.min(sx, sy) > 26 && random() < eager - depth * 0.1)
    {
      const hx = sx / 2, hy = sy / 2;
      for (const [ox, oy] of [[0, 0], [hx, 0], [0, hy], [hx, hy]])
        if (random() < 0.85) plate(x + ox, y + oy, hx, hy, depth + 1);
    }
    else if (random() < 0.25)
    {
      g.noStroke();
      g.fill(line_col(28));
      g.circle(x + sx / 2, y + sy / 2, Math.min(sx, sy) * 0.14);
    }
  };

  for (let i = 0; i < cols; ++i)
    for (let j = 0; j < rows; ++j)
      plate(x0 + i * cw, y0 + j * ch, cw, ch, 0);
}

function angle_diff(a, b) { return atan2(sin(a - b), cos(a - b)); }

// a circle with smaller circles budding around its rim, recursively
function fractal_circles(g, x0, y0, w, h, line_col)
{
  const bud = (x, y, r, depth, from_ang) =>
  {
    g.stroke(line_col(34 - depth * 6));
    g.strokeWeight(Math.max(0.6, 1.6 - depth * 0.35));
    if (random() < 0.4) g.fill(255, 255, 255, random(1, 4)); else g.noFill();
    g.circle(x, y, r * 2);
    if (depth > 0 && random() < 0.5) { g.noFill(); g.circle(x, y, r * 1.35); }
    if (depth >= 3 || r < 10) { g.noStroke(); g.fill(line_col(30)); g.circle(x, y, r * 0.3); return; }
    const n = floor(random(3, 7));
    const child_r = r * random(0.28, 0.42);
    for (let i = 0; i < n; ++i)
    {
      const a = from_ang + (i + 0.5) * TWO_PI / n + random(-0.15, 0.15);
      if (depth > 0 && abs(angle_diff(a, from_ang + PI)) < 0.5) continue; // don't fold back onto the parent
      bud(x + cos(a) * (r + child_r * 0.9), y + sin(a) * (r + child_r * 0.9), child_r, depth + 1, a);
    }
  };
  const step = random(220, 320);
  for (let x = x0; x < x0 + w; x += step)
    for (let y = y0; y < y0 + h; y += step)
      bud(x + random(-40, 40), y + random(-40, 40), random(34, 60), 0, random(TWO_PI));
}

// Sierpinski-ish nested triangles
function fractal_triangles(g, x0, y0, w, h, line_col)
{
  const tri = (ax, ay, bx, by, cx, cy, depth) =>
  {
    g.stroke(line_col(34 - depth * 6));
    g.strokeWeight(Math.max(0.6, 1.5 - depth * 0.3));
    if (random() < 0.35) g.fill(255, 255, 255, random(1, 4)); else g.noFill();
    g.triangle(ax, ay, bx, by, cx, cy);
    if (depth >= 4 || Math.hypot(bx - ax, by - ay) < 30) return;
    const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
    if (random() < 0.9) tri(ax, ay, abx, aby, cax, cay, depth + 1);
    if (random() < 0.9) tri(abx, aby, bx, by, bcx, bcy, depth + 1);
    if (random() < 0.9) tri(cax, cay, bcx, bcy, cx, cy, depth + 1);
    if (random() < 0.35) tri(abx, aby, bcx, bcy, cax, cay, depth + 1);
  };
  const s = random(150, 230), hh = s * 0.866;
  for (let j = 0, y = y0; y < y0 + h; y += hh, ++j)
    for (let x = x0 - (j % 2) * s / 2; x < x0 + w; x += s)
    {
      tri(x, y + hh, x + s, y + hh, x + s / 2, y, 0);
      tri(x + s / 2, y, x + s * 1.5, y, x + s, y + hh, 0);
    }
}

// honeycomb whose cells recursively sprout smaller inner cells
function hex_cells(g, x0, y0, w, h, line_col)
{
  const hexagon = (cx, cy, r, depth, rot) =>
  {
    g.stroke(line_col(34 - depth * 7));
    g.strokeWeight(Math.max(0.6, 1.5 - depth * 0.4));
    if (random() < 0.3) g.fill(255, 255, 255, random(1, 4)); else g.noFill();
    g.beginShape();
    for (let i = 0; i < 6; ++i) g.vertex(cx + cos(rot + i * PI / 3) * r, cy + sin(rot + i * PI / 3) * r);
    g.endShape(CLOSE);
    if (depth < 2 && random() < 0.55)
    {
      hexagon(cx, cy, r * 0.62, depth + 1, rot + (random() < 0.5 ? PI / 6 : 0));
      if (random() < 0.4)
        for (let i = 0; i < 6; ++i)
          if (random() < 0.5)
            g.line(cx + cos(rot + i * PI / 3) * r * 0.62, cy + sin(rot + i * PI / 3) * r * 0.62,
                   cx + cos(rot + i * PI / 3) * r, cy + sin(rot + i * PI / 3) * r);
    }
  };
  const r = random(55, 95), dx = r * 1.5, dy = r * 0.866 * 2;
  for (let i = 0, x = x0; x < x0 + w; x += dx, ++i)
    for (let y = y0 + (i % 2) * dy / 2; y < y0 + h; y += dy)
      hexagon(x, y, r, 0, 0);
}

// branching, curling growth like coral / lung tissue
function coral(g, x0, y0, w, h, line_col)
{
  const grow = (x, y, a, len, depth) =>
  {
    g.noFill();
    g.stroke(line_col(38 - depth * 7));
    g.strokeWeight(Math.max(0.7, 2.2 - depth * 0.5));
    const bend = random(-0.5, 0.5);
    g.beginShape();
    g.curveVertex(x, y);
    g.curveVertex(x, y);
    for (let i = 0; i < 6; ++i)
    {
      a += bend * 0.35 + random(-0.1, 0.1);
      x += cos(a) * len / 6; y += sin(a) * len / 6;
      g.curveVertex(x, y);
    }
    g.curveVertex(x, y);
    g.endShape();
    g.noStroke(); g.fill(line_col(46));
    g.circle(x, y, Math.max(3, 8 - depth * 2));
    if (depth < 3 && len > 24)
    {
      const kids = random() < 0.5 ? 2 : 3;
      for (let k = 0; k < kids; ++k)
        grow(x, y, a + (k - (kids - 1) / 2) * random(0.5, 0.9), len * random(0.55, 0.75), depth + 1);
    }
  };
  const n = floor(random(10, 20));
  for (let i = 0; i < n; ++i) grow(x0 + random(w), y0 + random(h), random(TWO_PI), random(60, 120), 0);
}

function ribbed_squares(g, w, h, line_col)
{
  const n = floor(random(2, 5));
  for (let k = 0; k < n; ++k)
  {
    const size = random(120, 260);
    const cx = random(0, w), cy = random(0, h);
    const rings = floor(random(4, 9));
    g.noFill();
    g.strokeWeight(1);
    for (let i = 0; i < rings; ++i)
    {
      const s = size - i * (size / rings);
      g.stroke(line_col(26 - i * 2));
      const x = cx - s / 2, y = cy - s / 2;
      const sides = [[x, y, x + s, y], [x + s, y, x + s, y + s], [x + s, y + s, x, y + s], [x, y + s, x, y]];
      for (const [a, b, c, d] of sides)
        if (random() < 0.8) g.line(a, b, c, d);
    }
  }
}

function concentric_arcs(g, w, h, line_col)
{
  const n = floor(random(2, 5));
  for (let k = 0; k < n; ++k)
  {
    const cx = random(w), cy = random(h), rings = floor(random(4, 10));
    g.noFill();
    for (let i = 1; i <= rings; ++i)
    {
      g.stroke(line_col(28 - i * 1.5));
      g.strokeWeight(1);
      const start = random(TWO_PI);
      g.arc(cx, cy, i * 26, i * 26, start, start + random(PI * 0.4, PI * 1.5));
    }
  }
}

function veins(g, w, h, line_col)
{
  const seeds = floor(random(5, 11));
  const dirs = [0, QUARTER_PI, HALF_PI, QUARTER_PI * 3, PI, QUARTER_PI * 5, PI + HALF_PI, QUARTER_PI * 7];

  const grow = (x, y, di, steps, depth) =>
  {
    g.strokeWeight(depth === 0 ? 1.6 : 1);
    g.stroke(line_col(40 - depth * 8));
    for (let i = 0; i < steps; ++i)
    {
      const len = random(14, 40);
      const nx = x + Math.cos(dirs[di]) * len, ny = y + Math.sin(dirs[di]) * len;
      g.line(x, y, nx, ny);
      x = nx; y = ny;
      if (random() < 0.4) di = (di + (random() < 0.5 ? 1 : 7)) % 8;
      if (depth < 2 && random() < 0.12) grow(x, y, (di + (random() < 0.5 ? 2 : 6)) % 8, floor(steps / 2), depth + 1);
    }
    g.noStroke();
    g.fill(line_col(50));
    g.circle(x, y, depth === 0 ? 7 : 4);
    g.noFill();
  };

  for (let i = 0; i < seeds; ++i)
    grow(random(w), random(h), floor(random(8)), floor(random(5, 12)), 0);
}

// fine dust of tiny dots
function speckle(g, w, h, line_col)
{
  g.noStroke();
  g.fill(line_col(22));
  const n = floor(random(150, 400));
  for (let i = 0; i < n; ++i) g.circle(random(w), random(h), random(1, 2.6));
}
