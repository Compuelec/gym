import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { PageSpinner } from '@/components/Spinner';
import { OwnExerciseForm } from '@/features/catalog/OwnExerciseForm';
import { saveOwnExercise, useExercise } from '@/features/catalog/exercises';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';

export const Route = createFileRoute('/exercises/$id/edit')({ component: EditExercisePage });

function EditExercisePage() {
  const { id } = Route.useParams();
  const user = useUser();
  const navigate = useNavigate();
  const ex = useExercise(user.id, id);
  if (ex === undefined) return <PageSpinner />;
  if (!ex || !ex.own) return <p>{t('exercises.notFound')}</p>;
  const { own: _own, nameEn: _en, translated: _tr, media: _m, license: _l, authors: _a, sourceUrl: _s, retiredAt: _r, ...initial } = ex;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{t('exercises.own.editTitle')}</h1>
      <OwnExerciseForm
        initial={initial}
        onSave={async (updated) => {
          await saveOwnExercise(user.id, updated);
          await navigate({ to: '/exercises/$id', params: { id } });
        }}
      />
    </div>
  );
}
