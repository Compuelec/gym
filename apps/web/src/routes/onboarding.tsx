import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { FULL_GYM_EQUIPMENT, uuidv7, type EquipmentSlug } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Choice } from '@/components/ui/choice';
import { FormError } from '@/components/ui/field';
import { EquipmentPicker } from '@/features/profile/EquipmentPicker';
import { TrainingFields, type TrainingValues } from '@/features/profile/TrainingFields';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { saveLocation, saveProfile } from '@/lib/repos';

export const Route = createFileRoute('/onboarding')({ component: OnboardingPage });

interface DraftLocation {
  enabled: boolean;
  name: string;
  equipment: EquipmentSlug[];
}

const TOTAL_STEPS = 3;

function OnboardingPage() {
  const user = useUser();
  const [step, setStep] = useState(1);
  const [training, setTraining] = useState<TrainingValues>({
    goal: 'health',
    level: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
    units: 'kg',
  });
  const [places, setPlaces] = useState<DraftLocation[]>([
    { enabled: true, name: t('onboarding.home'), equipment: ['dumbbell', 'band', 'mat'] },
    { enabled: false, name: t('onboarding.gym'), equipment: FULL_GYM_EQUIPMENT },
  ]);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    setError(null);
    if (step === 2 && !places.some((p) => p.enabled)) return setError(t('onboarding.needLocation'));
    setStep((s) => s + 1);
  }

  async function finish() {
    setBusy(true);
    const chosen = places.filter((p) => p.enabled);
    for (const [i, place] of chosen.entries()) {
      await saveLocation(user.id, { id: uuidv7(), name: place.name, equipment: place.equipment, isDefault: i === 0 });
    }
    // The profile is saved last: its presence marks onboarding as done.
    await saveProfile(user.id, { ...training, medicalAckAt: new Date().toISOString() });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{t('onboarding.step', { current: step, total: TOTAL_STEPS })}</p>
        <h1 className="text-3xl font-bold">{t('onboarding.title')}</h1>
      </header>

      {step === 1 && <TrainingFields value={training} onChange={setTraining} />}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('onboarding.locations')}</h2>
            <p className="text-sm text-muted-foreground">{t('onboarding.locationsHint')}</p>
          </div>
          {places.map((place, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <Choice
                type="checkbox"
                checked={place.enabled}
                onChange={(enabled) => setPlaces(places.map((p, j) => (j === i ? { ...p, enabled } : p)))}
                label={place.name}
                description={t('onboarding.useLocation')}
              />
              {place.enabled && (
                <EquipmentPicker
                  label={t('profile.equipment')}
                  value={place.equipment}
                  onChange={(equipment) => setPlaces(places.map((p, j) => (j === i ? { ...p, equipment } : p)))}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t('onboarding.medicalTitle')}</h2>
          <p className="text-muted-foreground">{t('onboarding.medicalText')}</p>
          <Choice type="checkbox" checked={accepted} onChange={setAccepted} label={t('onboarding.medicalAccept')} />
        </section>
      )}

      <FormError message={error} />

      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={busy}>
            {t('common.back')}
          </Button>
        )}
        {step < TOTAL_STEPS ? (
          <Button className="flex-1" onClick={next}>
            {t('common.next')}
          </Button>
        ) : (
          <Button className="flex-1" size="lg" onClick={() => void finish()} disabled={!accepted || busy}>
            {t('onboarding.finish')}
          </Button>
        )}
      </div>
    </div>
  );
}
