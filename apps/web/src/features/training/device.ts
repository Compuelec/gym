import { useEffect } from 'react';
import { apiFetch } from '@/lib/api';

/** Keeps the screen on while a workout is open (Screen Wake Lock), re-acquired when visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Denied (battery saver, unsupported): the timer still works.
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** Vibration + short beep + a local notification when the page is hidden. */
export async function restFinishedFeedback(title: string, body: string) {
  navigator.vibrate?.([200, 100, 200]);
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Audio blocked until user interaction; vibration/notification still apply.
  }
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, tag: 'rest-timer', icon: '/pwa-192x192.png' });
  }
}

/** Short double buzz and a local notification when 10 s of rest are left. */
export async function restWarningFeedback(title: string, body: string) {
  navigator.vibrate?.([80, 60, 80]);
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, tag: 'rest-timer', icon: '/pwa-192x192.png' });
  }
}

// ── Web Push (server-sent rest notification, arrives with the screen locked) ──

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

function base64UrlToUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Asks permission (must be called from a tap) and registers this device for rest alerts. */
export async function enableRestAlerts(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  const config = (await apiFetch('/push/vapid-key')) as PushConfig;
  if (!config.enabled || !config.publicKey) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8(config.publicKey) }));
  await apiFetch('/push/subscriptions', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
  return 'granted';
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

/** Best effort: with network, the server pushes when the rest ends even if the phone is locked. */
export async function scheduleRestPush(sessionId: string, endsAt: number, next?: string) {
  if (!navigator.onLine || !(await hasPushSubscription())) return;
  await apiFetch('/push/rest-timer', {
    method: 'POST',
    body: JSON.stringify({ sessionId, fireAt: new Date(endsAt).toISOString(), ...(next ? { next: next.slice(0, 120) } : {}) }),
  }).catch(() => {});
}

export async function cancelRestPush(sessionId: string) {
  if (!navigator.onLine) return;
  await apiFetch(`/push/rest-timer/${sessionId}`, { method: 'DELETE' }).catch(() => {});
}
