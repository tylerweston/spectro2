// Visual effects: cached light layer with radial falloff, light bulbs, animated detectors
// (ported from spectro's detector: rotating arcs while unlit, pulsing ring when lit,
// expanding arc rings when activated) and a small particle system.


// ---------- cached light layer ----------

// Renders every light's visibility polygon into an offscreen buffer using additive
// radial gradients. Only called when lights or walls change.
function render_light_layer(layer, lights, polys)
{
  const ctx = layer.drawingContext;
  layer.background(0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  lights.forEach((l, i) => {
    const poly = polys[i];
    if (!poly || poly.length < 3) return;
    ctx.save();
    ctx.beginPath();
    poly.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    // reach the farthest corner so the light is never cut off before a wall
    const reach = Math.hypot(Math.max(l.x, layer.width - l.x), Math.max(l.y, layer.height - l.y));
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, reach);
    const rgb = `${l.r},${l.g},${l.b}`;
    // deliberately gentle: the hue stays clearly readable everywhere, brightest near the bulb
    g.addColorStop(0, `rgba(${rgb},0.50)`);
    g.addColorStop(0.25, `rgba(${rgb},0.40)`);
    g.addColorStop(1, `rgba(${rgb},0.32)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.restore();
  });
  ctx.restore();
}

// ---------- light bulbs ----------

function draw_light_bulb(l, t, dragging)
{
  const pulse = settings.animations ? 1 + 0.06 * Math.sin(t / 380 + l.x * 0.05) : 1;
  noStroke();
  if (l.on)
  {
    // soft halo
    for (let i = 5; i >= 1; --i)
    {
      fill(l.r, l.g, l.b, 11);
      circle(l.x, l.y, (14 + i * 10) * pulse);
    }
    // little rays
    stroke(l.r, l.g, l.b, 70);
    strokeWeight(1.5);
    const rot = (settings.animations ? t / 4000 : 0) + l.x;
    for (let i = 0; i < 8; ++i)
    {
      const a = rot + i * QUARTER_PI, r0 = 15 * pulse, r1 = (i % 2 ? 20 : 25) * pulse;
      line(l.x + cos(a) * r0, l.y + sin(a) * r0, l.x + cos(a) * r1, l.y + sin(a) * r1);
    }
    noStroke();
    // glass + white-hot core
    fill(l.r, l.g, l.b);
    circle(l.x, l.y, 20);
    fill(lerp(l.r, 255, 0.75), lerp(l.g, 255, 0.75), lerp(l.b, 255, 0.75));
    circle(l.x, l.y, 12 * pulse);
    fill(255, 255, 255, 230);
    circle(l.x, l.y, 6);
    noFill();
    stroke(255, dragging ? 255 : 150);
    strokeWeight(1.5);
    circle(l.x, l.y, 20);
  }
  else
  {
    fill(l.r / 5, l.g / 5, l.b / 5);
    stroke(l.r / 2 + 40, l.g / 2 + 40, l.b / 2 + 40, 160);
    strokeWeight(2);
    circle(l.x, l.y, 18);
    noStroke();
    fill(l.r / 3 + 20, l.g / 3 + 20, l.b / 3 + 20, 160);
    circle(l.x, l.y, 5);
  }
}

// ---------- detectors ----------

function init_detector_fx(d)
{
  d.was_lit = false;
  d.anim_cycle = random(TWO_PI);
  d.anim_speed = (random() + 1) / 12;
  d.anim_offset = random(TWO_PI);
  d.flashing = false;
  d.flash_radius = 0;
  d.flash_inc = 2;
  d.flash_max = 150 + random(40);
  d.rings = [[], [], []];
}

// shadow detectors (black) glow violet in their effects since black would be invisible
function dc(d) { return d.r + d.g + d.b === 0 ? [140, 110, 230] : [d.r, d.g, d.b]; }

function start_detector_flash(d)
{
  sfx.play('detector_on');
  if (!settings.animations) return;
  d.flashing = true;
  d.flash_radius = 0;
  d.flash_inc = random() + 2;
  d.rings = [[], [], []];
  for (let i = 0; i < 3; ++i)
    for (let j = 0; j < 2; ++j)
      d.rings[i].push([random(TWO_PI), random(QUARTER_PI, HALF_PI)]);
  particles.burst(d.x, d.y, 28, dc(d), 130, 700);
}

function draw_detector(d, dt)
{
  const frames = dt / 16.7;
  const c = color(...dc(d));
  const white = d.r === 255 && d.g === 255 && d.b === 255;
  const shadow = d.r === 0 && d.g === 0 && d.b === 0;

  if (d.lit && !d.was_lit) start_detector_flash(d);
  d.was_lit = d.lit;

  if (settings.animations) d.anim_cycle = (d.anim_cycle + d.anim_speed * (d.lit ? 1.5 : 0.8) * frames) % TWO_PI;

  noStroke();
  if (!shadow) { fill(...dc(d), d.lit ? 80 : 45); circle(d.x, d.y, 34); }

  if (d.flashing)
  {
    d.flash_radius += dt / d.flash_inc;
    d.flash_inc += 0.18 * frames;
    const alph = map(d.flash_radius, 0, d.flash_max, 80, 0);
    noFill();
    if (d.flash_radius > 60)
    {
      strokeWeight(5); stroke(...dc(d), alph * 0.3);
      for (const [s, z] of d.rings[0]) arc(d.x, d.y, d.flash_radius * (0.3 + z / 4), d.flash_radius * (0.3 + z / 4), s, s + z);
      strokeWeight(10); stroke(...dc(d), alph * 0.7);
      for (const [s, z] of d.rings[1]) arc(d.x, d.y, d.flash_radius * (0.5 + z / 3), d.flash_radius * (0.5 + z / 3), s, s + z);
    }
    strokeWeight(18); stroke(...dc(d), alph);
    for (const [s, z] of d.rings[2]) arc(d.x, d.y, d.flash_radius + z * 8, d.flash_radius + z * 8, s, s + z);
    if (d.flash_radius > d.flash_max) d.flashing = false;
  }

  noFill();
  const size = 26;
  if (shadow)
  {
    // a shadow detector wants no light at all: a dark eclipse disc when satisfied, a warning ring when lit
    const pulse = 0.5 + 0.5 * sin(d.anim_cycle);
    if (d.lit)
    {
      noStroke(); fill(0, 0, 0, 230); circle(d.x, d.y, size + 6);
      noFill(); strokeWeight(3); stroke(140, 110, 230, 110 + 90 * pulse); circle(d.x, d.y, size + 2);
      strokeWeight(1.5); stroke(140, 110, 230, 60 + 60 * pulse); circle(d.x, d.y, size + 12);
    }
    else
    {
      noStroke(); fill(0, 0, 0, 150); circle(d.x, d.y, size + 6);
      const a0 = (d.anim_offset + d.anim_cycle) % TWO_PI;
      noFill(); strokeWeight(8); stroke(140, 110, 230, 220);
      for (let k = 0; k < 4; ++k) arc(d.x, d.y, size, size, a0 + k * HALF_PI, a0 + k * HALF_PI + 0.9);
      strokeWeight(4); stroke(0, 0, 0);
      for (let k = 0; k < 4; ++k) arc(d.x, d.y, size, size, a0 + k * HALF_PI, a0 + k * HALF_PI + 0.9);
    }
    return;
  }
  if (d.lit)
  {
    strokeWeight(6);
    if (white) stroke(60 + sin(d.anim_cycle) * 40, 120); else stroke(130 + sin(d.anim_cycle) * 40, 90);
    circle(d.x, d.y, size);
    strokeWeight(4);
    stroke(c);
    circle(d.x, d.y, size);
    if (settings.animations && random() < 0.2) particles.burst(d.x, d.y, 1, dc(d), 45, 500);
  }
  else
  {
    const a0 = (d.anim_offset + d.anim_cycle) % TWO_PI;
    strokeWeight(8);
    stroke(4, 100);
    arc(d.x, d.y, size, size, a0, a0 + HALF_PI);
    arc(d.x, d.y, size, size, PI + a0, PI + a0 + HALF_PI);
    strokeWeight(4);
    stroke(c);
    arc(d.x, d.y, size, size, a0, a0 + HALF_PI);
    arc(d.x, d.y, size, size, PI + a0, PI + a0 + HALF_PI);
  }
}

// ---------- particles ----------

const particles = {
  list: [],

  burst(x, y, n, rgb, speed, life)
  {
    if (!settings.animations) return;
    for (let i = 0; i < n; ++i)
    {
      const a = random(TWO_PI), v = random(0.2, 1) * speed;
      this.list.push({x, y, vx: cos(a) * v, vy: sin(a) * v, age: 0, life: life * random(0.5, 1), size: random(1.5, 4), rgb});
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  },

  clear() { this.list.length = 0; },

  update_and_draw(dt)
  {
    noStroke();
    for (let i = this.list.length - 1; i >= 0; --i)
    {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) { this.list.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt / 1000;
      p.y += p.vy * dt / 1000;
      p.vx *= 1 - 0.002 * dt;
      p.vy *= 1 - 0.002 * dt;
      fill(p.rgb[0], p.rgb[1], p.rgb[2], 200 * k);
      circle(p.x, p.y, p.size * (0.4 + k));
    }
  }
};
