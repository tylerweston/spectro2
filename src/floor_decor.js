// Extra floor overlays that make a level feel lived in and a little wrong: stains, scratches,
// scorch marks, creeping vines, alien growths, glyph rows and mechanical panels.
// All are drawn on the floor graphics (clipped to the border) and kept subtle.
// Signature matches the other overlays: (g, w, h, line_col)

function radial_blob(g, x, y, r, rgb, alpha)
{
  const ctx = g.drawingContext;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`);
  grad.addColorStop(0.6, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.5})`);
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// damp, oily patches built from overlapping soft blobs, sometimes with a darker rim
function stains(g, w, h)
{
  const palette = random([[10, 14, 8], [18, 10, 6], [6, 12, 16], [14, 6, 14]]);
  const n = floor(random(4, 9));
  for (let i = 0; i < n; ++i)
  {
    const cx = random(w), cy = random(h), size = random(40, 130);
    for (let k = 0; k < 6; ++k)
      radial_blob(g, cx + random(-size, size) * 0.5, cy + random(-size, size) * 0.5, size * random(0.3, 0.7), palette, random(0.18, 0.35));
    if (random() < 0.5)
    {
      g.noFill();
      g.stroke(palette[0], palette[1], palette[2], 70);
      g.strokeWeight(1.2);
      g.ellipse(cx, cy, size * random(0.8, 1.2), size * random(0.6, 1));
    }
  }
}

// clusters of fine, nearly parallel scratches
function scratches(g, w, h, line_col)
{
  const clusters = floor(random(6, 14));
  g.noFill();
  for (let c = 0; c < clusters; ++c)
  {
    const cx = random(w), cy = random(h), ang = random(TWO_PI), n = floor(random(3, 8));
    for (let i = 0; i < n; ++i)
    {
      const len = random(25, 110), off = random(-10, 10), a = ang + random(-0.08, 0.08);
      const x = cx + Math.cos(ang + HALF_PI) * off, y = cy + Math.sin(ang + HALF_PI) * off;
      g.stroke(line_col(random(20, 45)));
      g.strokeWeight(random(0.5, 1.1));
      g.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
  }
}

// dark burn marks with a ragged edge and a few radiating streaks
function scorch(g, w, h)
{
  const n = floor(random(2, 5));
  for (let i = 0; i < n; ++i)
  {
    const cx = random(w), cy = random(h), r = random(25, 65);
    radial_blob(g, cx, cy, r * 1.5, [0, 0, 0], 0.45);
    radial_blob(g, cx, cy, r * 0.6, [0, 0, 0], 0.5);
    g.stroke(0, 0, 0, 55);
    const rays = floor(random(6, 14));
    for (let k = 0; k < rays; ++k)
    {
      const a = random(TWO_PI), r0 = r * random(0.3, 0.6), r1 = r * random(1, 2.2);
      g.strokeWeight(random(0.6, 1.8));
      g.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    }
  }
}

// curling vines with leaves, creeping in from random spots
function vines(g, w, h)
{
  const col = random([[40, 70, 48], [60, 50, 74], [70, 64, 40], [38, 66, 70]]);
  const trails = floor(random(4, 9));
  for (let t = 0; t < trails; ++t)
  {
    let x = random(w), y = random(h), a = random(TWO_PI);
    const steps = floor(random(25, 60));
    let curl = random(-0.12, 0.12);
    for (let i = 0; i < steps; ++i)
    {
      const nx = x + Math.cos(a) * 7, ny = y + Math.sin(a) * 7;
      const fade = 1 - i / steps;
      g.stroke(col[0], col[1], col[2], 100 * fade + 20);
      g.strokeWeight(1 + 1.4 * fade);
      g.line(x, y, nx, ny);
      if (i % 4 === 2)
      {
        const side = i % 8 === 2 ? 1 : -1;
        const la = a + side * random(0.7, 1.2), ll = random(5, 11) * (0.5 + fade);
        g.noStroke();
        g.fill(col[0], col[1], col[2], 70 * fade + 14);
        g.ellipse(nx + Math.cos(la) * ll * 0.5, ny + Math.sin(la) * ll * 0.5, ll, ll * 0.45);
      }
      x = nx; y = ny;
      curl += random(-0.04, 0.04);
      curl = constrain(curl, -0.2, 0.2);
      a += curl;
    }
  }
}

// pustule-like clusters: a ring of small discs around a larger one, with faint tendrils
function growths(g, w, h)
{
  const hue = random([[70, 40, 70], [40, 70, 60], [80, 55, 40]]);
  const n = floor(random(3, 7));
  for (let i = 0; i < n; ++i)
  {
    const cx = random(w), cy = random(h), r = random(10, 24);
    radial_blob(g, cx, cy, r * 2.6, hue, 0.22);
    g.stroke(hue[0], hue[1], hue[2], 58);
    g.strokeWeight(1);
    const arms = floor(random(4, 9));
    for (let k = 0; k < arms; ++k)
    {
      const a = random(TWO_PI), l = r * random(2, 4);
      g.noFill();
      g.bezier(cx, cy, cx + Math.cos(a) * l * 0.4, cy + Math.sin(a) * l * 0.4 + random(-8, 8),
        cx + Math.cos(a + 0.5) * l * 0.8, cy + Math.sin(a + 0.5) * l * 0.8, cx + Math.cos(a + 0.3) * l, cy + Math.sin(a + 0.3) * l);
    }
    g.noStroke();
    g.fill(hue[0], hue[1], hue[2], 64);
    g.circle(cx, cy, r);
    g.fill(hue[0] + 20, hue[1] + 20, hue[2] + 20, 75);
    g.circle(cx - r * 0.12, cy - r * 0.12, r * 0.35);
    const kids = floor(random(4, 9));
    for (let k = 0; k < kids; ++k)
    {
      const a = TWO_PI * k / kids + random(-0.3, 0.3), d = r * random(0.8, 1.4);
      g.fill(hue[0], hue[1], hue[2], 50);
      g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * random(0.2, 0.45));
    }
  }
}

// rows and spirals of invented glyphs, like script on an alien wall
function glyphs(g, w, h, line_col)
{
  g.noFill();
  const rows = floor(random(2, 5));
  for (let r = 0; r < rows; ++r)
  {
    let x = random(w * 0.1, w * 0.7), y = random(h);
    const ang = random() < 0.5 ? 0 : HALF_PI;
    const count = floor(random(6, 16)), size = random(9, 15), gap = size * 1.7;
    g.stroke(line_col(34));
    g.strokeWeight(1.1);
    for (let i = 0; i < count; ++i)
    {
      g.push();
      g.translate(x + Math.cos(ang) * gap * i, y + Math.sin(ang) * gap * i);
      g.rotate(ang);
      const kind = floor(random(5));
      if (kind === 0) { g.line(0, -size / 2, 0, size / 2); g.line(-size / 3, 0, size / 3, 0); }
      else if (kind === 1) g.arc(0, 0, size, size, random(TWO_PI), random(TWO_PI) + PI);
      else if (kind === 2) { g.line(-size / 2, -size / 2, size / 2, size / 2); g.circle(size / 3, -size / 3, size / 4); }
      else if (kind === 3) g.triangle(-size / 2, size / 2, size / 2, size / 2, 0, -size / 2);
      else { g.circle(0, 0, size * 0.7); g.point(0, 0); }
      g.pop();
    }
  }
}

// riveted panel seams, conduits and vents
function mechanical(g, w, h, line_col)
{
  g.noFill();
  const panels = floor(random(3, 7));
  for (let i = 0; i < panels; ++i)
  {
    const pw = random(60, 190), ph = random(40, 130);
    const px = random(w - pw), py = random(h - ph);
    g.stroke(line_col(34)); g.strokeWeight(1.3);
    g.rect(px, py, pw, ph, 3);
    g.stroke(line_col(18)); g.strokeWeight(1);
    g.rect(px + 5, py + 5, pw - 10, ph - 10, 2);
    g.noStroke(); g.fill(line_col(46));
    for (const [rx, ry] of [[8, 8], [pw - 8, 8], [8, ph - 8], [pw - 8, ph - 8]]) g.circle(px + rx, py + ry, 3.2);
    if (random() < 0.5)
    {
      g.stroke(line_col(30)); g.strokeWeight(1.4);
      const slots = floor(random(3, 7));
      for (let s = 0; s < slots; ++s) g.line(px + pw * 0.25, py + ph * (s + 1) / (slots + 1), px + pw * 0.75, py + ph * (s + 1) / (slots + 1));
    }
    g.noFill();
  }
  // conduits that run in right-angle steps
  const pipes = floor(random(2, 5));
  for (let i = 0; i < pipes; ++i)
  {
    let x = random(w), y = random(h), horiz = random() < 0.5;
    g.stroke(line_col(28)); g.strokeWeight(3);
    for (let k = 0; k < floor(random(3, 6)); ++k)
    {
      const len = random(40, 140) * (random() < 0.5 ? -1 : 1);
      const nx = horiz ? x + len : x, ny = horiz ? y : y + len;
      g.line(x, y, nx, ny);
      g.stroke(0, 0, 0, 25); g.strokeWeight(1);
      g.line(x, y + 1.5, nx, ny + 1.5);
      g.stroke(line_col(28)); g.strokeWeight(3);
      x = nx; y = ny; horiz = !horiz;
    }
  }
}

// brighter line colour than the primary pattern so these details read against the floor
function decor_line(g) { return a => g.color(105, 110, 125, Math.min(255, a * 1.8)); }

let FLOOR_EXTRA_FAMILIES = [];
const DECOR_OVERLAYS = [stains, scratches, scorch, vines, growths, glyphs, mechanical];
