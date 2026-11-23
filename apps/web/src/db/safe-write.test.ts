import { describe, expect, it, vi } from 'vitest';
import { isQuotaExceeded, safeWrite, WriteTimeoutError } from './safe-write';

describe('safeWrite', () => {
  it('retries once when the first write hangs (iOS IndexedDB hang)', async () => {
    let calls = 0;
    const result = await safeWrite(
      () => {
        calls += 1;
        return calls === 1 ? new Promise(() => {}) : Promise.resolve('ok');
      },
      { timeoutMs: 20 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('gives up after the retry also times out', async () => {
    await expect(safeWrite(() => new Promise(() => {}), { timeoutMs: 10 })).rejects.toBeInstanceOf(WriteTimeoutError);
  });

  it('on QuotaExceededError evicts catalog images, warns, and retries', async () => {
    const evict = vi.fn(async () => {});
    const warn = vi.fn();
    let calls = 0;
    const result = await safeWrite(
      async () => {
        calls += 1;
        if (calls === 1) throw new DOMException('full', 'QuotaExceededError');
        return 'saved';
      },
      { onQuotaExceeded: evict, onStorageFull: warn },
    );
    expect(result).toBe('saved');
    expect(evict).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('recognizes Dexie-wrapped quota errors', () => {
    expect(isQuotaExceeded({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true);
    expect(isQuotaExceeded(new Error('x'))).toBe(false);
  });

  it('rethrows other errors without retrying', async () => {
    const write = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(safeWrite(write)).rejects.toThrow('boom');
    expect(write).toHaveBeenCalledOnce();
  });
});
