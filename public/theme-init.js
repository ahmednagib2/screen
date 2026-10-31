// Applies the theme before first paint. A classic script, so it runs while the head is parsed; src/ui/theme.ts keeps
// the same key up to date when the user changes the setting.
(function () {
  var pref = 'system';
  try {
    pref = localStorage.getItem('nb.theme') || 'system';
  } catch (e) {
    // Storage unavailable: follow the system.
  }
  var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);

  // Apply Arabic / RTL direction by default or if chosen
  try {
    var storedSettings = JSON.parse(localStorage.getItem('nb.settings') || '{}');
    var lang = storedSettings.uiLanguage || 'ar';
    if (lang === 'ar' || lang === 'auto') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      document.documentElement.classList.add('rtl');
    }
  } catch (e) {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  }
})();
