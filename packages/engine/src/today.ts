import { MUSCLES, fitsEquipment } from '@gym/shared';
import type { MuscleRecovery } from './recovery';

export interface TodayCandidate {
  id: string;
  nameEs: string;
  primaryMuscles: readonly string[];
  equipment: readonly string[];
  level: string;
  category: string;
  mechanic: string | null;
  measure: string;
  retiredAt?: string | null;
  hasImages?: boolean;
}

export interface TodayItem {
  exerciseId: string;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  seconds: number | null;
  restSeconds: number;
  reason: string;
}

export interface TodayRoutine {
  focus: string[]; // muscle group names (Spanish)
  avoided: string[];
  items: TodayItem[];
  reason: string;
  estimatedMinutes: number;
}

type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'health' | 'fat_loss';

const SCHEME: Record<Goal, { sets: number; repMin: number; repMax: number; rest: number }> = {
  strength: { sets: 4, repMin: 4, repMax: 6, rest: 150 },
  hypertrophy: { sets: 3, repMin: 8, repMax: 12, rest: 90 },
  endurance: { sets: 3, repMin: 15, repMax: 20, rest: 45 },
  health: { sets: 3, repMin: 10, repMax: 12, rest: 75 },
  fat_loss: { sets: 3, repMin: 12, repMax: 15, rest: 45 },
};
/** Minutes of cardio at the end of the session, by goal. */
const CARDIO_MINUTES: Record<Goal, number> = { strength: 8, hypertrophy: 10, endurance: 20, health: 12, fat_loss: 15 };
/** Cardio machines first (what the place has), then outdoor walking/jogging as a fallback. */
const CARDIO_PREFERENCE = ['treadmill', 'stationary_bike', 'elliptical', 'rower', 'stair_climber', 'jump_rope'];
const WORK_SECONDS = 45;
const TRANSITION_SECONDS = 60;
const LEVEL_ORDER = ['beginner', 'intermediate', 'expert'];
/** When groups are equally fresh, big ones first: a balanced session, not «abs and arms». */
const GROUP_PRIORITY = ['Piernas', 'Espalda', 'Pecho', 'Hombros', 'Brazos', 'Abdomen'];
const groupRank = (g: string) => {
  const i = GROUP_PRIORITY.indexOf(g);
  return i === -1 ? GROUP_PRIORITY.length : i;
};
const MAX_SETS = 5;
const MIN_SETS = 2;

/** Minutes a plan takes: work plus rest per set, a transition per exercise; timed items as set. */
export function estimateMinutes(items: ReadonlyArray<Pick<TodayItem, 'sets' | 'restSeconds' | 'seconds'>>): number {
  const seconds = items.reduce(
    (sum, i) => sum + (i.seconds && i.restSeconds === 0 ? i.seconds * i.sets : i.sets * ((i.seconds ?? WORK_SECONDS) + i.restSeconds) + TRANSITION_SECONDS),
    0,
  );
  return Math.round(seconds / 60);
}

/**
 * Fits a plan to the minutes available by adding or removing sets of the strength exercises
 * (the first ones get extra sets first, the last ones lose them first). Cardio blocks keep their
 * length. The plan never goes below 2 or above 5 sets per exercise.
 */
export function fitToTime<T extends Pick<TodayItem, 'sets' | 'restSeconds' | 'seconds'>>(items: readonly T[], minutes: number): T[] {
  const plan = items.map((i) => ({ ...i }));
  const strength = plan.map((i, n) => ({ i, n })).filter(({ i }) => !(i.seconds && i.restSeconds === 0));
  if (strength.length === 0) return plan;
  for (let guard = 0; guard < 100 && estimateMinutes(plan) > minutes; guard++) {
    const victim = [...strength].reverse().find(({ i }) => i.sets > MIN_SETS);
    if (!victim) break;
    victim.i.sets -= 1;
  }
  for (let guard = 0; guard < 100; guard++) {
    const candidate = strength.find(({ i }) => i.sets < MAX_SETS && i.sets === Math.min(...strength.map((s) => s.i.sets)));
    if (!candidate) break;
    candidate.i.sets += 1;
    if (estimateMinutes(plan) > minutes) {
      candidate.i.sets -= 1;
      break;
    }
  }
  return plan;
}

const muscleInfo = new Map<string, (typeof MUSCLES)[number]>(MUSCLES.map((m) => [m.slug, m]));

function listEs(items: string[]) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/**
 * Builds today's session: focus on the most recovered and least trained muscle groups, only with
 * the location's equipment and the user's level, fitted to the time available, compound
 * exercises first. Deterministic and offline; every choice carries a Spanish reason.
 */
export function generateToday(opts: {
  goal: Goal;
  level: string;
  minutes: number;
  equipment: readonly string[];
  locationName: string;
  recovery: MuscleRecovery[];
  catalog: readonly TodayCandidate[];
}): TodayRoutine {
  const scheme = SCHEME[opts.goal];
  const maxLevel = LEVEL_ORDER.indexOf(opts.level);
  const cardio = pickCardio(opts.catalog, opts.equipment, maxLevel);
  // Short sessions keep their strength work; cardio gets at most a third of the time.
  const cardioMinutes = cardio ? Math.min(CARDIO_MINUTES[opts.goal], Math.floor(opts.minutes / 3)) : 0;
  const perExercise = scheme.sets * (WORK_SECONDS + scheme.rest) + TRANSITION_SECONDS;
  const slots = Math.max(2, Math.min(8, Math.floor(((opts.minutes - cardioMinutes) * 60) / perExercise)));

  // Group recovery: a group is as tired as its most tired muscle.
  const groups = new Map<string, { fatigue: number; weekly: number; muscles: MuscleRecovery[] }>();
  for (const r of opts.recovery) {
    const info = muscleInfo.get(r.muscle);
    if (!info || r.muscle === 'neck') continue;
    const g = groups.get(info.group) ?? { fatigue: 0, weekly: 0, muscles: [] };
    g.fatigue = Math.max(g.fatigue, r.fatigue);
    g.weekly += r.weeklySets;
    g.muscles.push(r);
    groups.set(info.group, g);
  }
  const avoided = [...groups.entries()].filter(([, g]) => g.muscles.some((m) => m.status === 'fatigued')).map(([name]) => name);
  const ranked = [...groups.entries()]
    .filter(([name]) => !avoided.includes(name))
    .sort(([a, ga], [b, gb]) => ga.fatigue - gb.fatigue || ga.weekly - gb.weekly || groupRank(a) - groupRank(b) || a.localeCompare(b, 'es'));

  const usable = opts.catalog.filter(
    (c) =>
      !c.retiredAt &&
      c.measure !== 'time' &&
      ['strength', 'powerlifting'].includes(c.category) &&
      LEVEL_ORDER.indexOf(c.level) <= maxLevel &&
      fitsEquipment(c.equipment, opts.equipment),
  );

  const items: TodayItem[] = [];
  const focus: string[] = [];
  const used = new Set<string>();
  // Round-robin over the best groups, one exercise per muscle (most recovered muscle first).
  const queue = ranked.slice(0, Math.max(2, Math.ceil(slots / 2)));
  let progress = true;
  while (items.length < slots && progress) {
    progress = false;
    for (const [group, g] of queue) {
      if (items.length >= slots) break;
      const muscles = [...g.muscles].sort((a, b) => a.fatigue - b.fatigue || a.weeklySets - b.weeklySets);
      for (const m of muscles) {
        const pick = usable
          .filter((c) => !used.has(c.id) && c.primaryMuscles.includes(m.muscle))
          .sort(
            (a, b) =>
              Number(b.mechanic === 'compound') - Number(a.mechanic === 'compound') ||
              Number(Boolean(b.hasImages)) - Number(Boolean(a.hasImages)) ||
              a.nameEs.localeCompare(b.nameEs, 'es'),
          )[0];
        if (!pick) continue;
        used.add(pick.id);
        if (!focus.includes(group)) focus.push(group);
        const name = muscleInfo.get(m.muscle)?.nameEs ?? m.muscle;
        const series = m.weeklySets === 1 ? '1 serie' : `${m.weeklySets.toLocaleString('es')} series`;
        const why =
          m.lastTrainedAt === null
            ? `${name}: sin trabajo reciente.`
            : m.status === 'recovered'
              ? `${name}: recuperado; llevas ${series} esta semana.`
              : `${name}: casi recuperado; volumen moderado.`;
        items.push({
          exerciseId: pick.id,
          sets: m.status === 'partial' ? Math.max(2, scheme.sets - 1) : scheme.sets,
          repMin: pick.measure === 'weight_reps' || pick.measure === 'reps' ? scheme.repMin : null,
          repMax: pick.measure === 'weight_reps' || pick.measure === 'reps' ? scheme.repMax : null,
          seconds: null,
          restSeconds: scheme.rest,
          reason: why,
        });
        progress = true;
        break;
      }
    }
  }

  // Compound movements first.
  const mechanic = new Map(usable.map((c) => [c.id, c.mechanic]));
  items.sort((a, b) => Number(mechanic.get(b.exerciseId) === 'compound') - Number(mechanic.get(a.exerciseId) === 'compound'));

  // Strength first, cardio to finish.
  if (cardio && cardioMinutes >= 5) {
    items.push({
      exerciseId: cardio.id,
      sets: 1,
      repMin: null,
      repMax: null,
      seconds: cardioMinutes * 60,
      restSeconds: 0,
      reason: `Cardio al final: ${cardioMinutes} minutos a ritmo cómodo, cuando ya terminaste la fuerza.`,
    });
  }

  // Use the time that is left: extra sets on the main exercises (or fewer when over).
  const fitted = fitToTime(items, opts.minutes);
  items.splice(0, items.length, ...fitted);
  const minutes = estimateMinutes(items);
  const reason =
    `Foco: ${listEs(focus.map((f) => f.toLowerCase()))}, con el equipo de ${opts.locationName}.` +
    (cardio && cardioMinutes >= 5 ? ` Primero fuerza y al final ${cardioMinutes} minutos de cardio.` : '') +
    (avoided.length ? ` Evitamos ${listEs(avoided.map((a) => a.toLowerCase()))} porque los trabajaste hace poco.` : '');
  return { focus, avoided, items, reason, estimatedMinutes: minutes };
}

/** The cardio exercise for the end of the session: a machine the place has, else walking/jogging. */
function pickCardio(catalog: readonly TodayCandidate[], equipment: readonly string[], maxLevel: number): TodayCandidate | null {
  const options = catalog.filter(
    (c) => !c.retiredAt && c.category === 'cardio' && LEVEL_ORDER.indexOf(c.level) <= maxLevel && fitsEquipment(c.equipment, equipment),
  );
  const rank = (c: TodayCandidate) => {
    const i = CARDIO_PREFERENCE.findIndex((e) => c.equipment.includes(e));
    return i === -1 ? CARDIO_PREFERENCE.length : i;
  };
  // Within a machine, the gentlest option first (walking/jogging before running).
  return options.sort((a, b) => rank(a) - rank(b) || Number(b.level === 'beginner') - Number(a.level === 'beginner') || a.nameEs.localeCompare(b.nameEs, 'es'))[0] ?? null;
}
