import { useLiveQuery } from 'dexie-react-hooks';
import type { Location, Profile } from '@gym/shared';
import { getDB } from '@/db/database';
import { deleteRecord, saveRecord } from '@/db/sync';
import { getSyncEngine } from './sync-client';

export type LocalProfile = Profile & { id: string };
export type LocalLocation = Location & { id: string };

/** `undefined` while loading, `null` when the user has no profile yet (needs onboarding). */
export function useProfile(userId: string) {
  return useLiveQuery(async () => (await getDB(userId).entityTable('profile').get(userId)) ?? null, [userId]) as
    | LocalProfile
    | undefined
    | null;
}

export function useLocations(userId: string) {
  return useLiveQuery(
    async () =>
      ((await getDB(userId).entityTable('location').toArray()) as LocalLocation[]).sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, 'es'),
      ),
    [userId],
  );
}

export async function saveProfile(userId: string, profile: Profile) {
  await saveRecord(getDB(userId), 'profile', { ...profile, id: userId });
  void getSyncEngine(userId).sync();
}

export async function saveLocation(userId: string, location: LocalLocation) {
  const db = getDB(userId);
  // Only one default location.
  if (location.isDefault) {
    const others = (await db.entityTable('location').toArray()) as LocalLocation[];
    for (const other of others) {
      if (other.id !== location.id && other.isDefault) {
        await saveRecord(db, 'location', { ...other, isDefault: false });
      }
    }
  }
  await saveRecord(db, 'location', location);
  void getSyncEngine(userId).sync();
}

export async function removeLocation(userId: string, id: string) {
  await deleteRecord(getDB(userId), 'location', id);
  void getSyncEngine(userId).sync();
}
