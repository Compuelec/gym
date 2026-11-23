/** Appearance: follow the phone («auto»), or always light or dark. Stored on this device only. */
export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'gym-theme';
const COLORS = { light: '#f3f5fb', dark: '#0a0e1f' };

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;

export function isDark(pref: ThemePref = getThemePref()): boolean {
  return pref === 'dark' || (pref === 'auto' && systemDark());
}

/** Applies a theme to the page (class on <html> and the browser bar colour). */
export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = isDark(pref);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? COLORS.dark : COLORS.light);
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Storage blocked: the choice lasts until the app is closed.
  }
  applyTheme(pref);
}

/** In «auto», follow the phone when it switches between light and dark. */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return () => {};
  const onChange = () => {
    if (getThemePref() === 'auto') applyTheme('auto');
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
