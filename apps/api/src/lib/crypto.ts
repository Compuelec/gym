import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class EncryptionKeyError extends Error {}

function masterKey(base64: string | undefined): Buffer {
  if (!base64) throw new EncryptionKeyError('APP_ENCRYPTION_KEY no está configurada.');
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new EncryptionKeyError('APP_ENCRYPTION_KEY debe tener 32 bytes en base64.');
  return key;
}

export interface Sealed {
  ciphertext: string;
  iv: string;
  tag: string;
}

/** AES-256-GCM: confidentiality and integrity (a tampered ciphertext fails to open). */
export function seal(plaintext: string, keyBase64: string | undefined): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey(keyBase64), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function open(sealed: Sealed, keyBase64: string | undefined): string {
  const decipher = createDecipheriv('aes-256-gcm', masterKey(keyBase64), Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

export const last4 = (secret: string) => secret.slice(-4);
