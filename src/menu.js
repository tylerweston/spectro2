// Intro animation and all menu-style screens (main, options, about, confirm, results).

let menu_sel = -1;
let menu_fade = 0;
let menu_items = [];
let erase_armed = false;
let intro_t0 = 0, intro_frame = 0, intro_loaded = false;

const INTRO_MS = 3600;

// ---------- intro ----------

function intro_start()
{
  state = 'intro';
  intro_frame = 0;
  intro_loaded = false;
  intro_t0 = millis();
}

function intro_skip()
{
  if (millis() - intro_t0 < 300) return;
  intro_finish();
}

function intro_finish()
{
  if (!intro_loaded) enter_menu();
  state = 'menu';
  menu_fade = 1;
}

function rgb_text(str, x, y, size, split, alpha)
{
  textSize(size);
  textAlign(CENTER, CENTER);
  blendMode(ADD);
  noStroke();
  fill(255, 0, 0, alpha); text(str, x - split, y);
  fill(0, 255, 0, alpha); text(str, x, y + split * 0.5);
  fill(0, 0, 255, alpha); text(str, x + split, y);
  blendMode(BLEND);
}

function draw_intro()
{
  ++intro_frame;
  // load the backdrop while the screen is still black
  if (intro_frame === 3 && !intro_loaded)
  {
    enter_menu();
    state = 'intro';
    intro_loaded = true;
    intro_t0 = millis();
  }
  const t = millis() - intro_t0;
  const cx = width / 2, cy = height / 2;
  const unit = Math.min(width, height);
  background(0);
  if (intro_frame < 3) return;

  if (t < 1500)
  {
    const k = t / 1500;
    const split = (1 - k) * unit * 0.05 + random(0, 2);
    const a = 255 * Math.min(1, k * 3) * (k > 0.9 ? (1 - k) * 10 : 1);
    rgb_text("a tw game", cx, cy, constrain(unit * 0.06, 18, 40), split, a);
  }
  else if (t < 2300)
  {
    const k = (t - 1500) / 800;
    const e = 1 - Math.pow(1 - k, 3);
    const r = unit * 0.3 * (1 - e);
    blendMode(ADD);
    noStroke();
    const cols = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
    for (let i = 0; i < 3; ++i)
    {
      const ang = -HALF_PI + i * TWO_PI / 3 + k * PI;
      fill(cols[i][0], cols[i][1], cols[i][2], 220);
      circle(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, unit * 0.05 + 10 * e);
    }
    blendMode(BLEND);
  }
  else
  {
    const k = constrain((t - 2300) / (INTRO_MS - 2300), 0, 1);
    const flash_a = Math.max(0, 1 - (t - 2300) / 250);
    // expanding rings
    noFill();
    for (let i = 0; i < 3; ++i)
    {
      const kk = constrain(k * 1.5 - i * 0.15, 0, 1);
      stroke(255, 255 * (1 - kk) * 0.6);
      strokeWeight(2);
      circle(cx, cy, unit * 0.15 + kk * unit * 0.9);
    }
    noStroke();
    rgb_text(TITLE, cx, cy, constrain(unit * 0.11, 28, 90), (1 - k) * unit * 0.03, 255 * Math.min(1, k * 4));
    if (flash_a > 0)
    {
      fill(255, flash_a * 255);
      rect(0, 0, width, height);
    }
  }
  if (t >= INTRO_MS) intro_finish();
}

// ---------- menu definitions ----------

function menu_def()
{
  if (state === 'menu')
  {
    return {
      title: TITLE,
      lines: [],
      items: [
        {label: has_save ? "continue  (level " + saved_level + ")" : "continue", enabled: has_save, action: continue_game},
        {label: "puzzle mode", enabled: true, action: () => {
          if (has_save) { state = 'confirm'; menu_sel = -1; } else new_puzzle();
        }},
        {label: "timed mode" + (storage.get('timed_best', 0) ? "  (best " + storage.get('timed_best', 0) + ")" : ""), enabled: true, action: new_timed},
        {label: "options", enabled: true, action: () => { state = 'options'; menu_sel = -1; erase_armed = false; }},
        {label: "about", enabled: true, action: () => { state = 'about'; menu_sel = -1; }}
      ]
    };
  }
  if (state === 'options')
  {
    return {
      title: "options",
      lines: [],
      items: [
        {label: "sounds: " + (settings.sounds ? "on" : "off"), enabled: true, action: () => settings.toggle('sounds')},
        {label: "animations: " + (settings.animations ? "on" : "off"), enabled: true, action: () => settings.toggle('animations')},
        {label: erase_armed ? "really erase? click again" : "erase all data", enabled: true, action: () => {
          if (!erase_armed) { erase_armed = true; return; }
          storage.clear_all();
          erase_armed = false;
          enter_menu();
          state = 'options';
        }},
        {label: "back", enabled: true, action: () => { state = 'menu'; menu_sel = -1; erase_armed = false; }}
      ]
    };
  }
  if (state === 'about')
  {
    return {
      title: "about",
      lines: [
        "click to place wall points, join two to build a wall.",
        "right click or hold a point to remove it.",
        "drag lights, click a light to switch it.",
        "mix red, green and blue light to match each detector.",
        "some lights only reach so far (dotted ring), and boxed lights can't be moved.",
        "you need not use every wall: fewer is a better solution."
      ],
      items: [{label: "back", enabled: true, action: () => { state = 'menu'; menu_sel = -1; }}]
    };
  }
  if (state === 'confirm')
  {
    return {
      title: "start over?",
      lines: ["this replaces your saved puzzle game."],
      items: [
        {label: "yes, start over", enabled: true, action: new_puzzle},
        {label: "no", enabled: true, action: () => { state = 'menu'; menu_sel = -1; }}
      ]
    };
  }
  // results
  const best = storage.get('timed_best', 0);
  return {
    title: "time's up",
    lines: [
      "levels solved: " + timed_solved,
      timed_new_best ? "new best!" : "best: " + best
    ],
    items: [
      {label: "again", enabled: true, action: new_timed},
      {label: "menu", enabled: true, action: () => { mode = 'puzzle'; enter_menu(); }}
    ]
  };
}

// ---------- drawing ----------

function draw_menu_screen()
{
  const def = menu_def();
  noStroke();
  fill(0, 150);
  rect(0, 0, width, height);

  const unit = Math.min(width, height);
  const size = constrain(unit * 0.06, 18, 40);
  const left = Math.max(24, width * 0.08);
  const gap = size * 1.6;
  const line_gap = size * 0.9;
  const total = size * 3 + def.lines.length * line_gap + def.items.length * gap;
  let y = Math.max(size * 2, (height - total) / 2);

  textAlign(LEFT, CENTER);
  textSize(constrain(unit * 0.1, 26, 80));
  const title_size = textSize();
  const split = 2 + Math.sin(millis() / 700) * 1.5;
  blendMode(ADD);
  fill(255, 0, 0, 230); text(def.title, left - split, y);
  fill(0, 255, 0, 230); text(def.title, left, y + split * 0.5);
  fill(0, 0, 255, 230); text(def.title, left + split, y);
  blendMode(BLEND);
  y += title_size * 1.1;

  textSize(size * 0.6);
  fill(palette.font);
  for (const l of def.lines) { text(l, left, y); y += line_gap; }
  y += size * 0.6;

  textSize(size);
  menu_items = [];
  def.items.forEach((it, i) =>
  {
    const w = textWidth(it.label);
    const rect_ = {x0: left - 10, x1: left + w + 10, y0: y - gap / 2, y1: y + gap / 2, item: it};
    menu_items.push(rect_);
    const hover = it.enabled && mouseX >= rect_.x0 && mouseX <= rect_.x1 && mouseY >= rect_.y0 && mouseY <= rect_.y1;
    if (hover && menu_sel !== i) { menu_sel = i; sfx.ui('menu_hover'); }
    const sel = it.enabled && menu_sel === i;
    fill(!it.enabled ? palette.dim_font : sel ? 255 : palette.font);
    text((sel ? "> " : "") + it.label, left - (sel ? textWidth("> ") : 0), y);
    y += gap;
  });
}

// ---------- input ----------

function menu_activate(i)
{
  const it = menu_items[i] && menu_items[i].item;
  if (!it || !it.enabled) return;
  sfx.ui('menu_click');
  it.action();
}

function menu_click()
{
  for (let i = 0; i < menu_items.length; ++i)
  {
    const r = menu_items[i];
    if (mouseX >= r.x0 && mouseX <= r.x1 && mouseY >= r.y0 && mouseY <= r.y1)
    {
      menu_activate(i);
      return;
    }
  }
}

function menu_key()
{
  const n = menu_items.length;
  if (!n) return false;
  const usable = menu_items.map(r => r.item.enabled);
  const step = dir =>
  {
    let i = menu_sel;
    for (let k = 0; k < n; ++k)
    {
      i = (i + dir + n) % n;
      if (usable[i]) { menu_sel = i; sfx.ui('menu_hover'); return; }
    }
  };
  if (keyCode === DOWN_ARROW) step(1);
  else if (keyCode === UP_ARROW) step(-1);
  else if (keyCode === ENTER || keyCode === RETURN) menu_activate(menu_sel);
  else if (keyCode === ESCAPE && state !== 'menu')
  {
    if (state === 'results') { mode = 'puzzle'; enter_menu(); }
    else { state = 'menu'; menu_sel = -1; }
  }
  return false;
}
