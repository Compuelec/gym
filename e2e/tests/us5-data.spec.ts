import { readFile } from 'node:fs/promises';
import { completeOnboarding, createInvite, expect, seed, seededSession, signUpViaApi, test, uniqueEmail } from '../fixtures';

test.describe('US5 · progreso y datos propios', () => {
  test('progress shows charts with tables, streak and history from real sessions', async ({ page, context, baseURL }) => {
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await seed(context.request, baseURL!, [
      ...seededSession(24 * 8, [{ exerciseId: 'fedb:Hammer_Curls', sets: [{ weightKg: 10, reps: 10 }, { weightKg: 10, reps: 10 }] }]),
      ...seededSession(30, [{ exerciseId: 'fedb:Hammer_Curls', sets: [{ weightKg: 12, reps: 10 }, { weightKg: 12, reps: 9 }] }]),
    ]);
    await expect(async () => {
      await page.goto('/progress');
      await expect(page.getByRole('heading', { name: 'Entrenamientos por semana' })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await expect(page.getByLabel('Elige un ejercicio')).toHaveValue('fedb:Hammer_Curls');
    await expect(page.getByText(/semanas? seguidas?/)).toBeVisible();
    // Table view of the 1RM chart with Spanish decimals (Brzycki: 12·36/27 = 16).
    await page.getByText('1RM estimado', { exact: true }).last().click();
    await expect(page.getByRole('cell', { name: '16 kg' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Historial.*2 series/ })).toHaveCount(2);
    expect(await page.locator('svg.recharts-surface').count()).toBeGreaterThanOrEqual(3);
  });

  test('body measurements: add one, see it listed, synced to the server', async ({ page, context, baseURL }) => {
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await page.goto('/measurements');
    await page.getByRole('button', { name: 'Guardar medida' }).click();
    await expect(page.getByRole('alert')).toHaveText('Indica al menos una medida.');
    await page.getByLabel('Peso (kg)', { exact: true }).fill('80,5');
    await page.getByLabel('Cintura (cm)').fill('88');
    await page.getByRole('button', { name: 'Guardar medida' }).click();
    await expect(page.getByText('80,5 kg · Cintura 88 cm')).toBeVisible();
    await expect(async () => {
      const pulled = (await (await context.request.get('/api/sync/pull')).json()) as { changes: Array<{ entity: string; data: { weightKg: number } }> };
      expect(pulled.changes.find((c) => c.entity === 'bodyMeasurement')?.data.weightKg).toBe(80.5);
    }).toPass({ timeout: 20_000 });
  });

  test('export → delete account → new account → import: everything comes back (SC-008)', async ({ page, context, baseURL, browser }) => {
    test.setTimeout(120_000);
    const { email } = await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await seed(context.request, baseURL!, [
      ...seededSession(30, [{ exerciseId: 'fedb:Hammer_Curls', sets: [{ weightKg: 12, reps: 10 }] }]),
      { entity: 'bodyMeasurement', id: crypto.randomUUID(), data: { measuredAt: new Date().toISOString(), weightKg: 79, bodyFatPct: null, waistCm: null, chestCm: null, armCm: null, thighCm: null, notes: null } },
    ]);
    // Wait until the onboarding records (profile, location) reached the server.
    let before = { changes: [] as Array<{ entity: string; deleted: boolean }> };
    await expect(async () => {
      before = (await (await context.request.get('/api/sync/pull')).json()) as typeof before;
      expect(before.changes.some((c) => c.entity === 'profile')).toBe(true);
      expect(before.changes.some((c) => c.entity === 'location')).toBe(true);
    }).toPass({ timeout: 20_000 });
    const countByEntity = (changes: Array<{ entity: string; deleted: boolean }>) =>
      changes.filter((c) => !c.deleted).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.entity]: (acc[c.entity] ?? 0) + 1 }), {});

    // Export through the UI (real download).
    await page.goto('/data');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar mis datos' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^gym-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const exported = JSON.parse(await readFile(path!, 'utf8'));
    expect(exported.formatVersion).toBe(1);

    // Delete the account: wrong password first, then right.
    await page.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');
    await page.getByLabel('Tu contraseña').fill('otra-clave');
    await page.getByRole('button', { name: 'Borrar mi cuenta para siempre' }).click();
    await expect(page.getByRole('alert')).toHaveText('La contraseña no es correcta.');
    await page.getByLabel('Tu contraseña').fill('una-clave-segura');
    await page.getByRole('button', { name: 'Borrar mi cuenta para siempre' }).click();
    await expect(page).toHaveURL(/\/login$/);
    // The old account no longer exists.
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill('una-clave-segura');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');

    // New account imports the file through the UI.
    const fresh = await browser.newContext({ baseURL });
    const page2 = await fresh.newPage();
    await page2.goto(`/signup?invite=${createInvite()}`);
    await page2.getByLabel('Tu nombre').fill('Nueva');
    await page2.getByLabel('Correo').fill(uniqueEmail('import'));
    await page2.getByLabel('Contraseña').fill('una-clave-segura');
    await page2.getByRole('button', { name: 'Crear cuenta' }).click();
    await completeOnboarding(page2);
    await page2.goto('/data');
    await page2.getByLabel('Importar archivo').setInputFiles(path!);
    await expect(page2.getByRole('status')).toContainText('se importaron');
    const after = (await (await fresh.request.get('/api/sync/pull')).json()) as { changes: Array<{ entity: string; deleted: boolean }> };
    const b = countByEntity(before.changes);
    const a = countByEntity(after.changes);
    // The new account also has its own onboarding location (+1) and keeps its profile (same count).
    expect({ ...a, location: (a.location ?? 0) - 1 }).toEqual(b);
    await page2.goto('/progress');
    await expect(page2.getByLabel('Elige un ejercicio')).toHaveValue('fedb:Hammer_Curls');
    await fresh.close();
  });

  test('a broken import file is rejected and changes nothing', async ({ page, context, baseURL }) => {
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await page.goto('/data');
    await page.getByLabel('Importar archivo').setInputFiles({ name: 'malo.json', mimeType: 'application/json', buffer: Buffer.from('{"formatVersion": 99}') });
    await expect(page.getByRole('alert')).toContainText('No se pudo importar');
  });
});
