import { useState } from 'react';
import { PageSpinner } from '@/components/Spinner';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { uuidv7 } from '@gym/shared';
import { useExercises } from '@/features/catalog/exercises';
import { RoutineEditor } from '@/features/training/RoutineEditor';
import { emptyItem, MAX_ROUTINE_ITEMS, saveRoutine, type LocalRoutine } from '@/features/training/repo';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';

export const Route = createFileRoute('/routines/new')({
  // ?ex=id1,id2 starts the routine with exercises chosen in the catalog.
  validateSearch: z.object({ ex: z.string().optional() }),
  component: NewRoutinePage,
});

function NewRoutinePage() {
  const user = useUser();
  const locations = useLocations(user.id);
  const exercises = useExercises(user.id);
  const { ex } = Route.useSearch();
  const navigate = useNavigate();
  const [initial] = useState<LocalRoutine>(() => ({
    id: uuidv7(),
    name: '',
    programId: null,
    weekIndex: null,
    dayIndex: null,
    locationId: null,
    notes: null,
    items: [],
  }));
  const chosen = ex ? ex.split(',').filter(Boolean) : [];
  if (!locations || (chosen.length > 0 && !exercises)) return <PageSpinner />;
  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const items = chosen
    .map((id) => byId.get(id))
    .filter((e) => e !== undefined)
    .slice(0, MAX_ROUTINE_ITEMS)
    .map((e, position) => ({ ...emptyItem(e.id, e.measure), position }));
  const withDefault = { ...initial, items, locationId: locations.find((l) => l.isDefault)?.id ?? null };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{t('routines.newTitle')}</h1>
      <RoutineEditor
        userId={user.id}
        initial={withDefault}
        locations={locations}
        onSave={async (r) => {
          await saveRoutine(user.id, r);
          await navigate({ to: '/routines' });
        }}
      />
    </div>
  );
}
