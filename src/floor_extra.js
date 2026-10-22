// More floor art: extra fractal families, extra overlays, a subtle per-level colour scheme and
// the symmetry / stretch transforms applied to the primary pattern.
// Families share the signature (g, x0, y0, w, h, line_col); overlays are (g, w, h, line_col).

// [accent, secondary accent] - muted so the floor stays dark and the holes' glow still stands out
const FLOOR_ACCENTS = [
  [[70, 140, 150], [120, 110, 170]],  // teal / violet
  [[150, 105, 70], [150, 140, 80]],   // rust / ochre
  [[110, 95, 165], [160, 90, 130]],   // violet / rose
  [[95, 145, 100], [70, 140, 150]],   // moss / teal
  [[160, 85, 110], [150, 105, 70]],   // rose / rust
  [[85, 120, 170], [90, 150, 130]],   // steel blue / sea green
  [[140, 140, 150], [110, 120, 150]], // near neutral
];
let FLOOR_ACCENT = FLOOR_ACCENTS[0];

const GRAY_LINE = [60, 62, 70];
const mix_rgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// the line colour function for a floor: gray pulled toward the accent, now and then the second accent
function accent_line(g, strength)
{
  const c1 = mix_rgb(GRAY_LINE, FLOOR_ACCENT[0], strength), c2 = mix_rgb(GRAY_LINE, FLOOR_ACCENT[1], strength);
  return a => { const c = random() < 0.2 ? c2 : c1; return g.color(c[0], c[1], c[2], a); };
}

// ---------- families ----------

function sierpinski_carpet(g, x0, y0, w, h, line_col)
{
  const maxd = random() < 0.5 ? 3 : 2;
  const carpet = (x, y, s, d) =>
  {
    g.stroke(line_col(34 - d * 6));
    g.strokeWeight(Math.max(0.6, 1.5 - d * 0.3));
    if (random() < 0.5) g.fill(line_col(5)); else g.noFill();
    g.rect(x + s / 3, y + s / 3, s / 3, s / 3);
    if (d >= maxd || s < 40) return;
    for (let i = 0; i < 3; ++i)
      for (let j = 0; j < 3; ++j)
        if ((i !== 1 || j !== 1) && random() < 0.92) carpet(x + i * s / 3, y + j * s / 3, s / 3, d + 1);
  };
  const s = random(170, 270);
  for (let x = x0; x < x0 + w; x += s)
    for (let y = y0; y < y0 + h; y += s)
    {
      g.stroke(line_col(26)); g.strokeWeight(1); g.noFill();
      g.rect(x, y, s, s);
      carpet(x, y, s, 0);
    }
}

function koch_flakes(g, x0, y0, w, h, line_col)
{
  const depth = random() < 0.5 ? 3 : 2;
  const flake = (cx, cy, r, rot, d) =>
  {
    let pts = [0, 1, 2].map(i => [cx + cos(rot + i * TWO_PI / 3) * r, cy + sin(rot + i * TWO_PI / 3) * r]);
    for (let k = 0; k < depth; ++k)
    {
      const next = [];
      for (let i = 0; i < pts.length; ++i)
      {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        const dx = (bx - ax) / 3, dy = (by - ay) / 3;
        const p1 = [ax + dx, ay + dy], p2 = [ax + 2 * dx, ay + 2 * dy];
        const peak = [p1[0] + dx * 0.5 + dy * 0.866, p1[1] + dy * 0.5 - dx * 0.866];
        next.push([ax, ay], p1, peak, p2);
      }
      pts = next;
    }
    g.stroke(line_col(36 - d * 8));
    g.strokeWeight(Math.max(0.6, 1.5 - d * 0.4));
    if (random() < 0.4) g.fill(line_col(6)); else g.noFill();
    g.beginShape();
    for (const p of pts) g.vertex(p[0], p[1]);
    g.endShape(CLOSE);
    if (d < 2 && random() < 0.6) flake(cx, cy, r * 0.5, rot + PI / 6 * (random() < 0.5 ? 1 : 2), d + 1);
  };
  const step = random(220, 300);
  for (let x = x0; x < x0 + w; x += step)
    for (let y = y0; y < y0 + h; y += step)
      flake(x + random(-25, 25), y + random(-25, 25), random(70, 115), random(TWO_PI), 0);
}

function hilbert_xy(n, d)
{
  let x = 0, y = 0, t = d;
  for (let s = 1; s < n; s *= 2)
  {
    const rx = 1 & (t >> 1), ry = 1 & (t ^ rx);
    if (ry === 0)
    {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      [x, y] = [y, x];
    }
    x += s * rx; y += s * ry;
    t >>= 2;
  }
  return [x, y];
}

// tiles of Hilbert curves, each turned a random quarter
function hilbert_tiles(g, x0, y0, w, h, line_col)
{
  const order = random() < 0.5 ? 3 : 4, n = 1 << order;
  const s = random(170, 250), cell = s / n;
  g.noFill();
  for (let x = x0; x < x0 + w; x += s)
    for (let y = y0; y < y0 + h; y += s)
    {
      g.push();
      g.translate(x + s / 2, y + s / 2);
      g.rotate(floor(random(4)) * HALF_PI);
      if (random() < 0.5) g.scale(-1, 1);
      g.stroke(line_col(34));
      g.strokeWeight(order === 3 ? 1.5 : 1.1);
      g.beginShape();
      for (let d = 0; d < n * n; ++d)
      {
        const [hx, hy] = hilbert_xy(n, d);
        g.vertex((hx + 0.5) * cell - s / 2, (hy + 0.5) * cell - s / 2);
      }
      g.endShape();
      g.pop();
    }
}

// sunflower spirals of dots at the golden angle
function phyllotaxis(g, x0, y0, w, h, line_col)
{
  const ga = PI * (3 - Math.sqrt(5));
  const rings = random() < 0.4;
  const n = Math.round(w * h / 90000 * random(0.8, 1.3));
  for (let k = 0; k < n; ++k)
  {
    const cx = x0 + random(w), cy = y0 + random(h), c = random(6, 9), count = floor(random(120, 280));
    for (let i = 1; i < count; ++i)
    {
      const r = c * Math.sqrt(i), a = i * ga, size = 1.5 + (i / count) * 5.5;
      const x = cx + cos(a) * r, y = cy + sin(a) * r;
      if (rings) { g.noFill(); g.stroke(line_col(32)); g.strokeWeight(1); }
      else { g.noStroke(); g.fill(line_col(30)); }
      g.circle(x, y, size);
    }
  }
}

// symmetrical branching trees
function fractal_trees(g, x0, y0, w, h, line_col)
{
  const branch = (x, y, a, len, d, spread) =>
  {
    const ex = x + cos(a) * len, ey = y + sin(a) * len;
    g.stroke(line_col(40 - d * 4));
    g.strokeWeight(Math.max(0.6, 2 - d * 0.3));
    g.line(x, y, ex, ey);
    if (d >= 6 || len < 7) { g.noStroke(); g.fill(line_col(40)); g.circle(ex, ey, 3); return; }
    branch(ex, ey, a - spread + random(-0.08, 0.08), len * random(0.68, 0.78), d + 1, spread);
    branch(ex, ey, a + spread + random(-0.08, 0.08), len * random(0.68, 0.78), d + 1, spread);
  };
  const n = Math.round(w * h / 110000 * random(0.8, 1.3));
  for (let i = 0; i < n; ++i)
    branch(x0 + random(w), y0 + random(h), random(TWO_PI), random(50, 85), 0, random(0.35, 0.7));
}

// loosely packed circles of every size, some with inner rings
function circle_packing(g, x0, y0, w, h, line_col)
{
  const circles = [];
  const wanted = 380;
  for (let tries = 0; tries < 5000 && circles.length < wanted; ++tries)
  {
    const r = 5 + Math.pow(random(), 2.2) * 70;
    const x = x0 + random(w), y = y0 + random(h);
    if (circles.every(c => Math.hypot(c.x - x, c.y - y) > c.r + r + 5)) circles.push({x, y, r});
  }
  for (const c of circles)
  {
    g.stroke(line_col(34));
    g.strokeWeight(c.r > 30 ? 1.5 : 1);
    if (random() < 0.3) g.fill(line_col(6)); else g.noFill();
    g.circle(c.x, c.y, c.r * 2);
    if (c.r > 14 && random() < 0.5) { g.noFill(); g.stroke(line_col(24)); g.circle(c.x, c.y, c.r * 1.2); }
    if (c.r > 22 && random() < 0.4) { g.noStroke(); g.fill(line_col(32)); g.circle(c.x, c.y, c.r * 0.2); }
  }
}

// grid of star polygons {n/k} that nest inside themselves
function star_rosettes(g, x0, y0, w, h, line_col)
{
  const s = random(120, 180), r0 = s * 0.46;
  const star = (cx, cy, r, n, k, rot, d) =>
  {
    g.stroke(line_col(36 - d * 7));
    g.strokeWeight(Math.max(0.6, 1.4 - d * 0.3));
    const P = [];
    for (let i = 0; i < n; ++i) P.push([cx + cos(rot + i * TWO_PI / n) * r, cy + sin(rot + i * TWO_PI / n) * r]);
    for (let i = 0; i < n; ++i) g.line(P[i][0], P[i][1], P[(i + k) % n][0], P[(i + k) % n][1]);
    if (d === 0) { g.noFill(); g.circle(cx, cy, r * 2); }
    if (d < 2) star(cx, cy, r * 0.5, n, k, rot + PI / n, d + 1);
  };
  const kinds = [[5, 2], [6, 2], [8, 3], [10, 3], [12, 5], [8, 2]];
  const [n1, k1] = random(kinds), [n2, k2] = random(kinds);
  for (let i = 0, x = x0; x < x0 + w; x += s, ++i)
    for (let j = 0, y = y0; y < y0 + h; y += s, ++j)
    {
      const [n, k] = (i + j) % 2 ? [n1, k1] : [n2, k2];
      star(x + s / 2, y + s / 2, r0, n, k, -HALF_PI, 0);
    }
}

// a faint, blurry Julia set tiled and mirrored across the floor
function julia_haze(g, x0, y0, w, h, line_col)
{
  const N = 200, MAXI = 44;
  const c = random([[-0.8, 0.156], [-0.4, 0.6], [0.285, 0.01], [-0.70176, -0.3842], [-0.835, -0.2321],
                    [0.355, 0.355], [-0.54, 0.54], [-0.123, 0.745], [-0.1, 0.651]]);
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(N, N);
  const rgb = line_col(255).levels;
  for (let py = 0; py < N; ++py)
    for (let px = 0; px < N; ++px)
    {
      let zr = (px / N - 0.5) * 3.2, zi = (py / N - 0.5) * 3.2, i = 0;
      while (i < MAXI && zr * zr + zi * zi < 16)
      {
        const t = zr * zr - zi * zi + c[0];
        zi = 2 * zr * zi + c[1]; zr = t; ++i;
      }
      const v = i / MAXI, o = (py * N + px) * 4;
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2];
      img.data[o + 3] = i === MAXI ? 12 : 4 + 34 * v * v * v;
    }
  cx.putImageData(img, 0, 0);
  const ctx = g.drawingContext, t = random(280, 420);
  ctx.imageSmoothingEnabled = true;
  for (let i = 0, x = x0; x < x0 + w; x += t, ++i)
    for (let j = 0, y = y0; y < y0 + h; y += t, ++j)
    {
      ctx.save();
      ctx.translate(x + t / 2, y + t / 2);
      ctx.scale(i % 2 ? -1 : 1, j % 2 ? -1 : 1);
      ctx.drawImage(cv, -t / 2, -t / 2, t, t);
      ctx.restore();
    }
}

// golden rectangles peeled into squares, each with its quarter-turn arc
function golden_spiral(g, x0, y0, w, h, line_col)
{
  const PHI = (1 + Math.sqrt(5)) / 2;
  const spiral = (H, d) =>
  {
    g.stroke(line_col(34 - d * 2));
    g.strokeWeight(Math.max(0.6, 1.5 - d * 0.15));
    g.noFill();
    g.rect(0, 0, H, H);
    g.stroke(line_col(44 - d * 2));
    g.arc(H, H, H * 2, H * 2, PI, PI * 1.5);
    if (d >= 8 || H < 9) return;
    g.push();
    g.translate(H * PHI, 0);
    g.rotate(HALF_PI);
    spiral(H / PHI, d + 1);
    g.pop();
  };
  const H = random(150, 230), tw = H * PHI;
  for (let x = x0; x < x0 + w; x += tw)
    for (let y = y0; y < y0 + h; y += H)
    {
      g.push();
      g.translate(x + tw / 2, y + H / 2);
      g.rotate(floor(random(4)) * HALF_PI);
      if (random() < 0.5) g.scale(-1, 1);
      g.translate(-tw / 2, -H / 2);
      spiral(H, 0);
      g.pop();
    }
}

// ---------- overlays ----------

// a few big soft pools of colour under everything else
function color_wash(g, w, h, line_col)
{
  const n = floor(random(3, 6));
  for (let i = 0; i < n; ++i)
  {
    const c = random() < 0.65 ? FLOOR_ACCENT[0] : FLOOR_ACCENT[1];
    radial_blob(g, random(w), random(h), random(180, 420), c, random(0.05, 0.1));
  }
}

// survey-style crosshair ticks on a loose grid
function survey_marks(g, w, h, line_col)
{
  const s = random(70, 130), arm = random(3, 6);
  const ox = random(s), oy = random(s);
  g.stroke(line_col(34));
  g.strokeWeight(1);
  for (let x = ox; x < w; x += s)
    for (let y = oy; y < h; y += s)
    {
      g.line(x - arm, y, x + arm, y);
      g.line(x, y - arm, x, y + arm);
    }
}

// dots that swell and shrink along a diagonal wave
function halftone_wave(g, w, h, line_col)
{
  const s = random(14, 22), ang = random(TWO_PI), freq = random(0.004, 0.012), ph = random(TWO_PI);
  const dx = cos(ang), dy = sin(ang);
  g.noStroke();
  g.fill(line_col(26));
  for (let x = 0; x < w; x += s)
    for (let y = 0; y < h; y += s)
    {
      const v = (Math.sin((x * dx + y * dy) * freq * TWO_PI + ph) + 1) / 2;
      if (v > 0.15) g.circle(x, y, v * s * 0.45);
    }
}

FLOOR_EXTRA_FAMILIES.push(sierpinski_carpet, koch_flakes, hilbert_tiles, phyllotaxis, fractal_trees,
                          circle_packing, star_rosettes, julia_haze, golden_spiral);
const FLOOR_EXTRA_OVERLAYS = [survey_marks, halftone_wave];

// ---------- transforms ----------
// Draws the primary pattern in a frame centred on the board. Each copy re-seeds the generator
// with the same value so mirrored / rotated copies are true reflections of one pattern.

function draw_symmetric(g, primary, size, line_col)
{
  const ctx = g.drawingContext, ps = floor(random(1e9));
  const run = () => { randomSeed(ps); primary(g, -size / 2, -size / 2, size, size, line_col); };
  const roll = random();
  const R = size;

  if (roll < 0.4) { g.rotate(random() < 0.4 ? 0 : random(TWO_PI)); run(); return; }

  if (roll < 0.62)
  {
    // mirror across one or both axes
    g.rotate(random() < 0.5 ? 0 : random(TWO_PI));
    const quad = random() < 0.4;
    for (const [sx, sy] of quad ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 1], [-1, 1]])
    {
      g.push(); ctx.save();
      g.scale(sx, sy);
      ctx.beginPath(); ctx.rect(-R, -R, R, quad ? R : 2 * R); ctx.clip();
      run();
      ctx.restore(); g.pop();
    }
    return;
  }

  if (roll < 0.9)
  {
    // n-fold rotation, optionally kaleidoscopic (alternate wedges mirrored)
    const n = random([3, 4, 5, 6, 8]), mirrored = random() < 0.5;
    const ox = random(-0.08, 0.08) * size, oy = random(-0.08, 0.08) * size;
    g.rotate(random(TWO_PI));
    for (let k = 0; k < n; ++k)
      for (const flip of mirrored ? [1, -1] : [1])
      {
        g.push(); ctx.save();
        g.rotate(k * TWO_PI / n);
        g.scale(1, flip);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, 0, mirrored ? PI / n : TWO_PI / n); ctx.closePath(); ctx.clip();
        g.translate(ox, oy);
        run();
        ctx.restore(); g.pop();
      }
    return;
  }

  // stretched and sheared, as if seen at an angle
  g.rotate(random(TWO_PI));
  g.shearX(random(-0.35, 0.35));
  g.scale(random(0.8, 1.25), random(0.8, 1.25));
  run();
}
