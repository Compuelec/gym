import { describe, expect, it } from 'vitest';
import { addRest, formatClock, loadRest, overtimeSeconds, remainingSeconds, saveRest, startRest, nextUp } from './rest-timer';

describe('rest timer', () => {
  it('counts down from an absolute end time', () => {
    const s = startRest(90, 1_000_000);
    expect(remainingSeconds(s, 1_000_000)).toBe(90);
    expect(remainingSeconds(s, 1_000_000 + 30_500)).toBe(60);
    expect(remainingSeconds(s, 1_000_000 + 95_000)).toBe(0);
  });

  it('reports overtime when the user comes back late (screen locked, app closed)', () => {
    const s = startRest(60, 0);
    expect(overtimeSeconds(s, 72_000)).toBe(12);
    expect(overtimeSeconds(s, 30_000)).toBe(0);
  });

  it('adds time from now if the rest already ended', () => {
    const s = startRest(60, 0);
    expect(remainingSeconds(addRest(s, 15, 10_000), 10_000)).toBe(65);
    expect(remainingSeconds(addRest(s, 15, 100_000), 100_000)).toBe(15);
  });

  it('takes time off without moving the end into the past', () => {
    const s = startRest(60, 0);
    expect(remainingSeconds(addRest(s, -15, 10_000), 10_000)).toBe(35);
    const nearEnd = addRest(s, -15, 50_000);
    expect(remainingSeconds(nearEnd, 50_000)).toBe(0);
    expect(nearEnd.endsAt).toBe(50_000);
  });

  it('survives a reload (persisted per session)', () => {
    const s = startRest(120, 5_000);
    saveRest('ses-1', s);
    expect(loadRest('ses-1')).toEqual(s);
    saveRest('ses-1', null);
    expect(loadRest('ses-1')).toBeNull();
  });

  it('formats as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(3909)).toBe('1:05:09');
    expect(formatClock(19219)).toBe('5:20:19');
  });
});

describe('next up after a set', () => {
  const items = [
    { id: 'a', name: 'Sentadilla', targetSets: 3, done: 1 },
    { id: 'b', name: 'Remo', targetSets: 3, done: 0 },
  ];
  it('the next set of the same exercise first', () => {
    expect(nextUp(items, 'a')).toBe('Serie 2 de 3 · Sentadilla');
  });
  it('then the next pending exercise', () => {
    expect(nextUp([{ ...items[0]!, done: 3 }, items[1]!], 'a')).toBe('Siguiente ejercicio: Remo');
    expect(nextUp([{ ...items[0]!, done: 3 }, { ...items[1]!, done: 3 }], 'b')).toBe('Última serie hecha: termina cuando quieras');
  });
  it('keeps the next text when time is added', () => {
    const r = startRest(60, 0, 'Serie 2 de 3 · Remo');
    expect(addRest(r, 15, 0).next).toBe('Serie 2 de 3 · Remo');
  });
});
