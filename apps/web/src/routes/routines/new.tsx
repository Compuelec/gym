import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { uuidv7 } from '@gym/shared';
import { RoutineEditor } from '@/features/training/RoutineEditor';
import { saveRoutine, type LocalRoutine } from '@/features/training/repo';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';

export const Route = createFileRoute('/routines/new')({ component: NewRoutinePage });

function NewRoutinePage() {
  const user = useUser();
  const locations = useLocations(user.id);
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
  if (!locations) return null;
  const withDefault = { ...initial, locationId: locations.find((l) => l.isDefault)?.id ?? null };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('routines.newTitle')}</h1>
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
