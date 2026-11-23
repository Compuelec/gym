import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '@/i18n';
import { canApplyUpdateNow, whenUpdateAllowed } from '@/lib/update-guard';

/**
 * Shows «Hay una versión nueva» when a new service worker is waiting. It never reloads by itself:
 * the user decides, and while a workout is in progress the accepted update waits until it ends
 * and then installs.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [deferred, setDeferred] = useState(false);

  // Accepted during a workout: install as soon as the workout is finished or discarded.
  useEffect(() => {
    if (!deferred) return;
    const wait = whenUpdateAllowed();
    void wait.done.then(() => updateServiceWorker(true));
    return wait.stop;
  }, [deferred, updateServiceWorker]);

  if (!needRefresh) return null;

  async function apply() {
    if (!(await canApplyUpdateNow())) {
      setDeferred(true);
      return;
    }
    await updateServiceWorker(true);
  }

  return (
    <div role="alert" className="flex items-center gap-3 bg-primary px-4 py-2 text-sm text-primary-foreground">
      <span className="flex-1">{deferred ? t('update.afterSession') : t('update.available')}</span>
      {!deferred && (
        <>
          <button type="button" className="font-medium underline" onClick={() => void apply()}>
            {t('update.apply')}
          </button>
          <button type="button" className="opacity-80" onClick={() => setNeedRefresh(false)}>
            {t('update.later')}
          </button>
        </>
      )}
    </div>
  );
}
