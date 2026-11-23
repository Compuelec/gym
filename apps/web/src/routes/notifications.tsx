import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import type { Profile } from '@gym/shared';
import { PageSpinner } from '@/components/Spinner';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { enableRestAlerts, hasPushSubscription, pushSupported } from '@/features/training/device';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { saveProfile, useProfile } from '@/lib/repos';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/notifications')({ component: NotificationsPage });

// Monday first, as on a Spanish calendar; values are JS weekdays (0 = Sunday).
const DAYS = [1, 2, 3, 4, 5, 6, 0] as const;

function NotificationsPage() {
  const user = useUser();
  const profile = useProfile(user.id);
  const [push, setPush] = useState<'unknown' | 'on' | 'off' | 'denied' | 'unsupported'>(() => (pushSupported() ? 'unknown' : 'unsupported'));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!pushSupported()) return;
    void hasPushSubscription().then((on) => setPush(on ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off'));
  }, []);
  // Local copy so every tap shows at once; the saved profile catches up a moment later.
  const [local, setLocal] = useState<Profile | null>(null);
  if (!profile) return <PageSpinner />;
  const current = local ?? profile;

  const days = current.reminderDays ?? [];
  const update = (patch: Partial<Profile>) => {
    setSaved(false);
    // The time zone travels with the settings: the server sends at the person's local time.
    const next = { ...current, ...patch, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    setLocal(next);
    void saveProfile(user.id, next).then(() => setSaved(true));
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('notify.title')}</h1>
        <p className="text-muted-foreground">{t('notify.intro')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-info-soft text-info">
            <Bell className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-semibold">{t('notify.device')}</p>
            <p className="text-sm text-muted-foreground">
              {push === 'on' ? t('notify.deviceOn') : push === 'denied' ? t('session.alertsDenied') : push === 'unsupported' ? t('notify.unsupported') : t('notify.deviceOff')}
            </p>
          </div>
        </div>
        {push === 'off' && (
          <Button onClick={() => void enableRestAlerts().then((r) => setPush(r === 'granted' ? 'on' : r === 'denied' ? 'denied' : 'unsupported'))}>
            {t('notify.enable')}
          </Button>
        )}
      </section>

      <section aria-labelledby="n-reminder" className="flex flex-col gap-3">
        <h2 id="n-reminder" className="text-lg font-semibold">{t('notify.reminder')}</h2>
        <p className="text-sm text-muted-foreground">{t('notify.reminderHint')}</p>
        <div role="group" aria-label={t('notify.days')} className="grid grid-cols-7 gap-1.5">
          {DAYS.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={t(`notify.day${d}`)}
                onClick={() => update({ reminderDays: on ? days.filter((x) => x !== d) : [...days, d].sort(), reminderTime: current.reminderTime ?? '18:00' })}
                className={cn('h-11 rounded-xl border text-sm font-semibold', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground')}
              >
                {t(`notify.dayShort${d}`)}
              </button>
            );
          })}
        </div>
        <TextField
          label={t('notify.time')}
          type="time"
          value={current.reminderTime ?? '18:00'}
          onChange={(e) => /^\d\d:\d\d$/.test(e.target.value) && update({ reminderTime: e.target.value })}
        />
      </section>

      <section aria-labelledby="n-training" className="flex flex-col gap-2">
        <h2 id="n-training" className="text-lg font-semibold">{t('notify.training')}</h2>
        <p className="text-sm text-muted-foreground">{t('notify.trainingHint')}</p>
      </section>

      <label className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--primary)]"
          checked={current.weeklySummary ?? false}
          onChange={(e) => update({ weeklySummary: e.target.checked })}
        />
        <span className="flex flex-col">
          <span className="font-semibold">{t('notify.weekly')}</span>
          <span className="text-sm text-muted-foreground">{t('notify.weeklyHint')}</span>
        </span>
      </label>

      {saved && (
        <p role="status" className="text-sm text-success">
          {t('profile.saved')}
        </p>
      )}
    </div>
  );
}
