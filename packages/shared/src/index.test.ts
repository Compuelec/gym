import { describe, expect, it } from 'vitest';
import { APP_LOCALE } from './index';

describe('@gym/shared', () => {
  it('uses Spanish as the app locale', () => {
    expect(APP_LOCALE).toBe('es');
  });
});
