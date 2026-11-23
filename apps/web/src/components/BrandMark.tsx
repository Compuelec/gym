import { t } from '@/i18n';

/** Logo + name, for the sign-in screens. */
export function BrandMark() {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <img src="/logo.svg" alt="" className="size-11 rounded-xl" />
      <span className="font-display text-2xl font-bold tracking-[0.12em]">{t('app.brand')}</span>
    </div>
  );
}
