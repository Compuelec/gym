/**
 * Fixed equipment vocabulary (Spanish names). Locations list which of these they have; exercises
 * list which they require.
 */
export const EQUIPMENT = [
  { slug: 'dumbbell', nameEs: 'Mancuernas', category: 'free_weights' },
  { slug: 'barbell', nameEs: 'Barra olímpica', category: 'free_weights' },
  { slug: 'ez_bar', nameEs: 'Barra Z', category: 'free_weights' },
  { slug: 'kettlebell', nameEs: 'Pesa rusa (kettlebell)', category: 'free_weights' },
  { slug: 'bench', nameEs: 'Banco', category: 'support' },
  { slug: 'pull_up_bar', nameEs: 'Barra de dominadas', category: 'support' },
  { slug: 'band', nameEs: 'Banda elástica', category: 'accessories' },
  { slug: 'cable', nameEs: 'Máquina de poleas', category: 'machines' },
  { slug: 'machine', nameEs: 'Máquinas guiadas', category: 'machines' },
  { slug: 'medicine_ball', nameEs: 'Balón medicinal', category: 'accessories' },
  { slug: 'exercise_ball', nameEs: 'Pelota de ejercicio', category: 'accessories' },
  { slug: 'foam_roll', nameEs: 'Rodillo de espuma', category: 'accessories' },
  { slug: 'mat', nameEs: 'Colchoneta', category: 'accessories' },
  { slug: 'plate', nameEs: 'Discos de pesa', category: 'free_weights' },
  { slug: 'trap_bar', nameEs: 'Barra hexagonal', category: 'free_weights' },
  { slug: 'dip_bars', nameEs: 'Paralelas para fondos', category: 'support' },
  { slug: 'suspension', nameEs: 'TRX o anillas', category: 'support' },
  { slug: 'box', nameEs: 'Cajón o step', category: 'support' },
  { slug: 'hyper_bench', nameEs: 'Banco de hiperextensiones', category: 'machines' },
  { slug: 'jump_rope', nameEs: 'Cuerda para saltar', category: 'accessories' },
  { slug: 'ab_wheel', nameEs: 'Rueda abdominal', category: 'accessories' },
  { slug: 'battle_rope', nameEs: 'Cuerda de batalla', category: 'accessories' },
  { slug: 'cones', nameEs: 'Conos o vallas', category: 'accessories' },
  { slug: 'treadmill', nameEs: 'Trotadora (cinta de correr)', category: 'cardio' },
  { slug: 'stationary_bike', nameEs: 'Bicicleta estática', category: 'cardio' },
  { slug: 'elliptical', nameEs: 'Elíptica', category: 'cardio' },
  { slug: 'rower', nameEs: 'Máquina de remo', category: 'cardio' },
  { slug: 'stair_climber', nameEs: 'Escaladora', category: 'cardio' },
  { slug: 'sled', nameEs: 'Trineo de arrastre', category: 'other' },
  // Strongman and rare implements (tire, atlas stones, log, yoke, heavy bag, bike…).
  { slug: 'other', nameEs: 'Equipo especial (neumático, piedras, yugo, saco de boxeo, bicicleta…)', category: 'other' },
] as const;

export type EquipmentSlug = (typeof EQUIPMENT)[number]['slug'];

export const EQUIPMENT_SLUGS = EQUIPMENT.map((e) => e.slug) as [EquipmentSlug, ...EquipmentSlug[]];

/** Everything except exercise/foam accessories: a full commercial gym. */
export const FULL_GYM_EQUIPMENT: EquipmentSlug[] = [
  'dumbbell', 'barbell', 'ez_bar', 'kettlebell', 'bench', 'pull_up_bar', 'band', 'cable', 'machine',
  'medicine_ball', 'exercise_ball', 'foam_roll', 'mat', 'plate', 'trap_bar', 'dip_bars', 'suspension', 'box',
  'hyper_bench', 'jump_rope', 'ab_wheel', 'battle_rope', 'treadmill', 'stationary_bike', 'elliptical', 'rower',
  'stair_climber',
];

/**
 * Muscles (Spanish names). `bodyMap` are the zones of react-body-highlighter; `size` drives the
 * recovery half-life (User Story 4).
 */
export const MUSCLES = [
  { slug: 'chest', nameEs: 'Pecho', group: 'Pecho', size: 'large', bodyMap: ['chest'] },
  { slug: 'shoulders', nameEs: 'Hombros', group: 'Hombros', size: 'medium', bodyMap: ['front-deltoids', 'back-deltoids'] },
  { slug: 'biceps', nameEs: 'Bíceps', group: 'Brazos', size: 'small', bodyMap: ['biceps'] },
  { slug: 'triceps', nameEs: 'Tríceps', group: 'Brazos', size: 'small', bodyMap: ['triceps'] },
  { slug: 'forearms', nameEs: 'Antebrazos', group: 'Brazos', size: 'small', bodyMap: ['forearm'] },
  { slug: 'lats', nameEs: 'Dorsales', group: 'Espalda', size: 'large', bodyMap: ['upper-back'] },
  { slug: 'middle_back', nameEs: 'Espalda media', group: 'Espalda', size: 'large', bodyMap: ['upper-back'] },
  { slug: 'lower_back', nameEs: 'Zona lumbar', group: 'Espalda', size: 'medium', bodyMap: ['lower-back'] },
  { slug: 'traps', nameEs: 'Trapecios', group: 'Espalda', size: 'medium', bodyMap: ['trapezius'] },
  { slug: 'neck', nameEs: 'Cuello', group: 'Espalda', size: 'small', bodyMap: ['neck'] },
  { slug: 'abdominals', nameEs: 'Abdominales', group: 'Abdomen', size: 'medium', bodyMap: ['abs', 'obliques'] },
  { slug: 'quadriceps', nameEs: 'Cuádriceps', group: 'Piernas', size: 'large', bodyMap: ['quadriceps'] },
  { slug: 'hamstrings', nameEs: 'Isquiotibiales', group: 'Piernas', size: 'large', bodyMap: ['hamstring'] },
  { slug: 'glutes', nameEs: 'Glúteos', group: 'Piernas', size: 'large', bodyMap: ['gluteal'] },
  { slug: 'calves', nameEs: 'Pantorrillas', group: 'Piernas', size: 'small', bodyMap: ['calves'] },
  { slug: 'adductors', nameEs: 'Aductores', group: 'Piernas', size: 'medium', bodyMap: ['adductor'] },
  { slug: 'abductors', nameEs: 'Abductores', group: 'Piernas', size: 'medium', bodyMap: ['abductors'] },
] as const;

export type MuscleSlug = (typeof MUSCLES)[number]['slug'];
export const MUSCLE_SLUGS = MUSCLES.map((m) => m.slug) as [MuscleSlug, ...MuscleSlug[]];
export const MUSCLE_GROUPS = [...new Set(MUSCLES.map((m) => m.group))];

export const CATEGORIES = [
  { slug: 'strength', nameEs: 'Fuerza' },
  { slug: 'stretching', nameEs: 'Estiramiento' },
  { slug: 'plyometrics', nameEs: 'Pliometría' },
  { slug: 'cardio', nameEs: 'Cardio' },
  { slug: 'powerlifting', nameEs: 'Powerlifting' },
  { slug: 'olympic_weightlifting', nameEs: 'Halterofilia' },
  { slug: 'strongman', nameEs: 'Strongman' },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];
