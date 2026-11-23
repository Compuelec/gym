import { describe, expect, it } from 'vitest';
import { parentOf, TOP_LEVEL } from './BackButton';

describe('«Volver» without history', () => {
  it('goes up to the section the screen belongs to', () => {
    expect(parentOf('/exercises/fedb:Pushups')).toBe('/exercises');
    expect(parentOf('/routines/abc/edit')).toBe('/routines');
    expect(parentOf('/measurements')).toBe('/progress');
    expect(parentOf('/admin')).toBe('/profile');
    expect(parentOf('/today')).toBe('/');
  });

  it('is not shown on the bottom-bar tabs', () => {
    expect(TOP_LEVEL).toEqual(['/', '/routines', '/exercises', '/progress', '/profile']);
  });
});
