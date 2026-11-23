import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDB } from '@/db/database';
import { SyncEngine, type SyncState } from '@/db/sync';
import { syncTransport } from './api';

const engines = new Map<string, SyncEngine>();

export function getSyncEngine(userId: string): SyncEngine {
  let engine = engines.get(userId);
  if (!engine) {
    engine = new SyncEngine(getDB(userId), syncTransport);
    engines.set(userId, engine);
  }
  return engine;
}

export function forgetSyncEngine(userId: string) {
  engines.get(userId)?.stop();
  engines.delete(userId);
}

const IDLE: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, rejected: 0 };

export function useSyncState(userId: string | null): SyncState {
  const [state, setState] = useState<SyncState>(() => (userId ? getSyncEngine(userId).getState() : IDLE));
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = getSyncEngine(userId).subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, [userId]);
  return userId ? state : IDLE;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
