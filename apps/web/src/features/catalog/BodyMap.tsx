import Model from 'react-body-highlighter';
import { MUSCLES, type MuscleSlug } from '@gym/shared';
import { t } from '@/i18n';
import { useDark } from '@/lib/use-dark';

const zones = new Map<string, readonly string[]>(MUSCLES.map((m) => [m.slug, m.bodyMap]));

type ModelData = Parameters<typeof Model>[0]['data'];

/** Front and back body with primary muscles dark and secondary muscles light. */
export function BodyMap({ primary, secondary }: { primary: readonly MuscleSlug[]; secondary: readonly MuscleSlug[] }) {
  const toZones = (list: readonly MuscleSlug[]) => list.flatMap((m) => zones.get(m) ?? []);
  // Frequency = how many entries mention a zone: primary twice (dark), secondary once (light).
  const data = [
    { name: 'secondary', muscles: toZones(secondary) },
    { name: 'primary-a', muscles: toZones(primary) },
    { name: 'primary-b', muscles: toZones(primary) },
  ] as ModelData;
  // Brand blues: primary muscles strong, secondary light; body silhouette per theme.
  const dark = useDark();
  const colors = dark ? ['#3c5bb8', '#7fa6ff'] : ['#a9c3ff', '#2a5fe8'];
  const body = dark ? '#2a3463' : '#cdd3e6';
  return (
    <div className="grid grid-cols-2 gap-2" aria-hidden>
      <figure className="flex flex-col items-center gap-1">
        <Model data={data} type="anterior" highlightedColors={colors} bodyColor={body} style={{ width: '100%', maxWidth: 160 }} />
        <figcaption className="text-xs text-muted-foreground">{t('exercises.bodyFront')}</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <Model data={data} type="posterior" highlightedColors={colors} bodyColor={body} style={{ width: '100%', maxWidth: 160 }} />
        <figcaption className="text-xs text-muted-foreground">{t('exercises.bodyBack')}</figcaption>
      </figure>
    </div>
  );
}
