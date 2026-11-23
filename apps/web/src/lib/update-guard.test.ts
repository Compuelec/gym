import { describe, expect, it, vi } from 'vitest';
import { canApplyUpdateNow, registerUpdateBlocker, watchForUpdates, whenUpdateAllowed } from './update-guard';

describe('update guard', () => {
  it('allows updates when nothing blocks them', async () => {
    expect(await canApplyUpdateNow()).toBe(true);
  });

  it('blocks updates while a blocker reports activity (workout in progress)', async () => {
    let inProgress = true;
    const unregister = registerUpdateBlocker(async () => inProgress);
    expect(await canApplyUpdateNow()).toBe(false);
    inProgress = false;
    expect(await canApplyUpdateNow()).toBe(true);
    unregister();
  });

  it('an update accepted during a workout goes ahead once the workout ends', async () => {
    vi.useFakeTimers();
    let inProgress = true;
    const unregister = registerUpdateBlocker(async () => inProgress);
    let applied = false;
    const wait = whenUpdateAllowed(1000);
    void wait.done.then(() => (applied = true));
    await vi.advanceTimersByTimeAsync(3000);
    expect(applied).toBe(false);
    inProgress = false;
    await vi.advanceTimersByTimeAsync(1000);
    expect(applied).toBe(true);
    unregister();
    vi.useRealTimers();
  });

  it('looks for a new version periodically and when the app comes back to the foreground', () => {
    vi.useFakeTimers();
    const registration = { update: vi.fn(() => Promise.resolve()) };
    const stop = watchForUpdates(registration, { intervalMs: 60_000 });
    expect(registration.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(registration.update).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(120_000);
    expect(registration.update).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
