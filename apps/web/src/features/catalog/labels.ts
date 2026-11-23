import { CATEGORIES, EQUIPMENT, MUSCLES } from '@gym/shared';

export const muscleName = new Map<string, string>(MUSCLES.map((m) => [m.slug, m.nameEs]));
export const equipmentName = new Map<string, string>(EQUIPMENT.map((e) => [e.slug, e.nameEs]));
export const categoryName = new Map<string, string>(CATEGORIES.map((c) => [c.slug, c.nameEs]));

export const names = (list: readonly string[], map: Map<string, string>) => list.map((s) => map.get(s) ?? s).join(', ');
