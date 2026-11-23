import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { uuidv7 } from '@gym/shared';
import { OwnExerciseForm, emptyOwnExercise } from '@/features/catalog/OwnExerciseForm';
import { saveOwnExercise } from '@/features/catalog/exercises';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';

export const Route = createFileRoute('/exercises/new')({ component: NewExercisePage });

function NewExercisePage() {
  const user = useUser();
  const navigate = useNavigate();
  const [initial] = useState(() => emptyOwnExercise(uuidv7()));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('exercises.own.newTitle')}</h1>
      <OwnExerciseForm
        initial={initial}
        onSave={async (ex) => {
          await saveOwnExercise(user.id, ex);
          await navigate({ to: '/exercises/$id', params: { id: ex.id } });
        }}
      />
    </div>
  );
}
