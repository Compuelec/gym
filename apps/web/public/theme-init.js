// Applies the saved theme before the first paint (no white flash in dark mode). Kept in sync
// with src/lib/theme.ts; an external file because the Content Security Policy forbids inline scripts.
(function () {
  var pref = 'auto';
  try {
    pref = localStorage.getItem('gym-theme') || 'auto';
  } catch (e) {}
  var dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0a0e1f' : '#f3f5fb');
})();
