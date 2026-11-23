import { completeOnboarding, expect, seed, seededSession, signUpViaApi, test, waitForServiceWorker } from '../fixtures';

test.describe('US4 · recomendaciones inteligentes sin conexión', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page); // Casa: mancuernas, banda, colchoneta
    // History: curl 3×12 @ 12 kg four days ago; a heavy leg day yesterday.
    await seed(context.request, baseURL!, [
      ...seededSession(96, [{ exerciseId: 'fedb:Hammer_Curls', sets: [{ weightKg: 12, reps: 12 }, { weightKg: 12, reps: 12 }, { weightKg: 12, reps: 12 }] }]),
      ...seededSession(20, [
        { exerciseId: 'fedb:Barbell_Full_Squat', sets: Array.from({ length: 6 }, () => ({ weightKg: 80, reps: 8 })) },
        { exerciseId: 'fedb:Leg_Press', sets: Array.from({ length: 6 }, () => ({ weightKg: 150, reps: 10 })) },
      ]),
      {
        entity: 'routine',
        id: crypto.randomUUID(),
        data: {
          name: 'Brazos',
          programId: null,
          weekIndex: null,
          dayIndex: null,
          locationId: null,
          notes: null,
          items: [{ position: 0, exerciseId: 'fedb:Hammer_Curls', supersetGroup: null, targetSets: 3, repMin: 8, repMax: 12, targetSeconds: null, targetRir: null, restSeconds: 60, notes: null }],
        },
      },
    ]);
    // Let the app pull the history.
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole('button', { name: 'Empezar «Brazos»' })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('suggests the next load with its reason, warns of a new record, all offline', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not run service workers');
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Empezar «Brazos»' }).click();
    const curl = page.getByRole('region', { name: 'Curl martillo' });
    await expect(curl.getByText('Sugerencia: 14 kg × 8')).toBeVisible();
    await curl.getByRole('button', { name: '¿Por qué?' }).click();
    await expect(curl.getByText('Completaste 3×12 con 12 kg: sube a 14 kg y vuelve a 8 repeticiones.')).toBeVisible();
    // Prefilled with the suggestion: one tap logs it, and it is a new record.
    await expect(curl.getByLabel('Peso (kg)', { exact: true })).toHaveValue('14');
    await curl.getByRole('button', { name: 'Registrar serie: Curl martillo' }).click();
    await expect(curl.getByRole('status')).toContainText('¡Nuevo récord! peso máximo, 1RM estimado');
    await context.setOffline(false);
  });

  test('recovery map shows legs fatigued; «Rutina de hoy» avoids them and uses home equipment', async ({ page, context, browserName }) => {
    if (browserName !== 'webkit') {
      await waitForServiceWorker(page);
      await context.setOffline(true);
    }
    await page.getByRole('link', { name: 'Ver recuperación muscular' }).click();
    await expect(page.getByRole('heading', { name: 'Recuperación' })).toBeVisible();
    const quads = page.getByRole('listitem').filter({ hasText: 'Cuádriceps' });
    await expect(quads).toContainText('Fatigado');
    await expect(page.getByRole('listitem').filter({ hasText: 'Pecho' })).toContainText('Recuperado');

    await page.getByRole('navigation').getByRole('link', { name: 'Entrenar' }).click();
    await page.getByRole('link', { name: 'Rutina de hoy' }).click();
    await page.getByLabel('¿Cuánto tiempo tienes?').selectOption('30');
    await page.getByRole('button', { name: 'Proponer rutina' }).click();
    await expect(page.getByText(/Evitamos piernas porque los trabajaste hace poco\./)).toBeVisible();
    await expect(page.getByText(/con el equipo de Casa/)).toBeVisible();
    const items = page.getByRole('listitem');
    expect(await items.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(/Duración estimada: \d+ min/)).toBeVisible();
    await page.getByRole('button', { name: 'Empezar esta rutina' }).click();
    await expect(page.getByRole('heading', { name: 'Rutina de hoy' })).toBeVisible();
    await expect(page.getByText(/^\d series × /).first()).toBeVisible();
    if (browserName !== 'webkit') await context.setOffline(false);
  });

  test('exercise detail shows the personal records', async ({ page }) => {
    await page.goto('/exercises/fedb%3AHammer_Curls');
    await expect(page.getByRole('heading', { name: 'Tus récords' })).toBeVisible();
    await expect(page.getByText('Peso máximo').locator('..')).toContainText('12 kg');
    await expect(page.getByText('1RM estimado').locator('..')).toContainText('16,8 kg'); // Epley: 12·(1+12/30), Spanish decimal comma
  });
});
