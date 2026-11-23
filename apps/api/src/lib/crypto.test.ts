import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EncryptionKeyError, last4, open, seal } from './crypto';

const key = randomBytes(32).toString('base64');

describe('AES-256-GCM sealing of the AI key', () => {
  it('round trips and never stores the plaintext', () => {
    const sealed = seal('sk-ant-secret-abcd', key);
    expect(JSON.stringify(sealed)).not.toContain('secret');
    expect(open(sealed, key)).toBe('sk-ant-secret-abcd');
  });
  it('uses a new IV every time', () => {
    expect(seal('x', key).iv).not.toBe(seal('x', key).iv);
  });
  it('fails with the wrong master key or a tampered ciphertext', () => {
    const sealed = seal('sk-ant-secret-abcd', key);
    expect(() => open(sealed, randomBytes(32).toString('base64'))).toThrow();
    const bytes = Buffer.from(sealed.ciphertext, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    expect(() => open({ ...sealed, ciphertext: bytes.toString('base64') }, key)).toThrow();
  });
  it('requires a 32-byte master key', () => {
    expect(() => seal('x', undefined)).toThrow(EncryptionKeyError);
    expect(() => seal('x', Buffer.from('short').toString('base64'))).toThrow(EncryptionKeyError);
  });
  it('exposes only the last four characters', () => {
    expect(last4('sk-ant-api03-wxyz')).toBe('wxyz');
  });
});
