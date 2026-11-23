import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { uuidv7 } from '@gym/shared';
import { useProfile } from './repos';

describe('useProfile', () => {
  it('returns null (not undefined forever) when the user has no profile yet', async () => {
    const { result } = renderHook(() => useProfile(uuidv7()));
    await waitFor(() => expect(result.current).toBeNull());
  });
});
