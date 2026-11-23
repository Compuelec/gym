import { t } from '@/i18n';

/** Version and authorship, as in the other Compuelec apps: foot of Perfil and of the sign-in page. */
export function Credits() {
  return (
    <footer className="flex flex-col items-center gap-1 pt-2 text-center text-muted-foreground">
      <p className="text-[15px] font-semibold tracking-wide">{t('credits.version', { version: __APP_VERSION__ })}</p>
      <span aria-hidden className="mt-0.5 mb-1.5 h-[3px] w-16 rounded-full bg-gradient-to-r from-primary via-[#f39a1e] to-[#7c4dff]" />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] opacity-85">{t('credits.by')}</p>
      <p className="text-sm font-bold text-[#a8611c] dark:text-[#f0a54a]">{t('credits.name')}</p>
      <p className="text-[11.5px]">{t('credits.rights', { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
