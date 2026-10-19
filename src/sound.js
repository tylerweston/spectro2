// Sound effects (reused from spectro). Browsers block audio until the first user gesture,
// so nothing plays until sfx.unlock() has been called from an input handler.

const sfx = {
  sounds: {},
  unlocked: false,

  load()
  {
    soundFormats('wav', 'mp3');
    const names = ['menu_hover', 'menu_click', 'light_on', 'light_off', 'next_level_clicked',
                   'detector_on', 'build_wall_1', 'build_wall_2', 'build_wall_3', 'remove_wall'];
    for (const n of names)
    {
      try { this.sounds[n] = loadSound('assets/sounds/' + n); } catch (e) { /* missing sound is not fatal */ }
    }
    for (const n of ['build_wall_1', 'build_wall_2', 'build_wall_3', 'remove_wall'])
      if (this.sounds[n]) this.sounds[n].setVolume(0.3);
  },

  unlock()
  {
    if (this.unlocked) return;
    this.unlocked = true;
    try { userStartAudio(); } catch (e) { /* ignore */ }
  },

  // plays in any screen (menus)
  ui(name)
  {
    if (!settings.sounds || !this.unlocked) return;
    const s = this.sounds[name];
    if (s && s.isLoaded()) s.play();
  },

  // gameplay sounds only play while actually playing, not on the menu backdrop
  play(name)
  {
    if (state !== 'game') return;
    this.ui(name);
  },

  build() { this.play('build_wall_' + (1 + Math.floor(Math.random() * 3))); },
  remove() { this.play('remove_wall'); }
};
