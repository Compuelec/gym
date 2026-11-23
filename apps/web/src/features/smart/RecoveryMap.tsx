import Model from 'react-body-highlighter';
import { MUSCLES } from '@gym/shared';
import type { MuscleRecovery } from '@gym/engine';
import { t } from '@/i18n';
import { useDark } from '@/lib/use-dark';

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
  // Recovering = amber, fatigued = magenta (the brand's warm accent); recovered = silhouette.
  const dark = useDark();
  const colors = dark ? ['#ffc96b', '#f0479f'] : ['#e0a100', '#c21f82'];
  const body = dark ? '#2a3463' : '#cdd3e6';
  return (
    <figure className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-4" aria-hidden>
        <Model data={data} type="anterior" highlightedColors={colors} bodyColor={body} style={{ width: '100%', maxWidth: 180, margin: '0 auto' }} />
        <Model data={data} type="posterior" highlightedColors={colors} bodyColor={body} style={{ width: '100%', maxWidth: 180, margin: '0 auto' }} />
      </div>
      <figcaption className="text-center text-xs text-muted-foreground">{t('smart.legend')}</figcaption>
    </figure>
  );
}
