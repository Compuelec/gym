/**
 * Fixed equipment vocabulary (Spanish names). Locations list which of these they have; exercises
 * list which they require. Muscles are added with the catalog (User Story 2).
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
] as const;

export type EquipmentSlug = (typeof EQUIPMENT)[number]['slug'];

export const EQUIPMENT_SLUGS = EQUIPMENT.map((e) => e.slug) as [EquipmentSlug, ...EquipmentSlug[]];

/** Everything except exercise/foam accessories: a full commercial gym. */
export const FULL_GYM_EQUIPMENT: EquipmentSlug[] = [
  'dumbbell', 'barbell', 'ez_bar', 'kettlebell', 'bench', 'pull_up_bar', 'band', 'cable', 'machine',
  'medicine_ball', 'exercise_ball', 'foam_roll', 'mat',
];
