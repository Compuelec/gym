import { useState } from 'react';
import { t } from '@/i18n';
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme';

const OPTIONS: ThemePref[] = ['auto', 'light', 'dark'];

/** Automático / Claro / Oscuro, remembered on this device. */
export function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-sm font-semibold tracking-widest text-muted-foreground uppercase">{t('theme.title')}</h2>
      <div role="radiogroup" aria-label={t('theme.title')} className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1 shadow-card">
        {OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={pref === o}
            className={`h-11 rounded-xl text-sm font-medium transition-colors ${pref === o ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => {
              setThemePref(o);
              setPref(o);
            }}
          >
            {t(`theme.${o}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t('theme.hint')}</p>
    </section>
  );
}
