import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getThemePref, isDark, setThemePref } from './theme';

function mockSystem(dark: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: dark && q.includes('dark'), addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

describe('theme', () => {
  it('«auto» follows the phone; light and dark are fixed and remembered', () => {
    mockSystem(true);
    expect(getThemePref()).toBe('auto');
    expect(isDark()).toBe(true);
    setThemePref('light');
    expect(getThemePref()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    setThemePref('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    setThemePref('auto');
    expect(localStorage.getItem('gym-theme')).toBeNull();
    mockSystem(false);
    applyTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('updates the browser bar colour', () => {
    mockSystem(false);
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    setThemePref('dark');
    expect(meta.content).toBe('#0a0e1f');
    setThemePref('light');
    expect(meta.content).toBe('#f3f5fb');
    meta.remove();
  });
});
