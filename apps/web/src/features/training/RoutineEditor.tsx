import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { RoutineItem } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { FormError, SelectField, TextField } from '@/components/ui/field';
import { useExercises } from '@/features/catalog/exercises';
import { t } from '@/i18n';
import type { LocalLocation } from '@/lib/repos';
import { ExercisePicker } from './ExercisePicker';
import { emptyItem, type LocalRoutine } from './repo';

const num = (v: string) => (v === '' ? null : Number(v));

export function RoutineEditor({
  userId,
  initial,
  locations,
  onSave,
}: {
  userId: string;
  initial: LocalRoutine;
  locations: LocalLocation[];
  onSave: (r: LocalRoutine) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exercises = new Map((useExercises(userId) ?? []).map((e) => [e.id, e]));
  const location = locations.find((l) => l.id === draft.locationId) ?? null;

  const setItem = (i: number, patch: Partial<RoutineItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const items = [...d.items];
      const [x] = items.splice(i, 1);
      items.splice(i + dir, 0, x!);
      return { ...d, items };
    });

  async function save() {
    setError(null);
    if (!draft.name.trim()) return setError(t('routines.needName'));
    if (draft.items.length === 0) return setError(t('routines.noExercises'));
    setBusy(true);
    await onSave({ ...draft, name: draft.name.trim() });
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t('routines.name')} placeholder={t('routines.namePlaceholder')} maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <SelectField label={t('routines.location')} value={draft.locationId ?? ''} onChange={(e) => setDraft({ ...draft, locationId: e.target.value || null })}>
        <option value="">{t('routines.anyLocation')}</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </SelectField>

      <ol className="flex flex-col gap-3">
        {draft.items.map((item, i) => {
          const ex = exercises.get(item.exerciseId);
          const timed = ex?.measure === 'time';
          return (
            <li key={`${item.exerciseId}-${i}`} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {i + 1}. {ex?.nameEs ?? item.exerciseId}
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={t('routines.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={t('routines.moveDown')} disabled={i === draft.items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={t('routines.remove')} onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <TextField label={t('routines.sets')} type="number" inputMode="numeric" min={1} max={10} value={item.targetSets} onChange={(e) => setItem(i, { targetSets: Number(e.target.value) || 1 })} />
                {timed ? (
                  <TextField label={t('routines.seconds')} type="number" inputMode="numeric" min={5} value={item.targetSeconds ?? ''} onChange={(e) => setItem(i, { targetSeconds: num(e.target.value) })} className="col-span-2" />
                ) : (
                  <>
                    <TextField label={t('routines.repMin')} type="number" inputMode="numeric" min={1} value={item.repMin ?? ''} onChange={(e) => setItem(i, { repMin: num(e.target.value) })} />
                    <TextField label={t('routines.repMax')} type="number" inputMode="numeric" min={1} value={item.repMax ?? ''} onChange={(e) => setItem(i, { repMax: num(e.target.value) })} />
                  </>
                )}
                <TextField label={t('routines.rest')} type="number" inputMode="numeric" min={0} max={600} value={item.restSeconds} onChange={(e) => setItem(i, { restSeconds: Number(e.target.value) || 0 })} />
                <SelectField label={t('routines.rir')} value={item.targetRir ?? ''} onChange={(e) => setItem(i, { targetRir: num(e.target.value) })} className="col-span-2">
                  <option value="">{t('routines.none')}</option>
                  {[0, 1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </SelectField>
              </div>
              {i > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={!!item.supersetGroup && item.supersetGroup === draft.items[i - 1]?.supersetGroup}
                    onChange={(e) => {
                      const prev = draft.items[i - 1]!;
                      const group = prev.supersetGroup ?? `S${i}`;
                      setDraft((d) => ({
                        ...d,
                        items: d.items.map((it, j) =>
                          j === i - 1 ? { ...it, supersetGroup: e.target.checked ? group : it.supersetGroup } : j === i ? { ...it, supersetGroup: e.target.checked ? group : null } : it,
                        ),
                      }));
                    }}
                  />
                  {t('routines.superset')}
                </label>
              )}
            </li>
          );
        })}
      </ol>

      <Button variant="outline" onClick={() => setPicking(true)}>
        <Plus className="size-4" aria-hidden />
        {t('routines.addExercise')}
      </Button>
      <FormError message={error} />
      <Button size="lg" onClick={() => void save()} disabled={busy}>
        {t('common.save')}
      </Button>

      {picking && (
        <ExercisePicker
          userId={userId}
          location={location}
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setDraft((d) => ({ ...d, items: [...d.items, { ...emptyItem(ex.id, ex.measure), position: d.items.length }] }));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
