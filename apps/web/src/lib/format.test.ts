import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it('uses a decimal comma and at most one decimal', () => {
    expect(formatNumber(16.8)).toBe('16,8');
    expect(formatNumber(22.5)).toBe('22,5');
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(16.849)).toBe('16,8');
  });
});
