import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PageSpinner } from '@/components/Spinner';
import { RoutineEditor } from '@/features/training/RoutineEditor';
import { saveRoutine, useRoutine } from '@/features/training/repo';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';

export const Route = createFileRoute('/routines/$id/edit')({ component: EditRoutinePage });

function EditRoutinePage() {
  const { id } = Route.useParams();
  const user = useUser();
  const routine = useRoutine(user.id, id);
  const locations = useLocations(user.id);
  const navigate = useNavigate();
  if (routine === undefined || !locations) return <PageSpinner />;
  if (routine === null) return <p>{t('common.notFoundTitle')}</p>;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{t('routines.editTitle')}</h1>
      <RoutineEditor
        userId={user.id}
        initial={routine}
        locations={locations}
        onSave={async (r) => {
          await saveRoutine(user.id, r);
          await navigate({ to: '/routines' });
        }}
      />
    </div>
  );
}
