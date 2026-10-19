// localStorage wrapper plus persistent settings.

const storage = {
  prefix: 'spectro2_',

  get(key, fallback = null)
  {
    try
    {
      const v = localStorage.getItem(this.prefix + key);
      return v === null ? fallback : JSON.parse(v);
    }
    catch (e) { return fallback; }
  },

  set(key, value)
  {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  },

  del(key)
  {
    try { localStorage.removeItem(this.prefix + key); } catch (e) { /* ignore */ }
  },

  clear_all()
  {
    try
    {
      Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).forEach(k => localStorage.removeItem(k));
    }
    catch (e) { /* ignore */ }
  }
};

const settings = {
  sounds: storage.get('sounds', true),
  animations: storage.get('animations', true),

  toggle(name)
  {
    this[name] = !this[name];
    storage.set(name, this[name]);
  }
};
