import Model from 'react-body-highlighter';
import { MUSCLES } from '@gym/shared';
import type { MuscleRecovery } from '@gym/engine';
import { t } from '@/i18n';

const zones = new Map<string, readonly string[]>(MUSCLES.map((m) => [m.slug, m.bodyMap]));
type ModelData = Parameters<typeof Model>[0]['data'];

/** Body map: red = fatigued, amber = recovering, grey = recovered. */
export function RecoveryMap({ recovery }: { recovery: MuscleRecovery[] }) {
  const zonesOf = (status: MuscleRecovery['status']) => recovery.filter((r) => r.status === status).flatMap((r) => zones.get(r.muscle) ?? []);
  const fatigued = zonesOf('fatigued');
  const data = [
    { name: 'partial', muscles: zonesOf('partial') },
    { name: 'fatigued-a', muscles: fatigued },
    { name: 'fatigued-b', muscles: fatigued },
  ] as ModelData;
  const colors = ['#f59e0b', '#dc2626'];
  return (
    <figure className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-4" aria-hidden>
        <Model data={data} type="anterior" highlightedColors={colors} style={{ width: '100%', maxWidth: 180, margin: '0 auto' }} />
        <Model data={data} type="posterior" highlightedColors={colors} style={{ width: '100%', maxWidth: 180, margin: '0 auto' }} />
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">{t('smart.legend')}</figcaption>
    </figure>
  );
}
