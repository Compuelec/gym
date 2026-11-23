import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'gym.installDismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Android/desktop: native install button. iPhone: «Compartir → Agregar a pantalla de inicio». */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || isStandalone()) return null;
  const ios = isIosSafari();
  if (!deferred && !ios) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    <aside aria-label={t('install.title')} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 font-medium">
        <Download className="size-4" aria-hidden />
        {t('install.title')}
      </div>
      <p className="text-sm text-muted-foreground">{ios ? t('install.iosText') : t('install.text')}</p>
      <div className="flex gap-2">
        {deferred && (
          <Button
            size="sm"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
          >
            {t('install.button')}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t('install.dismiss')}
        </Button>
      </div>
    </aside>
  );
}
