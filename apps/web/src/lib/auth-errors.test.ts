import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';

describe('authErrorMessage', () => {
  it('translates known codes to Spanish', () => {
    expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe('Correo o contraseña incorrectos.');
    expect(authErrorMessage({ code: 'INVITE_REQUIRED' })).toMatch(/invitación/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Demasiados intentos/);
  });
  it('falls back to a generic Spanish message', () => {
    expect(authErrorMessage({ code: 'WHATEVER' })).toMatch(/No pudimos/);
  });
});
