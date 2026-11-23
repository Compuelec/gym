import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDB } from '@/db/database';
import { SyncEngine, type SyncState } from '@/db/sync';
import { syncTransport } from './api';

let engine: SyncEngine | undefined;

export function getSyncEngine(): SyncEngine {
  engine ??= new SyncEngine(getDB(), syncTransport);
  return engine;
}

export function useSyncState(): SyncState {
  const [state, setState] = useState(() => getSyncEngine().getState());
  useEffect(() => {
    const unsubscribe = getSyncEngine().subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, []);
  return state;
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
