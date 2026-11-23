import { useSyncExternalStore } from 'react';

/** True while the dark theme is on (follows the class on <html>, so charts redraw on switch). */
export function useDark(): boolean {
  return useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'), () => false);
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
