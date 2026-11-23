import { useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { EQUIPMENT, uuidv7 } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/ui/field';
import { deleteLocalData } from '@/db/database';
import { InstallPrompt } from '@/features/install/InstallPrompt';
import { LocationEditor } from '@/features/profile/LocationEditor';
import { TrainingFields } from '@/features/profile/TrainingFields';
import { t } from '@/i18n';
import { authClient } from '@/lib/auth-client';
import { useUser } from '@/lib/auth-context';
import { removeLocation, saveLocation, saveProfile, useLocations, useProfile, type LocalLocation } from '@/lib/repos';
import { clearSessionCache } from '@/lib/session';
import { forgetSyncEngine, getSyncEngine, useOnline, useSyncState } from '@/lib/sync-client';

export const Route = createFileRoute('/profile')({ component: ProfilePage });

const equipmentName = new Map<string, string>(EQUIPMENT.map((e) => [e.slug, e.nameEs]));

function ProfilePage() {
  const user = useUser();
  const profile = useProfile(user.id);
  const locations = useLocations(user.id) ?? [];
  const online = useOnline();
  const sync = useSyncState(user.id);
  const [editing, setEditing] = useState<LocalLocation | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  async function signOut() {
    setError(null);
    if (!online) return setError(t('auth.errors.offline'));
    setSigningOut(true);
    // Never lose data: push everything before leaving and only then wipe this device.
    const engine = getSyncEngine(user.id);
    await engine.sync();
    if (engine.getState().pending > 0) {
      setSigningOut(false);
      return setError(t('profile.pendingChanges', { count: engine.getState().pending }));
    }
    await authClient.signOut();
    forgetSyncEngine(user.id);
    await deleteLocalData(user.id);
    clearSessionCache();
    location.assign('/login');
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('profile.account')}</h2>
        <p>{user.name}</p>
        <p className="text-muted-foreground">{user.email}</p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('profile.training')}</h2>
        <TrainingFields
          value={profile}
          onChange={(v) => {
            void saveProfile(user.id, { ...profile, ...v }).then(() => setSavedAt(Date.now()));
          }}
        />
        {savedAt && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('profile.saved')}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('profile.locations')}</h2>
        {locations.map((loc) =>
          editing?.id === loc.id ? (
            <LocationEditor
              key={loc.id}
              initial={loc}
              onCancel={() => setEditing(null)}
              onSave={async (l) => {
                await saveLocation(user.id, l);
                setEditing(null);
              }}
            />
          ) : (
            <article key={loc.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{loc.name}</h3>
                {loc.isDefault && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t('profile.default')}</span>}
              </div>
              <p className="text-sm text-muted-foreground">
                {loc.equipment.length ? loc.equipment.map((s) => equipmentName.get(s) ?? s).join(', ') : t('profile.noEquipment')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(loc)}>
                  {t('common.edit')}
                </Button>
                {!loc.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => void saveLocation(user.id, { ...loc, isDefault: true })}>
                    {t('profile.makeDefault')}
                  </Button>
                )}
                {locations.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => void removeLocation(user.id, loc.id)}>
                    {t('common.delete')}
                  </Button>
                )}
              </div>
            </article>
          ),
        )}
        {editing && !locations.some((l) => l.id === editing.id) ? (
          <LocationEditor
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={async (l) => {
              await saveLocation(user.id, l);
              setEditing(null);
            }}
          />
        ) : (
          <Button variant="outline" onClick={() => setEditing({ id: uuidv7(), name: '', equipment: [], isDefault: false })}>
            {t('profile.newLocation')}
          </Button>
        )}
      </section>

      <InstallPrompt />

      <Link to="/credits" className="text-sm underline">
        {t('profile.credits')}
      </Link>

      <section className="flex flex-col gap-2">
        <FormError message={error} />
        <Button variant="destructive" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? t('auth.signingOut') : t('auth.signOut')}
        </Button>
        {sync.pending > 0 && (
          <p className="text-sm text-muted-foreground">{t('status.pending', { count: sync.pending })}</p>
        )}
      </section>
    </div>
  );
}
