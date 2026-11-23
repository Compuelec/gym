import { completeOnboarding, expect, signUpViaApi, test } from '../fixtures';

test.describe('Usabilidad · del catálogo a las rutinas y rutina de hoy editable', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page); // Casa: mancuernas, banda, colchoneta
  });

  test('pick exercises in the catalog → new routine with them; add one more from its detail page', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Ejercicios' }).click();
    await expect(page.getByText(/^\d+ ejercicios$/)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Elegir' }).click();
    await page.getByLabel('Buscar ejercicio').fill('curl martillo');
    await page.getByRole('button', { name: /^Curl martillo Bíceps/ }).click();
    await page.getByLabel('Buscar ejercicio').fill('flexiones');
    await page.getByRole('button', { name: /^Flexiones Pecho/ }).click();
    await expect(page.getByText('2 elegidos')).toBeVisible();
    await page.getByRole('button', { name: 'A una rutina' }).click();
    await page.getByRole('button', { name: 'Crear rutina nueva' }).click();

    await expect(page.getByRole('heading', { name: 'Nueva rutina' })).toBeVisible();
    await expect(page.getByText('1. Curl martillo')).toBeVisible();
    await expect(page.getByText('2. Flexiones')).toBeVisible();
    await page.getByLabel('Nombre de la rutina').fill('Tren superior');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Tren superior' })).toBeVisible();
    await expect(page.getByText('2 ejercicios')).toBeVisible();

    // From an exercise page: «Agregar a una rutina» → the existing routine.
    await page.goto('/exercises/fedb%3AGoblet_Squat');
    await page.getByRole('button', { name: 'Agregar a una rutina' }).click();
    const sheet = page.getByRole('dialog', { name: 'Agregar a una rutina' });
    await sheet.getByRole('button', { name: /Tren superior/ }).click();
    await expect(sheet.getByRole('status')).toContainText('Agregamos el ejercicio a «Tren superior».');
    await sheet.getByRole('link', { name: 'Ver rutina' }).click();
    await expect(page.getByText('3. Sentadilla goblet')).toBeVisible();

    // «Volver» goes back where the user came from.
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page).toHaveURL(/\/exercises\/fedb%3AGoblet_Squat$/);
  });

  test('today: a balanced plan with pictures that can be edited, fitted to the time, saved and started', async ({ page }) => {
    await page.getByRole('link', { name: 'Rutina de hoy' }).click();
    await page.getByLabel('¿Cuánto tiempo tienes?').selectOption('45');
    await page.getByRole('button', { name: 'Proponer rutina' }).click();
    // A fresh beginner starts with the big groups.
    await expect(page.getByText(/^Foco: piernas(,| y) espalda/)).toBeVisible();
    const cards = page.locator('ol > li');
    const first = cards.first();
    await expect(first.locator('img').first()).toBeVisible();

    // Edit the first exercise: one more set, less rest.
    const firstName = (await first.getAttribute('aria-label'))!;
    const sets = first.getByLabel('Series', { exact: true });
    const before = Number(await sets.inputValue());
    await first.getByRole('button', { name: 'Más Series' }).click();
    await expect(sets).toHaveValue(String(before + 1));
    await first.getByLabel('Descanso entre series').selectOption({ label: '1:00' });
    await expect(first).toContainText(`${before + 1} × `);
    await expect(first).toContainText('descanso 1:00');

    // Swap the second one, remove the third.
    const count = await cards.count();
    await cards.nth(1).getByRole('button', { name: /^Cambiar ejercicio/ }).click();
    const subs = page.getByRole('dialog', { name: 'Ejercicios equivalentes' });
    const option = subs.getByRole('button').nth(1);
    const chosen = (await option.locator('span.font-medium').textContent())!;
    await option.click();
    await expect(cards.nth(1)).toHaveAttribute('aria-label', chosen);
    await cards.nth(2).getByRole('button', { name: /^Quitar/ }).click();
    await expect(cards).toHaveCount(count - 1);

    // Back to the time available.
    const fit = page.getByRole('button', { name: 'Ajustar al tiempo' });
    if (await fit.isVisible()) await fit.click();
    const estimate = await page.getByText(/Duración estimada: \d+ de 45 min/).textContent();
    const minutes = Number(estimate!.match(/(\d+) de 45/)![1]);
    expect(minutes).toBeLessThanOrEqual(45);
    expect(minutes).toBeGreaterThanOrEqual(35);

    await page.getByRole('button', { name: 'Guardar como rutina' }).click();
    await expect(page.getByText('Guardada en Rutinas: la encuentras ahí para repetirla.')).toBeVisible();

    await page.getByRole('button', { name: 'Empezar esta rutina' }).click();
    await expect(page.getByRole('heading', { name: 'Rutina de hoy' })).toBeVisible();
    await expect(page.getByRole('region', { name: firstName }).getByText(/descanso 1:00$/)).toBeVisible();
    await expect(page.getByRole('region', { name: chosen })).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Rutinas' }).click();
    await expect(page.getByRole('heading', { name: /^Rutina de hoy / })).toBeVisible();
  });
});
