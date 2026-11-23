import type { Page } from '@playwright/test';
import { completeOnboarding, expect, signUpViaApi, test, waitForServiceWorker } from '../fixtures';

async function createRoutine(page: Page, name: string, exercises: string[]) {
  await page.getByRole('navigation').getByRole('link', { name: 'Rutinas' }).click();
  await page.getByRole('link', { name: 'Nueva rutina' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva rutina' })).toBeVisible();
  await page.getByLabel('Nombre de la rutina').fill(name);
  for (const ex of exercises) {
    await page.getByRole('button', { name: 'Agregar ejercicio' }).click();
    const dialog = page.getByRole('dialog', { name: 'Elegir ejercicio' });
    await dialog.getByLabel('Buscar ejercicio').fill(ex);
    await dialog.getByRole('button').filter({ has: page.getByText(ex, { exact: true }) }).first().click();
  }
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test.describe('US3 · entrenar y registrar sin conexión', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    test.setTimeout(120_000);
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page); // Casa: mancuernas, banda, colchoneta (kg)
  });

  test('full session offline: log sets in ≤2 taps, reload mid-session, finish, and it reaches the server', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not run service workers');
    await createRoutine(page, 'Brazos', ['Curl martillo', 'Giro ruso']);
    await waitForServiceWorker(page);
    // Make sure the catalog is local before going offline.
    await page.getByRole('navigation').getByRole('link', { name: 'Ejercicios' }).click();
    await expect(page.getByText(/^\d+ ejercicios$/)).toBeVisible({ timeout: 20_000 });

    await context.setOffline(true);
    await page.getByRole('navigation').getByRole('link', { name: 'Entrenar' }).click();
    await page.getByRole('button', { name: 'Empezar «Brazos»' }).click();
    await expect(page.getByRole('heading', { name: 'Brazos' })).toBeVisible();

    const curl = page.getByRole('region', { name: 'Curl martillo' });
    await expect(curl.getByText('3 series × 8–12 reps', { exact: false })).toBeVisible();
    await expect(curl.getByText('Primera vez con este ejercicio.')).toBeVisible();
    // First set: type the weight once, then one tap.
    await curl.getByLabel('Peso (kg)', { exact: true }).fill('12');
    await curl.getByRole('button', { name: 'Registrar serie: Curl martillo' }).click();
    await expect(curl.getByText('12 kg × 12')).toBeVisible();
    await expect(page.getByRole('timer')).toContainText('Descanso 1:');

    // Second set: prefilled with the previous one → a single tap (SC-001).
    await curl.getByRole('button', { name: 'Registrar serie: Curl martillo' }).click();
    await expect(curl.getByText(/Serie 2/).first()).toBeVisible();
    await expect(curl.locator('li', { hasText: '12 kg × 12' })).toHaveCount(2);

    // Reload in the middle of the session (still offline): nothing is lost, timer persists.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Brazos' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Curl martillo' }).locator('li', { hasText: '12 kg × 12' })).toHaveCount(2);
    await expect(page.getByRole('timer')).toBeVisible();
    await page.getByRole('button', { name: 'Saltar' }).click();
    await expect(page.getByRole('timer')).toHaveCount(0);

    // Bodyweight exercise measured by reps.
    const twist = page.getByRole('region', { name: 'Giro ruso' });
    await twist.getByRole('button', { name: 'Registrar serie: Giro ruso' }).click();
    await expect(twist.locator('li')).toHaveCount(1);

    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.getByLabel('¿Qué tan duro fue? (1 a 10)').selectOption('7');
    await page.getByRole('button', { name: 'Guardar entrenamiento' }).click();
    await expect(page.getByRole('heading', { name: '¡Buen trabajo!' })).toBeVisible();
    await expect(page.getByText('Series').locator('..')).toContainText('3');

    // Back online: everything reaches the server exactly once (SC-002: within 60 s).
    await context.setOffline(false);
    const started = Date.now();
    await expect(async () => {
      const page2 = (await (await context.request.get('/api/sync/pull')).json()) as { changes: Array<{ entity: string; data: Record<string, unknown>; deleted: boolean }> };
      const sessions = page2.changes.filter((c) => c.entity === 'workoutSession');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.data).toMatchObject({ status: 'completed', perceivedEffort: 7, name: 'Brazos' });
      expect(page2.changes.filter((c) => c.entity === 'setEntry' && !c.deleted)).toHaveLength(3);
      expect(page2.changes.filter((c) => c.entity === 'sessionExercise')).toHaveLength(2);
    }).toPass({ timeout: 60_000 });
    expect(Date.now() - started).toBeLessThan(60_000);

    // Next time, the last performance is shown and used to prefill.
    await page.getByRole('button', { name: 'Listo' }).click();
    await page.getByRole('button', { name: 'Empezar «Brazos»' }).click();
    const curl2 = page.getByRole('region', { name: 'Curl martillo' });
    await expect(curl2.getByText('Última vez: 12 kg × 12 · 12 kg × 12')).toBeVisible();
    await expect(curl2.getByLabel('Peso (kg)', { exact: true })).toHaveValue('12');
  });

  test('swap an exercise for an equivalent one doable at the current location, with the reason', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrenamiento libre' }).click();
    await page.getByRole('button', { name: 'Agregar ejercicio' }).click();
    const picker = page.getByRole('dialog', { name: 'Elegir ejercicio' });
    await picker.getByLabel('Sólo lo que puedo hacer en Casa').uncheck();
    await picker.getByLabel('Buscar ejercicio').fill('Sentadilla completa con barra');
    await picker.getByRole('button', { name: /Sentadilla completa con barra/ }).click();
    await page.getByRole('button', { name: 'Cambiar ejercicio' }).click();
    const sheet = page.getByRole('dialog', { name: 'Ejercicios equivalentes' });
    await expect(sheet.getByText(/Trabaja cuádriceps con .*disponible en Casa\./).first()).toBeVisible();
    const first = sheet.getByRole('button').nth(1);
    const chosen = (await first.locator('span.font-medium').textContent())!;
    await first.click();
    await expect(page.getByRole('region', { name: chosen })).toBeVisible();
  });

  test('during a session: see how to do it, adjust sets/reps/rest, use − / + and take time off the rest', async ({ page, context }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Ejercicios' }).click();
    await expect(page.getByText(/^\d+ ejercicios$/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('navigation').getByRole('link', { name: 'Entrenar' }).click();
    await page.getByRole('button', { name: 'Entrenamiento libre' }).click();
    await page.getByRole('button', { name: 'Agregar ejercicio' }).click();
    const picker = page.getByRole('dialog', { name: 'Elegir ejercicio' });
    await picker.getByLabel('Buscar ejercicio').fill('Curl martillo');
    await picker.getByRole('button').filter({ has: page.getByText('Curl martillo', { exact: true }) }).first().click();

    const curl = page.getByRole('region', { name: 'Curl martillo' });
    // Free session: the same default range the suggestion engine uses.
    await expect(curl.getByText('3 series × 8–12 reps · descanso 1:30')).toBeVisible();

    // How to do it: animated pictures and the steps in Spanish, inside the card.
    await curl.getByRole('button', { name: 'Ver cómo se hace' }).click();
    await expect(curl.getByRole('img', { name: 'Curl martillo' })).toBeVisible();
    await expect(curl.getByText(/mancuerna en cada mano/)).toBeVisible();
    const loaded = await curl.getByRole('img', { name: 'Curl martillo' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);

    // Adjust today's goal: 4 sets of 6–8 with 2 minutes of rest.
    await curl.getByRole('button', { name: 'Ajustar' }).click();
    const form = curl.getByRole('form', { name: 'Meta para hoy' });
    await form.getByRole('button', { name: 'Más Series' }).click();
    await form.getByLabel('Reps mín.', { exact: true }).fill('6');
    await form.getByLabel('Reps máx.', { exact: true }).fill('8');
    await form.getByLabel('Descanso entre series').selectOption({ label: '2:00' });
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(curl.getByText('4 series × 6–8 reps · descanso 2:00')).toBeVisible();
    await expect(curl.getByText('Serie 1 de 4')).toBeVisible();

    // A wrong range is refused with a clear message.
    await curl.getByRole('button', { name: 'Ajustar' }).click();
    await form.getByLabel('Reps mín.', { exact: true }).fill('9');
    await form.getByRole('button', { name: 'Guardar' }).click();
    await expect(form.getByRole('alert')).toContainText('el mínimo no puede ser mayor que el máximo');
    await form.getByRole('button', { name: 'Cancelar' }).click();

    // − / + buttons, then log: the rest uses the new 2 minutes; −15 s takes time off.
    await curl.getByLabel('Peso (kg)', { exact: true }).fill('10');
    await curl.getByRole('button', { name: 'Más Peso (kg)' }).click();
    await expect(curl.getByLabel('Peso (kg)', { exact: true })).toHaveValue('12.5');
    await curl.getByLabel('Reps', { exact: true }).fill('8');
    await curl.getByRole('button', { name: 'Menos Reps' }).click();
    await curl.getByRole('button', { name: 'Registrar serie: Curl martillo' }).click();
    await expect(curl.getByText('12,5 kg × 7')).toBeVisible();
    await expect(page.getByRole('timer')).toContainText(/Descanso (2:00|1:5\d)/);
    await page.getByRole('button', { name: '−15 s' }).click();
    await expect(page.getByRole('timer')).toContainText(/Descanso 1:[34]\d/);
    await expect(curl.getByText('Serie 2 de 4')).toBeVisible();

    // The new goal reached the server.
    await expect(async () => {
      const pulled = (await (await context.request.get('/api/sync/pull')).json()) as { changes: Array<{ entity: string; data: Record<string, unknown> }> };
      const se = pulled.changes.find((c) => c.entity === 'sessionExercise');
      expect(se?.data).toMatchObject({ targetSets: 4, repMin: 6, repMax: 8, restSeconds: 120 });
      expect(se?.data).not.toHaveProperty('sets');
    }).toPass({ timeout: 15_000 });
  });

  test('editing the same routine on two devices keeps the most recent change', async ({ page, context, browser, baseURL }) => {
    await createRoutine(page, 'Pierna', ['Zancada hacia atrás con mancuernas']);
    const other = await browser.newContext({ baseURL });
    await other.addCookies(await context.cookies());
    const page2 = await other.newPage();
    await page2.goto('/routines');
    await expect(page2.getByRole('heading', { name: 'Pierna' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('link', { name: 'Editar' }).click();
    await page.getByLabel('Nombre de la rutina').fill('Pierna A');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Pierna A' })).toBeVisible();

    await page2.getByRole('link', { name: 'Editar' }).click();
    await page2.getByLabel('Nombre de la rutina').fill('Pierna B');
    await page2.getByRole('button', { name: 'Guardar' }).click();

    await expect(async () => {
      const pulled = (await (await context.request.get('/api/sync/pull')).json()) as { changes: Array<{ entity: string; data: { name: string } }> };
      const routines = pulled.changes.filter((c) => c.entity === 'routine');
      expect(routines).toHaveLength(1);
      expect(routines[0]?.data.name).toBe('Pierna B');
    }).toPass({ timeout: 30_000 });
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Pierna B' })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await other.close();
  });
});
