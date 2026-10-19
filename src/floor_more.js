// More floor content: extra primary patterns and extra "lived in" overlays
// (spilled crates, equipment, cables, puddles, slime, drag marks).
// Primary pattern signature: (g, x0, y0, w, h, line_col) on an oversized rotated area.
// Overlay signature: (g, w, h, line_col) where line_col is the brighter decor colour.

// ---------- helpers ----------

// soft irregular closed shape around (cx, cy)
function blob(g, cx, cy, r, points = 9, wobble = 0.35)
{
  const rs = [];
  for (let i = 0; i < points; ++i) rs.push(r * (1 + random(-wobble, wobble)));
  g.beginShape();
  for (let i = -1; i < points + 2; ++i)
  {
    const k = ((i % points) + points) % points, a = TWO_PI * k / points;
    g.curveVertex(cx + Math.cos(a) * rs[k], cy + Math.sin(a) * rs[k] * 0.8);
  }
  g.endShape(CLOSE);
}

// ---------- new primary patterns ----------

// quarter-arc truchet tiles: meandering, maze-like curves
function truchet(g, x0, y0, w, h, line_col)
{
  const s = random(30, 54);
  g.noFill();
  g.stroke(line_col(random(34, 48)));
  g.strokeWeight(random(1.2, 2.2));
  for (let y = y0; y < y0 + h; y += s)
    for (let x = x0; x < x0 + w; x += s)
    {
      if (random() < 0.5)
      {
        g.arc(x, y, s, s, 0, HALF_PI);
        g.arc(x + s, y + s, s, s, PI, PI + HALF_PI);
      }
      else
      {
        g.arc(x + s, y, s, s, HALF_PI, PI);
        g.arc(x, y + s, s, s, PI + HALF_PI, TWO_PI);
      }
    }
}

// overlapping fish-scale arcs, like armour or a reptile hide
function scales(g, x0, y0, w, h, line_col)
{
  const s = random(26, 44);
  g.noFill();
  g.strokeWeight(1.3);
  let row = 0;
  for (let y = y0; y < y0 + h + s; y += s / 2, ++row)
    for (let x = x0 + (row % 2 ? s / 2 : 0); x < x0 + w + s; x += s)
    {
      const a = random(26, 50);
      for (let k = 1; k <= 3; ++k)
      {
        g.stroke(line_col(a / k + 6));
        g.arc(x, y, s * k / 3, s * k / 3, 0, PI);
      }
    }
}

// scattered nodes joined to near neighbours, like mycelium or a nervous system
function web_nodes(g, x0, y0, w, h, line_col)
{
  const n = Math.min(260, Math.floor(w * h / random(5200, 8200)));
  const pts = [];
  for (let i = 0; i < n; ++i) pts.push({x: x0 + random(w), y: y0 + random(h), big: random() < 0.12});
  g.strokeWeight(1);
  for (const p of pts)
  {
    const near = pts.filter(q => q !== p).map(q => ({q, d: (q.x - p.x) ** 2 + (q.y - p.y) ** 2}))
      .sort((a, b) => a.d - b.d).slice(0, 3);
    for (const {q, d} of near)
    {
      if (d > 140 * 140) continue;
      g.stroke(line_col(26));
      g.line(p.x, p.y, q.x, q.y);
    }
  }
  g.noStroke();
  for (const p of pts)
  {
    g.fill(line_col(p.big ? 50 : 34));
    g.circle(p.x, p.y, p.big ? 9 : 4);
    if (p.big)
    {
      g.noFill(); g.stroke(line_col(30)); g.strokeWeight(1);
      g.circle(p.x, p.y, 20);
      g.noStroke();
    }
  }
}

// printed-circuit traces with 45 degree turns and solder pads
function circuit(g, x0, y0, w, h, line_col)
{
  const step = 16;
  const traces = Math.floor(w * h / 9000);
  g.noFill();
  for (let t = 0; t < traces; ++t)
  {
    let x = x0 + Math.floor(random(w) / step) * step, y = y0 + Math.floor(random(h) / step) * step;
    let dir = floor(random(8));
    g.stroke(line_col(random(26, 42)));
    g.strokeWeight(random(1, 2));
    const segs = floor(random(3, 8));
    for (let i = 0; i < segs; ++i)
    {
      const len = floor(random(1, 5)) * step, a = dir * QUARTER_PI;
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      g.line(x, y, nx, ny);
      x = nx; y = ny;
      dir = (dir + (random() < 0.5 ? 1 : 7)) % 8;
    }
    g.fill(line_col(40)); g.circle(x, y, 6);
    g.noFill(); g.circle(x, y, 11);
  }
}

// basket-weave planks in alternating blocks
function basketweave(g, x0, y0, w, h, line_col)
{
  const s = random(14, 22), b = s * 3;
  g.noFill();
  g.strokeWeight(1.2);
  let j = 0;
  for (let y = y0; y < y0 + h; y += b, ++j)
  {
    let i = 0;
    for (let x = x0; x < x0 + w; x += b, ++i)
    {
      for (let k = 0; k < 3; ++k)
      {
        g.stroke(line_col(random(22, 40)));
        if ((i + j) % 2) g.rect(x, y + k * s, b, s, 2);
        else g.rect(x + k * s, y, s, b, 2);
      }
    }
  }
}

// squares nested inside squares, each turned a little: a droste spiral per tile
function droste(g, x0, y0, w, h, line_col)
{
  const s = random(54, 92), turn = random(0.12, 0.3), shrink = 0.84;
  g.noFill();
  g.strokeWeight(1.1);
  for (let y = y0; y < y0 + h; y += s)
    for (let x = x0; x < x0 + w; x += s)
    {
      g.push();
      g.translate(x + s / 2, y + s / 2);
      let size = s * 0.92;
      for (let k = 0; k < 7; ++k)
      {
        g.stroke(line_col(42 - k * 4));
        g.rectMode(CENTER);
        g.rect(0, 0, size, size, size * 0.06);
        g.rotate(turn);
        size *= shrink;
      }
      g.rectMode(CORNER);
      g.pop();
    }
}

// ---------- new overlays ----------

// toppled crates and spilled boxes with debris scattered around them
function crates(g, w, h, line_col)
{
  const groups = floor(random(2, 5));
  for (let i = 0; i < groups; ++i)
  {
    const cx = random(w), cy = random(h), a0 = random(TWO_PI), n = floor(random(1, 4));
    for (let k = 0; k < n; ++k)
    {
      const s = random(18, 36);
      g.push();
      g.translate(cx + random(-30, 30), cy + random(-30, 30));
      g.rotate(a0 + random(-0.5, 0.5));
      g.stroke(0, 0, 0, 40); g.strokeWeight(3);
      g.noFill();
      g.rect(2, 3, s, s);
      g.stroke(line_col(60)); g.strokeWeight(1.3);
      g.fill(line_col(14));
      g.rect(0, 0, s, s, 2);
      g.noFill(); g.stroke(line_col(34));
      g.rect(s * 0.15, s * 0.15, s * 0.7, s * 0.7);
      g.line(s * 0.15, s * 0.15, s * 0.85, s * 0.85);
      g.line(s * 0.85, s * 0.15, s * 0.15, s * 0.85);
      g.pop();
    }
    // debris that spilled out
    g.noStroke();
    for (let d = 0; d < floor(random(5, 14)); ++d)
    {
      g.fill(line_col(random(24, 50)));
      g.push();
      g.translate(cx + random(-70, 70), cy + random(-60, 60));
      g.rotate(random(TWO_PI));
      g.rect(0, 0, random(2, 6), random(2, 5));
      g.pop();
    }
  }
}

// dead machines: casings with dials, vents and indicator lamps
function equipment(g, w, h, line_col)
{
  const n = floor(random(2, 5));
  for (let i = 0; i < n; ++i)
  {
    const pw = random(46, 100), ph = random(34, 70);
    g.push();
    g.translate(random(pw, w - pw), random(ph, h - ph));
    g.rotate(floor(random(4)) * HALF_PI + random(-0.08, 0.08));
    g.stroke(0, 0, 0, 40); g.strokeWeight(4); g.noFill();
    g.rect(2, 3, pw, ph, 4);
    g.stroke(line_col(58)); g.strokeWeight(1.4); g.fill(line_col(12));
    g.rect(0, 0, pw, ph, 4);
    g.noFill(); g.stroke(line_col(36)); g.strokeWeight(1);
    g.circle(pw * 0.28, ph * 0.5, ph * 0.5);
    const a = random(TWO_PI);
    g.line(pw * 0.28, ph * 0.5, pw * 0.28 + Math.cos(a) * ph * 0.22, ph * 0.5 + Math.sin(a) * ph * 0.22);
    for (let v = 0; v < 4; ++v) g.line(pw * 0.55, ph * (0.2 + v * 0.17), pw * 0.9, ph * (0.2 + v * 0.17));
    g.noStroke();
    const lamp = random([[90, 150, 90], [170, 90, 80], [90, 120, 170]]);
    for (let l = 0; l < 3; ++l)
    {
      g.fill(lamp[0], lamp[1], lamp[2], random() < 0.5 ? 70 : 24);
      g.circle(pw * 0.55 + l * 9, ph * 0.9, 4);
    }
    g.pop();
  }
}

// heavy cables snaking across the floor with clamps and connectors
function cables(g, w, h, line_col)
{
  const n = floor(random(2, 5));
  for (let i = 0; i < n; ++i)
  {
    const x1 = random(w), y1 = random(h);
    const x2 = x1 + random(-320, 320), y2 = y1 + random(-240, 240);
    const c1 = [x1 + random(-160, 160), y1 + random(-160, 160)], c2 = [x2 + random(-160, 160), y2 + random(-160, 160)];
    g.noFill();
    g.stroke(0, 0, 0, 45); g.strokeWeight(5);
    g.bezier(x1, y1 + 2, c1[0], c1[1] + 2, c2[0], c2[1] + 2, x2, y2 + 2);
    g.stroke(line_col(44)); g.strokeWeight(3);
    g.bezier(x1, y1, c1[0], c1[1], c2[0], c2[1], x2, y2);
    g.stroke(line_col(18)); g.strokeWeight(1);
    g.bezier(x1, y1 - 1, c1[0], c1[1] - 1, c2[0], c2[1] - 1, x2, y2 - 1);
    for (const t of [0.25, 0.5, 0.75])
    {
      if (random() < 0.5) continue;
      const px = bezierPoint(x1, c1[0], c2[0], x2, t), py = bezierPoint(y1, c1[1], c2[1], y2, t);
      g.noStroke(); g.fill(line_col(54));
      g.circle(px, py, 7);
    }
    g.noStroke(); g.fill(line_col(60));
    g.rect(x1 - 5, y1 - 4, 10, 8, 2);
    g.rect(x2 - 5, y2 - 4, 10, 8, 2);
  }
}

// standing water: translucent puddles with a rim highlight and ripples
function wet_patches(g, w, h)
{
  const n = floor(random(3, 7));
  for (let i = 0; i < n; ++i)
  {
    const cx = random(w), cy = random(h), r = random(24, 70);
    g.noStroke();
    g.fill(70, 110, 150, 36);
    blob(g, cx, cy, r);
    g.fill(70, 110, 150, 22);
    blob(g, cx, cy, r * 0.65);
    g.noFill();
    g.stroke(150, 190, 230, 46); g.strokeWeight(1.4);
    g.arc(cx, cy, r * 1.5, r * 1.2, PI * 1.05, PI * 1.6);
    g.stroke(150, 190, 230, 22); g.strokeWeight(1);
    for (let k = 1; k <= 3; ++k) g.ellipse(cx + r * 0.1, cy, r * 0.4 * k, r * 0.3 * k);
  }
}

// luminous slime pools with bubbles
function slime(g, w, h)
{
  const col = random([[90, 170, 70], [150, 90, 170], [70, 160, 150], [170, 160, 60]]);
  const n = floor(random(2, 5));
  for (let i = 0; i < n; ++i)
  {
    const cx = random(w), cy = random(h), r = random(22, 56);
    radial_blob(g, cx, cy, r * 1.8, col, 0.12);
    g.noStroke();
    g.fill(col[0], col[1], col[2], 46);
    blob(g, cx, cy, r, 11, 0.45);
    g.fill(col[0], col[1], col[2], 28);
    blob(g, cx + r * 0.2, cy, r * 0.55, 8, 0.4);
    for (let b = 0; b < floor(random(3, 8)); ++b)
    {
      const bx = cx + random(-r, r) * 0.7, by = cy + random(-r, r) * 0.5, bs = random(3, 9);
      g.noFill(); g.stroke(255, 255, 255, 40); g.strokeWeight(1);
      g.circle(bx, by, bs);
      g.noStroke(); g.fill(255, 255, 255, 50);
      g.circle(bx - bs * 0.2, by - bs * 0.2, bs * 0.25);
    }
    // a drip trail running off the edge
    g.stroke(col[0], col[1], col[2], 38); g.strokeWeight(random(2, 4));
    const a = random(TWO_PI), len = random(30, 110);
    g.line(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
    g.noStroke(); g.fill(col[0], col[1], col[2], 44);
    g.circle(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len), 6);
  }
}

// wide, wavering drag marks: something heavy was pulled across here
function drag_marks(g, w, h)
{
  const n = floor(random(2, 5));
  for (let i = 0; i < n; ++i)
  {
    let x = random(w), y = random(h), a = random(TWO_PI);
    const steps = floor(random(18, 40)), wid = random(5, 12);
    const col = random([[10, 14, 10], [24, 10, 12], [8, 12, 22]]);
    g.noFill();
    for (let k = 0; k < steps; ++k)
    {
      const nx = x + Math.cos(a) * 9, ny = y + Math.sin(a) * 9;
      const fade = 1 - k / steps;
      g.stroke(col[0], col[1], col[2], 55 * fade + 8);
      g.strokeWeight(wid * (0.5 + fade * 0.5));
      g.line(x, y, nx, ny);
      g.stroke(120, 125, 140, 14 * fade);
      g.strokeWeight(1);
      g.line(x + 4, y, nx + 4, ny);
      x = nx; y = ny;
      a += random(-0.12, 0.12);
    }
  }
}

FLOOR_EXTRA_FAMILIES = [truchet, scales, web_nodes, circuit, basketweave, droste];
DECOR_OVERLAYS.push(crates, equipment, cables, wet_patches, slime, drag_marks);
