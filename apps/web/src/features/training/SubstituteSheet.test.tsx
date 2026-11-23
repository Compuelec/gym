import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExerciseView } from '@/features/catalog/exercises';
import { SubstituteSheet } from './SubstituteSheet';

afterEach(cleanup);

const ex = (id: string, nameEs: string): ExerciseView =>
  ({ id, nameEs, nameEn: nameEs, primaryMuscles: ['middle_back'], secondaryMuscles: [], equipment: ['dumbbell'], level: 'beginner', category: 'strength', mechanic: 'compound', force: 'pull', measure: 'weight_reps', media: [], instructionsEs: [], translated: true, license: 'Unlicense', authors: [], own: false, retiredAt: null }) as unknown as ExerciseView;

describe('SubstituteSheet', () => {
  it('never offers an exercise that is already in the plan', () => {
    const target = ex('row', 'Remo con mancuerna');
    const inPlan = ex('bent-row', 'Remo inclinado con dos mancuernas');
    const free = ex('seal-row', 'Remo foca');
    render(<SubstituteSheet target={target} candidates={[target, inPlan, free]} exclude={['row', 'bent-row']} location={{ name: 'Casa', equipment: ['dumbbell'] }} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Remo foca')).toBeTruthy();
    expect(screen.queryByText('Remo inclinado con dos mancuernas')).toBeNull();
  });
});
