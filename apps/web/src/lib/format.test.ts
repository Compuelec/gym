import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from './format';

describe('formatNumber', () => {
  it('uses a decimal comma and at most one decimal', () => {
    expect(formatNumber(16.8)).toBe('16,8');
    expect(formatNumber(22.5)).toBe('22,5');
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(16.849)).toBe('16,8');
  });
});

describe('formatDuration', () => {
  it('shows seconds for short holds and minutes for cardio', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(900)).toBe('15 min');
    expect(formatDuration(150)).toBe('2:30 min');
  });
});
