import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { PageSpinner } from '@/components/Spinner';
import { ListPlus, Star } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { BodyMap } from '@/features/catalog/BodyMap';
import { ExerciseImages } from '@/features/catalog/ExerciseImages';
import {
  deleteOwnExercise,
  toggleFavorite,
  useExercise,
  useFavoriteIds,
} from '@/features/catalog/exercises';
import { categoryName, equipmentName, muscleName, names } from '@/features/catalog/labels';
import { useRecords } from '@/features/smart/hooks';
import { AddToRoutineSheet } from '@/features/training/AddToRoutineSheet';
import { useState } from 'react';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { useUser } from '@/lib/auth-context';
import { useProfile } from '@/lib/repos';
import { kgToDisplay } from '@gym/shared';

export const Route = createFileRoute('/exercises/$id/')({ component: ExerciseDetailPage });

function ExerciseDetailPage() {
  const { id } = Route.useParams();
  const user = useUser();
  const ex = useExercise(user.id, id);
  const favorites = useFavoriteIds(user.id);
  const records = useRecords(user.id, id);
  const profile = useProfile(user.id);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  if (ex === undefined) return <PageSpinner />;
  if (ex === null) return <p>{t('exercises.notFound')}</p>;
  const fav = favorites.has(ex.id);

  return (
    <article className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">{ex.nameEs}</h1>
          <p className="text-sm text-muted-foreground">
            {t(`exercises.levels.${ex.level}`)} · {categoryName.get(ex.category) ?? ex.category}
            {ex.mechanic && <> · {t(`exercises.mechanics.${ex.mechanic}`)}</>}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={fav}
          aria-label={fav ? t('exercises.removeFavorite') : t('exercises.addFavorite')}
          onClick={() => void toggleFavorite(user.id, ex.id)}
        >
          <Star className={`size-4 ${fav ? 'fill-current' : ''}`} aria-hidden />
        </Button>
      </header>

      {ex.retiredAt && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t('exercises.retired')}</p>
      )}

      <ExerciseImages media={ex.media} alt={ex.nameEs} />

      <Button size="lg" onClick={() => setAdding(true)}>
        <ListPlus className="size-5" aria-hidden />
        {t('addToRoutine.title')}
      </Button>
      {adding && <AddToRoutineSheet userId={user.id} exercises={[ex]} onClose={() => setAdding(false)} />}

      <section className="grid grid-cols-[1fr_auto] gap-4">
        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="font-medium">{t('exercises.primary')}</dt>
            <dd className="text-muted-foreground">{names(ex.primaryMuscles, muscleName)}</dd>
          </div>
          {ex.secondaryMuscles.length > 0 && (
            <div>
              <dt className="font-medium">{t('exercises.secondary')}</dt>
              <dd className="text-muted-foreground">{names(ex.secondaryMuscles, muscleName)}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium">{t('exercises.equipment')}</dt>
            <dd className="text-muted-foreground">
              {ex.equipment.length
                ? names(ex.equipment, equipmentName)
                : t('exercises.noEquipment')}
            </dd>
          </div>
          <div>
            <dt className="font-medium">{t('exercises.measure')}</dt>
            <dd className="text-muted-foreground">{t(`exercises.measures.${ex.measure}`)}</dd>
          </div>
        </dl>
        <div className="w-40">
          <BodyMap primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('exercises.steps')}</h2>
        {!ex.translated && (
          <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            {t('exercises.pendingTranslation')}
          </p>
        )}
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {ex.instructionsEs.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {ex.notes && <p className="text-sm text-muted-foreground">{ex.notes}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('smart.yourRecords')}</h2>
        {records ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {(['max_weight', 'est_1rm', 'max_reps', 'max_volume'] as const)
              .filter((k) => records[k] > 0)
              .map((k) => (
                <div key={k} className="rounded-lg bg-muted p-2">
                  <dt className="text-xs text-muted-foreground">{t(`smart.recordLabels.${k}`)}</dt>
                  <dd className="font-semibold">
                    {k === 'max_reps'
                      ? records[k]
                      : `${formatNumber(kgToDisplay(records[k], profile?.units ?? 'kg'))} ${profile?.units ?? 'kg'}`}
                  </dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('smart.noRecords')}</p>
        )}
      </section>

      {ex.own ? (
        <div className="flex gap-2">
          <Link
            to="/exercises/$id/edit"
            params={{ id: ex.id }}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('common.edit')}
          </Link>
          <Button
            variant="ghost"
            onClick={async () => {
              await deleteOwnExercise(user.id, ex.id);
              await navigate({ to: '/exercises' });
            }}
          >
            {t('exercises.own.delete')}
          </Button>
        </div>
      ) : (
        <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="font-medium">{t('exercises.credits')}</span>
          <span>
            {t('exercises.license')}: {ex.license}
          </span>
          {ex.authors.length > 0 && (
            <span>
              {t('exercises.authors')}: {ex.authors.join(', ')}
            </span>
          )}
          {ex.sourceUrl && (
            <a href={ex.sourceUrl} target="_blank" rel="noreferrer" className="underline">
              {t('exercises.viewSource')}
            </a>
          )}
        </footer>
      )}
    </article>
  );
}
