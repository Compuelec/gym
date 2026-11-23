/**
 * Body-weight goal maths, all local and explainable (no AI): BMI, the weekly change needed to
 * reach the target by the date, and whether that pace is healthy. General guidance only; the
 * app always reminds people to check with a professional.
 */
export type GoalPace = 'ok' | 'fast' | 'too_fast' | 'past_date' | 'none';

export interface GoalPlan {
  bmi: number | null;
  bmiLabel: string | null;
  diffKg: number | null; // target − current (negative = to lose)
  weeksLeft: number | null;
  weeklyKg: number | null; // change needed per week (signed)
  pace: GoalPace;
  message: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => round1(Math.abs(n)).toLocaleString('es', { maximumFractionDigits: 1 });

export function bmiOf(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

export function bmiLabel(bmi: number) {
  if (bmi < 18.5) return 'bajo peso';
  if (bmi < 25) return 'peso saludable';
  if (bmi < 30) return 'sobrepeso';
  return 'obesidad';
}

export function goalPlan(opts: { weightKg?: number | null; heightCm?: number | null; targetWeightKg?: number | null; targetDate?: string | null; now?: number }): GoalPlan {
  const now = opts.now ?? Date.now();
  const w = opts.weightKg ?? null;
  const bmi = w && opts.heightCm ? bmiOf(w, opts.heightCm) : null;
  const base = { bmi, bmiLabel: bmi === null ? null : bmiLabel(bmi) };
  if (!w || !opts.targetWeightKg) {
    return { ...base, diffKg: null, weeksLeft: null, weeklyKg: null, pace: 'none', message: 'Indica tu peso actual y tu peso objetivo para calcular el ritmo.' };
  }
  const diff = round1(opts.targetWeightKg - w);
  if (Math.abs(diff) < 0.5) {
    return { ...base, diffKg: diff, weeksLeft: null, weeklyKg: 0, pace: 'ok', message: 'Ya estás en tu peso objetivo: ahora toca mantenerlo.' };
  }
  if (!opts.targetDate) {
    return { ...base, diffKg: diff, weeksLeft: null, weeklyKg: null, pace: 'none', message: `Te faltan ${fmt(diff)} kg. Pon una fecha meta para calcular el ritmo semanal.` };
  }
  const weeks = (Date.parse(`${opts.targetDate}T12:00:00Z`) - now) / (7 * 86_400_000);
  if (weeks < 0.5) {
    return { ...base, diffKg: diff, weeksLeft: 0, weeklyKg: null, pace: 'past_date', message: 'La fecha meta ya pasó o es muy cercana: elige una fecha nueva.' };
  }
  const weekly = round1(diff / weeks);
  const losing = diff < 0;
  // Healthy pace: losing up to ~0.75 % of body weight a week (1 % at most); gaining up to
  // 0.25 kg a week (0.5 kg at most, more is mostly fat).
  const pct = Math.abs(weekly) / w;
  const pace: GoalPace = losing ? (pct <= 0.0075 ? 'ok' : pct <= 0.01 ? 'fast' : 'too_fast') : Math.abs(weekly) <= 0.25 ? 'ok' : Math.abs(weekly) <= 0.5 ? 'fast' : 'too_fast';
  const verb = losing ? 'bajar' : 'subir';
  const weeksTxt = Math.round(weeks);
  const head = `Para ${verb} ${fmt(diff)} kg en ${weeksTxt} ${weeksTxt === 1 ? 'semana' : 'semanas'} necesitas ${verb} unos ${fmt(weekly)} kg por semana.`;
  const tail =
    pace === 'ok'
      ? ' Es un ritmo saludable.'
      : pace === 'fast'
        ? ' Es exigente: se puede, pero cuida el descanso y la alimentación.'
        : ' Es demasiado rápido para hacerlo de forma saludable: te recomendamos una fecha más lejana.';
  return { ...base, diffKg: diff, weeksLeft: round1(weeks), weeklyKg: weekly, pace, message: head + tail };
}
