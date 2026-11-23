import { useMemo } from 'react';
import { PageSpinner } from '@/components/Spinner';
import { createFileRoute } from '@tanstack/react-router';
import { useExercises } from '@/features/catalog/exercises';
import { muscleName } from '@/features/catalog/labels';
import { RecoveryMap } from '@/features/smart/RecoveryMap';
import { useRecovery } from '@/features/smart/hooks';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';
import { useNow } from '@/lib/use-now';

export const Route = createFileRoute('/recovery')({ component: RecoveryPage });

const ORDER = { fatigued: 0, partial: 1, recovered: 2 } as const;

function RecoveryPage() {
  const user = useUser();
  const all = useExercises(user.id);
  const byId = useMemo(() => new Map((all ?? []).map((e) => [e.id, e])), [all]);
  const recovery = useRecovery(user.id, byId);
  const now = useNow(60_000);
  if (!recovery) return <PageSpinner />;
  const list = recovery.filter((r) => r.muscle !== 'neck').sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.fatigue - a.fatigue);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{t('smart.recoveryTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('smart.recoveryIntro')}</p>
      </header>
      <RecoveryMap recovery={recovery} />
      <ul className="flex flex-col divide-y divide-border">
        {list.map((r) => (
          <li key={r.muscle} className="flex items-center justify-between py-2">
            <span className="flex flex-col">
              <span className="font-medium">{muscleName.get(r.muscle)}</span>
              <span className="text-xs text-muted-foreground">
                {r.lastTrainedAt ? `${lastTrained(now, r.lastTrainedAt)} · ${weekly(r.weeklySets)}` : t('smart.neverTrained')}
              </span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'fatigued' ? 'bg-red-100 text-red-800' : r.status === 'partial' ? 'bg-amber-100 text-amber-900' : 'bg-muted'}`}
            >
              {t(`smart.status.${r.status}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function lastTrained(now: number, at: string) {
  const hours = Math.floor((now - Date.parse(at)) / 3_600_000);
  return hours < 1 ? t('smart.lastTrainedRecent') : t('smart.lastTrained', { hours });
}

function weekly(sets: number) {
  return sets === 1 ? t('smart.weeklySet', { sets: 1 }) : t('smart.weeklySets', { sets: formatNumber(sets) });
}
