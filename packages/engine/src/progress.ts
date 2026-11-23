import { MUSCLES } from '@gym/shared';
import { estimateOneRepMax } from './records';
import { isWorking, type EngineSet } from './types';

/** Monday 00:00 UTC of the ISO week containing `iso`, as YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

function lastWeeks(now: number, weeks: number): string[] {
  const current = weekStart(new Date(now).toISOString());
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${current}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/** Completed sessions per week for the last `weeks` weeks (oldest first, zeros included). */
export function weeklyFrequency(sessionDates: string[], now = Date.now(), weeks = 8) {
  const counts = new Map<string, number>();
  for (const d of sessionDates) counts.set(weekStart(d), (counts.get(weekStart(d)) ?? 0) + 1);
  return lastWeeks(now, weeks).map((week) => ({ week, sessions: counts.get(week) ?? 0 }));
}

/**
 * Consecutive weeks with at least one session, counting back from this week (the current week
 * does not break the streak while it is still in progress).
 */
export function weeklyStreak(sessionDates: string[], now = Date.now()): number {
  const active = new Set(sessionDates.map(weekStart));
  const weeks = lastWeeks(now, 520).reverse(); // newest first
  let streak = 0;
  for (const [i, week] of weeks.entries()) {
    if (active.has(week)) streak += 1;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

export interface SetWithMuscles extends EngineSet {
  completedAt: string;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
}

/** Effective weekly sets per muscle group in the last 7 days (primary 1, secondary 0.5). */
export function volumeByGroup(sets: SetWithMuscles[], now = Date.now()) {
  const groupOf = new Map<string, string>(MUSCLES.map((m) => [m.slug, m.group]));
  const totals = new Map<string, number>();
  for (const s of sets) {
    if (!isWorking(s) || now - Date.parse(s.completedAt) > 7 * 86_400_000) continue;
    const credit = new Map<string, number>();
    for (const m of s.primaryMuscles) credit.set(groupOf.get(m) ?? m, 1);
    for (const m of s.secondaryMuscles) {
      const g = groupOf.get(m) ?? m;
      if (!credit.has(g)) credit.set(g, 0.5);
    }
    for (const [g, c] of credit) totals.set(g, (totals.get(g) ?? 0) + c);
  }
  return [...new Set(MUSCLES.map((m) => m.group))].map((group) => ({ group, sets: totals.get(group) ?? 0 }));
}

/** Per session: best estimated 1RM, top weight and total volume (for the exercise chart). */
export function exerciseSeries(history: Array<{ date: string; sets: EngineSet[] }>) {
  return [...history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, sets }) => {
      const working = sets.filter(isWorking);
      return {
        date,
        est1rm: Math.max(0, ...working.map((s) => estimateOneRepMax(s.weightKg ?? 0, s.reps ?? 0) ?? 0)),
        topWeight: Math.max(0, ...working.map((s) => s.weightKg ?? 0)),
        volume: working.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
        reps: working.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      };
    });
}
