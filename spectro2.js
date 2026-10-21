// spectro2 - free-form (non grid) light puzzle.
// Click empty space / a point / a permanent wall to start a wall, click again to finish (Esc cancels).
// Right-click a point (or hold left click on it) to delete it and its walls.
// Drag lights to move them; click a light to toggle it.
// Light every detector with its exact color. Walls are limited, but using fewer than the
// "best" count just means you found a better solution.
//
// Screens (state): intro -> menu / options / about / confirm -> game -> results (timed mode)

const TITLE = 'spectro2';
const BAR = 44;
const HOLD_MS = 600;
const TIMED_START = 20, TIMED_BONUS = 10, TIMED_ADVANCE_MS = 900;

let font, floor_img, light_layer;
let light_sig = null, cached_segs = [];
let mx = 0, my = 0, view_scale = 1, view_ox = 0, view_oy = 0;
let palette = {};

let state = 'intro';    // intro | menu | options | about | confirm | game | results
let mode = 'puzzle';    // puzzle | timed
let world, level, level_num = 1;
let has_save = false, saved_level = 1;
let level_from_save = false;
let showcase_active = false;

let pending = null;     // point a wall is currently being drawn from
let press = null;       // {x, y, t, light, point, moved}
let drag_point = null;  // user point being moved
let drag_light = null;
let solved = false, given_up = false;
let fade = 0;
let message = "", message_timer = 0;
let bar_layout = [];
let ghosts = [];        // walls that were just removed, fading out
let wipe = null;        // {t0, phase: 'out'|'in', then}
const WIPE_MS = 380;

let time_left = 0, timed_solved = 0, solved_at = 0, timed_new_best = false;

function preload()
{
  font = loadFont('assets/LemonMilk.otf');
  sfx.load();
}

function setup()
{
  createCanvas(windowWidth, windowHeight);
  textFont(font);
  palette = {
    outside: color(13, 13, 13),
    wall_fill: color(160, 160, 175),
    wall_outline: color(100, 100, 120),
    perm_fill: color(135, 130, 130),
    marker: color(60, 60, 70),
    font: color(200, 200, 215),
    dim_font: color(100, 100, 110),
    bar: color(24, 24, 28)
  };
  intro_start();
  window.addEventListener('pagehide', save_game);
}

// ---------- viewport ----------

// The level's logical size follows the window's aspect ratio, so the board
// uses the whole viewport (taller on portrait/mobile, wider on landscape).
function target_scale()
{
  return constrain(Math.min(windowWidth, windowHeight) / 560, 0.6, 1.3);
}

function fit_area()
{
  const s = target_scale();
  set_area(Math.round(windowWidth / s), Math.round(windowHeight / s) - BAR);
}

function update_view()
{
  view_scale = Math.min(width / AREA_W, height / (AREA_H + BAR));
  view_ox = (width - AREA_W * view_scale) / 2;
  view_oy = (height - (AREA_H + BAR) * view_scale) / 2;
  mx = (mouseX - view_ox) / view_scale;
  my = (mouseY - view_oy) / view_scale;
}

function windowResized()
{
  resizeCanvas(windowWidth, windowHeight);
  if (!world) return;
  const aspect_changed = Math.abs(windowWidth / windowHeight - AREA_W / (AREA_H + BAR)) > 0.15;
  if (!aspect_changed) return;
  // re-fit the board to the new shape when that wouldn't throw away the player's progress
  if (state === 'game' && world.user_wall_count() === 0 && !locked() && !level_from_save) start_level();
  else if ((state === 'menu' || state === 'options' || state === 'about' || state === 'confirm') && showcase_active) load_showcase();
}

// ---------- levels and scenes ----------

// only giving up locks the board; a solved level stays editable (solved tracks the live state)
function locked() { return given_up; }

function setup_scene(lvl)
{
  level = lvl;
  level.holes = normalize_holes(level.holes);
  ghosts = [];
  set_area(lvl.w, lvl.h);
  if (floor_img) floor_img.remove();
  if (light_layer) light_layer.remove();
  light_layer = createGraphics(AREA_W, AREA_H);
  light_layer.pixelDensity(1);
  floor_img = make_floor_art(AREA_W, AREA_H, level.border, palette, level.seed, level.holes);
  reset_level();
}

function start_level()
{
  fit_area();
  setup_scene(generate_level(level_num));
  level_from_save = false;
  showcase_active = false;
  fade = 1;
  save_game();
}

function reset_level()
{
  world = new World();
  world.holes = level.holes.map(h => h.poly);
  for (const s of level.perm_walls) world.add_perm_wall(s.sx, s.sy, s.ex, s.ey, !!s.straight);
  world.lights = level.lights.map(l => ({...l}));
  world.detectors = level.detectors.map(d => ({...d}));
  world.detectors.forEach(init_detector_fx);
  particles.clear();
  light_sig = null;
  pending = null; press = null; drag_light = null; drag_point = null;
  solved = false; given_up = false;
}

function place_wall(s)
{
  const a = world.anchor_at(s.sx, s.sy, 0.5, 0.5) || world.add_point(s.sx, s.sy);
  const b = world.anchor_at(s.ex, s.ey, 0.5, 0.5) || world.add_point(s.ex, s.ey);
  return world.add_wall(a, b);
}

function apply_solution()
{
  if (state === 'game') with_remove_fx(() => world.clear_user()); else world.clear_user();
  pending = null; press = null; drag_light = null;
  world.lights = level.solution.lights.map(l => ({...l}));
  for (const s of level.solution.walls) place_wall(s);
}

// no flash/sound for detectors that are already lit when a scene appears
function settle_scene()
{
  light_sig = null;
  refresh_lighting();
  world.detectors.forEach(d => { d.was_lit = d.lit; });
}

// the menu backdrop when there is no saved game: a complex level, shown solved
function load_showcase()
{
  fit_area();
  setup_scene(generate_level(1, true));
  apply_solution();
  settle_scene();
  showcase_active = true;
  level_from_save = false;
}

function give_up()
{
  apply_solution();
  given_up = true;
  storage.del('save'); // a given-up game is over: leaving it means starting fresh at level 1
  has_save = false;
}

function next_level()
{
  sfx.play('next_level_clicked');
  const advance = solved;
  begin_wipe(() =>
  {
    if (advance) ++level_num;
    else level_num = 1; // gave up: back to the beginning
    start_level();
  });
}

function go_menu()
{
  save_game();
  enter_menu();
}

function flash(msg)
{
  message = msg;
  message_timer = 1500;
}

// ---------- saving ----------

function save_game()
{
  if (mode !== 'puzzle' || state !== 'game' || !world || given_up) return;
  const pt = id => world.get_point(id);
  storage.set('save', {
    v: 1,
    level_num,
    level,
    solved,
    given_up,
    walls: world.walls.filter(w => !w.perm).map(w => {
      const a = pt(w.a), b = pt(w.b);
      return {sx: a.x, sy: a.y, ex: b.x, ey: b.y};
    }),
    lights: world.lights.map(l => ({x: l.x, y: l.y, on: l.on}))
  });
}

function load_saved(data)
{
  if (!data || data.v !== 1 || !data.level) throw new Error("bad save");
  level_num = data.level_num;
  setup_scene(data.level);
  for (const s of data.walls) place_wall(s);
  data.lights.forEach((l, i) => { Object.assign(world.lights[i], l); });
  solved = !!data.solved;
  given_up = !!data.given_up;
  level_from_save = true;
  showcase_active = false;
  mode = 'puzzle';
}

// ---------- screens ----------

function enter_menu()
{
  wipe = null;
  const data = storage.get('save');
  has_save = false;
  if (data)
  {
    try
    {
      load_saved(data);
      saved_level = data.level_num;
      has_save = true;
    }
    catch (e) { storage.del('save'); }
  }
  if (!has_save) load_showcase();
  settle_scene();
  state = 'menu';
  menu_sel = -1;
}

function continue_game()
{
  mode = 'puzzle';
  state = 'game';
  fade = 0;
}

function new_puzzle()
{
  storage.del('save');
  has_save = false;
  mode = 'puzzle';
  level_num = 1;
  state = 'game';
  start_level();
}

function new_timed()
{
  mode = 'timed';
  level_num = 1;
  time_left = TIMED_START;
  timed_solved = 0;
  timed_new_best = false;
  state = 'game';
  start_level();
}

function end_timed()
{
  const best = storage.get('timed_best', 0);
  timed_new_best = timed_solved > best;
  if (timed_new_best) storage.set('timed_best', timed_solved);
  pending = null; press = null; drag_light = null;
  storage.del('save'); // game over: the old puzzle can't be continued
  has_save = false;
  state = 'results';
  menu_sel = -1;
}

// ---------- lighting ----------

// Visibility polygons, detector colors and the light layer are recomputed only when
// a light or wall actually changed.
function lighting_signature()
{
  let sig = "";
  for (const l of world.lights) sig += l.x + "," + l.y + "," + l.on + ";";
  for (const p of world.points) sig += p.id + ":" + p.x + "," + p.y + ";";
  for (const w of world.walls) sig += w.a + "-" + w.b + ";";
  return sig;
}

function refresh_lighting()
{
  const sig = lighting_signature();
  if (sig === light_sig) return;
  light_sig = sig;
  cached_segs = world.segments();
  const polys = world.update_detectors({w: AREA_W, h: AREA_H}, LIGHT_RADIUS);
  render_light_layer(light_layer, world.lights, polys);
}

// ---------- drawing ----------

function draw()
{
  update_view();
  if (state === 'intro') { draw_intro(); return; }
  if (state === 'game') { draw_game(); return; }
  draw_board(false);
  draw_menu_screen();
  if (menu_fade > 0)
  {
    menu_fade -= deltaTime / 600;
    noStroke();
    fill(0, Math.max(0, menu_fade) * 255);
    rect(0, 0, width, height);
  }
}

function draw_game()
{
  const dt = Math.min(deltaTime, 50);
  refresh_lighting();

  if (!given_up)
  {
    const all_lit = world.detectors.every(d => d.lit);
    if (all_lit && !solved)
    {
      solved = true;
      solved_at = millis();
      save_game();
      if (mode === 'timed') flash("+" + TIMED_BONUS + " seconds");
    }
    else if (!all_lit && solved)
    {
      solved = false;
      if (mode === 'timed') message_timer = 0;
      save_game();
    }
  }

  if (mode === 'timed')
  {
    if (!solved && !wipe)
    {
      time_left -= dt / 1000;
      if (time_left <= 0) { time_left = 0; end_timed(); return; }
    }
    else if (millis() - solved_at > TIMED_ADVANCE_MS)
    {
      begin_wipe(() =>
      {
        time_left += TIMED_BONUS;
        ++timed_solved;
        ++level_num;
        start_level();
      });
    }
  }

  draw_board(true);
  draw_wipe();

  if (fade > 0)
  {
    fade -= dt / 300;
    noStroke();
    fill(red(palette.bar), green(palette.bar), blue(palette.bar), Math.max(0, fade) * 255);
    rect(0, 0, width, height);
  }

  // hold-to-delete
  if (press && !press.moved && press.point && !press.light && !locked() && millis() - press.t > HOLD_MS)
  {
    if (pending && pending.id === press.point.id) pending = null;
    const pt = press.point;
    with_remove_fx(() => { world.remove_point(pt); world.prune_orphans(); });
    sfx.remove();
    save_game();
    press = null;
  }
}

function wall_snapshot()
{
  return world.walls.filter(w => !w.perm).map(w =>
  {
    const a = world.get_point(w.a), b = world.get_point(w.b);
    return {id: w.a + '-' + w.b, sx: a.x, sy: a.y, ex: b.x, ey: b.y};
  });
}

// ghost the walls and scatter debris along them
function wall_removed_fx(s)
{
  ghosts.push({sx: s.sx, sy: s.sy, ex: s.ex, ey: s.ey, age: 0});
  const n = Math.max(6, Math.round(dist(s.sx, s.sy, s.ex, s.ey) / 9));
  for (let i = 0; i <= n; ++i)
  {
    const t = i / n;
    particles.burst(lerp(s.sx, s.ex, t), lerp(s.sy, s.ey, t), 2, [150, 150, 175], 90, 750);
  }
}

// run a removal and show an effect for every user wall that disappeared
function with_remove_fx(fn)
{
  const before = wall_snapshot();
  fn();
  const after = new Set(wall_snapshot().map(s => s.id));
  for (const s of before) if (!after.has(s.id)) wall_removed_fx(s);
}

function draw_ghosts(dt)
{
  for (let i = ghosts.length - 1; i >= 0; --i)
  {
    const g = ghosts[i];
    g.age += dt;
    const k = g.age / 450;
    if (k >= 1) { ghosts.splice(i, 1); continue; }
    // the wall shrinks toward its midpoint and fades
    const mx_ = (g.sx + g.ex) / 2, my_ = (g.sy + g.ey) / 2, f = 1 - k * 0.6;
    const ax = mx_ + (g.sx - mx_) * f, ay = my_ + (g.sy - my_) * f;
    const bx = mx_ + (g.ex - mx_) * f, by = my_ + (g.ey - my_) * f;
    strokeCap(ROUND);
    stroke(255, 160, 140, 120 * (1 - k)); strokeWeight(10 * (1 - k) + 2);
    line(ax, ay, bx, by);
    stroke(220, 220, 235, 230 * (1 - k)); strokeWeight(5 * (1 - k) + 1);
    line(ax, ay, bx, by);
  }
}

// level transition: a slanted wipe with colour-split edges. Covers the board, runs `then`
// (which builds the next level) at full cover, then uncovers.
function begin_wipe(then)
{
  if (wipe) return;
  wipe = {t0: millis(), phase: 'out', then};
}

function draw_wipe()
{
  if (!wipe) return;
  let p = (millis() - wipe.t0) / WIPE_MS;
  if (p >= 1)
  {
    if (wipe.phase === 'out')
    {
      wipe.then();
      wipe.phase = 'in';
      wipe.t0 = millis();
      p = 0;
    }
    else { wipe = null; return; }
  }
  const skew = height * 0.25;
  const e = p * p * (3 - 2 * p);
  const xe = -skew + e * (width + 2 * skew);
  noStroke();
  fill(palette.bar);
  beginShape();
  if (wipe.phase === 'out') { vertex(0, 0); vertex(xe + skew, 0); vertex(xe - skew, height); vertex(0, height); }
  else { vertex(xe + skew, 0); vertex(width, 0); vertex(width, height); vertex(xe - skew, height); }
  endShape(CLOSE);
  blendMode(ADD);
  strokeWeight(4);
  const cols = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
  for (let i = 0; i < 3; ++i)
  {
    const o = (i - 1) * 9;
    stroke(cols[i][0], cols[i][1], cols[i][2], 170);
    line(xe + skew + o, 0, xe - skew + o, height);
  }
  blendMode(BLEND);
}

// 0..1, an occasional slow swell (every 9-15 s) that makes the floor and outer walls breathe
let pulse_next = 6000, pulse_start = -1e9;
const PULSE_MS = 2600;
function pulse_level()
{
  if (!settings.animations) return 0;
  const now = millis();
  if (now > pulse_next)
  {
    pulse_start = now;
    pulse_next = now + PULSE_MS + random(9000, 15000);
  }
  const k = (now - pulse_start) / PULSE_MS;
  return k >= 0 && k <= 1 ? Math.sin(k * PI) : 0;
}

function draw_wall(s, perm, pulse)
{
  strokeCap(ROUND);
  const w = perm ? 8 : 5;
  stroke(palette.wall_outline); strokeWeight(w + 4);
  line(s.sx, s.sy, s.ex, s.ey);
  stroke(perm ? palette.perm_fill : palette.wall_fill); strokeWeight(w);
  line(s.sx, s.sy, s.ex, s.ey);
  if (perm && pulse > 0.01)
  {
    stroke(170, 190, 255, 90 * pulse); strokeWeight(w - 2);
    line(s.sx, s.sy, s.ex, s.ey);
  }
}

// sparks along a freshly built wall
function wall_sparks(a, b)
{
  const n = Math.max(6, Math.round(dist(a.x, a.y, b.x, b.y) / 14));
  for (let i = 0; i <= n; ++i)
  {
    const t = i / n;
    particles.burst(lerp(a.x, b.x, t), lerp(a.y, b.y, t), 2, [210, 220, 255], 60, 600);
  }
}

// the board; interactive = false is used as the dimmed backdrop behind menus
function draw_board(interactive)
{
  background(palette.bar);
  push();
  translate(view_ox, view_oy);
  scale(view_scale);
  noStroke();
  fill(palette.outside);
  rect(0, 0, AREA_W, AREA_H);
  refresh_lighting();

  image(floor_img, 0, 0, AREA_W, AREA_H);
  const pulse = pulse_level();
  if (pulse > 0.01)
  {
    blendMode(ADD);
    tint(255, 70 * pulse);
    image(floor_img, 0, 0, AREA_W, AREA_H);
    noTint();
    blendMode(BLEND);
  }

  blendMode(ADD);
  image(light_layer, 0, 0, AREA_W, AREA_H);
  blendMode(BLEND);

  for (const s of cached_segs) draw_wall(s, s.perm, pulse);

  // markers only on removable points
  const hover = interactive && !locked() ? (drag_point || world.user_point_at(mx, my)) : null;
  stroke(palette.wall_outline); strokeWeight(2);
  for (const p of world.points)
  {
    if (p.perm) continue;
    fill(p === hover ? 255 : palette.marker);
    circle(p.x, p.y, p === hover ? 14 : 11);
  }

  if (interactive && !locked() && my < AREA_H)
  {
    if (pending)
    {
      const len = dist(pending.x, pending.y, mx, my);
      stroke(255, 40); strokeWeight(8);
      line(pending.x, pending.y, mx, my);
      stroke(255, 170); strokeWeight(2);
      drawingContext.setLineDash([8, 6]);
      drawingContext.lineDashOffset = -millis() / 40;
      line(pending.x, pending.y, mx, my);
      drawingContext.setLineDash([]);
      noFill(); stroke(255, 120 + 60 * Math.sin(millis() / 150)); strokeWeight(2);
      circle(pending.x, pending.y, 16 + 4 * Math.sin(millis() / 150));
      if (len > 4 && random() < 0.6)
      {
        const t = random();
        particles.burst(lerp(pending.x, mx, t), lerp(pending.y, my, t), 1, [200, 210, 255], 25, 450);
      }
    }
    // hint where a wall would attach to a permanent wall
    if (!world.point_at(mx, my))
    {
      const hit = world.perm_wall_at(mx, my);
      if (hit)
      {
        noFill(); stroke(255, 120); strokeWeight(2);
        circle(hit.x, hit.y, 12);
      }
    }
  }

  const dt = Math.min(deltaTime, 50);
  draw_ghosts(dt);
  for (const d of world.detectors) draw_detector(d, dt);
  for (const l of world.lights) draw_light_bulb(l, millis(), l === drag_light);
  particles.update_and_draw(dt);

  if (interactive) draw_ui();
  pop();
}

function bar_buttons()
{
  const list = [
    {label: "menu", enabled: () => true, action: go_menu},
    {label: "reset", enabled: () => !locked(), action: () => { with_remove_fx(() => world.clear_user()); const g = ghosts; reset_level(); ghosts = g; save_game(); }}
  ];
  if (mode === 'puzzle')
  {
    list.push({label: "give up", enabled: () => !locked(), action: give_up});
    list.push({label: given_up ? "restart" : "next", enabled: () => solved || given_up, action: next_level});
  }
  return list;
}

function draw_ui()
{
  noStroke();
  fill(palette.bar);
  rect(0, AREA_H, AREA_W, BAR);
  const cy = AREA_H + BAR / 2;

  textSize(17);
  textAlign(CENTER, CENTER);
  bar_layout = bar_buttons();
  let right = AREA_W - 10;
  for (let i = bar_layout.length - 1; i >= 0; --i)
  {
    const b = bar_layout[i];
    const w = textWidth(b.label) + 24;
    b.x1 = right; b.x0 = right - w;
    right = b.x0 - 4;
    const on = b.enabled();
    const over = on && mx >= b.x0 && mx <= b.x1 && my >= AREA_H;
    fill(!on ? palette.dim_font : over ? 255 : palette.font);
    text(b.label, (b.x0 + b.x1) / 2, cy);
  }

  const used = world.user_wall_count();
  let status = "";
  if (message_timer > 0) { message_timer -= deltaTime; status = message; }
  else if (solved) status = "solved!";
  else if (given_up) status = "gave up - back to level 1";

  let options;
  if (mode === 'timed')
    options = [`time ${Math.ceil(time_left)}   solved ${timed_solved}   walls ${used}/${level.budget}`,
               `${Math.ceil(time_left)}s   solved ${timed_solved}   ${used}/${level.budget}`,
               `${Math.ceil(time_left)}s   ${used}/${level.budget}`];
  else
    options = [`level ${level_num}   walls ${used}/${level.budget}`,
               `level ${level_num}   ${used}/${level.budget}`,
               `L${level_num}  ${used}/${level.budget}`];
  if (status) options = options.map(o => status + "   " + o).concat([status]);

  const room = right - 24;
  textAlign(LEFT, CENTER);
  const text_str = options.find(o => textWidth(o) <= room) || options[options.length - 1];
  const urgent = mode === 'timed' && time_left < 6 && !solved && !status;
  fill(urgent ? color(255, 90 + 80 * Math.sin(millis() / 120), 90) : palette.font);
  text(text_str, 14, cy);
}

// ---------- input ----------

function mousePressed(e)
{
  sfx.unlock();
  if (e && e.target && e.target.tagName !== 'CANVAS') return;
  update_view();
  if (state === 'intro') { intro_skip(); return false; }
  if (state !== 'game') { menu_click(); return false; }
  if (wipe) return false;

  if (my >= AREA_H)
  {
    for (const b of bar_layout)
      if (mx >= b.x0 && mx <= b.x1 && b.enabled()) { b.action(); break; }
    return false;
  }
  if (locked()) return false;

  if (mouseButton === RIGHT)
  {
    const point = world.user_point_at(mx, my);
    if (point)
    {
      if (pending && pending.id === point.id) pending = null;
      with_remove_fx(() => world.remove_point(point));
      sfx.remove();
    }
    else pending = null;
    with_remove_fx(() => world.prune_orphans());
    save_game();
    return false;
  }
  // lights can't be grabbed or toggled while a wall is being drawn
  const light = pending ? null : world.light_at(mx, my);
  press = {x: mx, y: my, t: millis(), light, point: world.user_point_at(mx, my), moved: false};
  if (light) drag_light = light;
  // an existing point can be dragged to move it (not while a wall is being drawn)
  if (!light && !pending && press.point) drag_point = press.point;
  return false;
}

function mouseDragged()
{
  if (state !== 'game' || !press) return;
  update_view();
  // once movement starts, press.moved stays true, so the hold-to-delete timer never fires
  if (!press.moved && dist(press.x, press.y, mx, my) > 6) press.moved = true;
  if (drag_light && press.moved)
  {
    world.move_light(drag_light, mx, my, AREA, MARGIN + 4);
    // the pointer got well ahead of a light that is stuck behind something: let go of it
    if (dist(drag_light.x, drag_light.y, mx, my) > 90)
    {
      drag_light = null;
      save_game();
    }
  }
  if (drag_point && press.moved)
    world.move_point(drag_point, mx, my, level.border);
}

function mouseReleased()
{
  if (state !== 'game') return;
  update_view();
  const p = press;
  press = null;
  const was_dragging = drag_light;
  drag_light = null;
  const was_moving_point = drag_point;
  drag_point = null;
  if (!p || mouseButton === RIGHT || locked()) return;
  if (p.moved)
  {
    if (was_dragging || was_moving_point) save_game();
    return;
  }
  if (p.light)
  {
    p.light.on = !p.light.on;
    sfx.play(p.light.on ? 'light_on' : 'light_off');
    save_game();
    return;
  }
  if (my >= AREA_H) return;

  if (!pending && world.user_wall_count() >= level.budget)
  {
    flash("out of walls");
    return;
  }

  if (!world.point_at(mx, my) && !world.perm_wall_at(mx, my) && world.in_hole(mx, my))
  {
    flash("can't build on a hole");
    return;
  }
  const target = world.anchor_at(mx, my) || world.add_point(mx, my);
  if (!pending)
  {
    pending = target;
    return;
  }
  if (world.user_wall_count() >= level.budget) flash("out of walls");
  else if (pending.id !== target.id && world.add_wall(pending, target)) { sfx.build(); wall_sparks(pending, target); }
  pending = null;
  world.prune_orphans();
  save_game();
}

function keyPressed()
{
  sfx.unlock();
  if (state === 'intro') { intro_skip(); return false; }
  if (state !== 'game') return menu_key();
  if (keyCode === ESCAPE)
  {
    if (pending) { pending = null; world.prune_orphans(); }
    else go_menu();
  }
}

document.oncontextmenu = () => false;
