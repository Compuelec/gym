import { describe, expect, it } from 'vitest';
import { canApplyUpdateNow, registerUpdateBlocker } from './update-guard';

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
});
