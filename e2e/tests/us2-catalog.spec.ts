import type { APIRequestContext } from '@playwright/test';
import { completeOnboarding, expect, signUpViaApi, test, waitForServiceWorker } from '../fixtures';

interface CatalogEx {
  id: string;
  nameEs: string;
  primaryMuscles: string[];
  equipment: string[];
  retiredAt: string | null;
}

async function loadCatalog(request: APIRequestContext) {
  const manifest = await (await request.get('/catalog/manifest.json')).json();
  const file = await (await request.get(`/catalog/${manifest.file}`)).json();
  return { manifest, exercises: file.exercises as CatalogEx[] };
}

test.describe('US2 · catálogo de ejercicios', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page); // Casa: mancuernas, banda elástica, colchoneta
    await page.getByRole('navigation').getByRole('link', { name: 'Ejercicios' }).click();
    await expect(page.getByRole('heading', { name: 'Ejercicios' })).toBeVisible();
  });

  test('the whole catalog loads, and «Casa» + «Pecho» only shows exercises doable at home', async ({ page, request }) => {
    const { manifest, exercises } = await loadCatalog(request);
    expect(manifest.exerciseCount).toBeGreaterThanOrEqual(800);
    await expect(page.getByText(`${manifest.exerciseCount} ejercicios`)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByLabel('Lugar').selectOption({ label: 'Casa' });
    await page.getByLabel('Músculo').selectOption({ label: 'Pecho' });
    const home = ['dumbbell', 'band', 'mat'];
    const expected = exercises.filter(
      (e) => !e.retiredAt && e.primaryMuscles.includes('chest') && e.equipment.every((q) => home.includes(q)),
    );
    expect(expected.length).toBeGreaterThan(5);
    await expect(page.getByText(`${expected.length} ejercicios`)).toBeVisible();
    // Nothing that needs a barbell or a machine.
    await expect(page.getByRole('link', { name: /Press de banca con agarre cerrado en multipower/ })).toHaveCount(0);

    // Open one and come back: the filtered list is still there (filters live in the address).
    await expect(page.getByRole('button', { name: 'Filtros (2)' })).toBeVisible();
    const pushups = page.getByRole('link', { name: /^Flexiones Pecho/ });
    await pushups.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    const y = await page.evaluate(() => window.scrollY);
    await pushups.click();
    await expect(page.getByRole('heading', { name: 'Flexiones' })).toBeVisible();
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.getByText(`${expected.length} ejercicios`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtros (2)' })).toBeVisible();
    // Same spot in the list, not back at the top.
    if (y > 0) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 60);
  });

  test('search ignores accents and case; detail shows images, body map, steps and license', async ({ page }) => {
    await page.getByLabel('Buscar ejercicio').fill('SENTADILLA AL CAJON CON CADENAS');
    await expect(page.getByText('1 ejercicio')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: /Sentadilla al cajón con cadenas/ }).click();
    await expect(page.getByRole('heading', { name: 'Sentadilla al cajón con cadenas' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Sentadilla al cajón con cadenas' })).toBeVisible();
    await expect(page.getByText('Músculos principales')).toBeVisible();
    await expect(page.getByText('Cuádriceps').first()).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible(); // body map
    await expect(page.getByRole('heading', { name: 'Cómo se hace' })).toBeVisible();
    await expect(page.getByText(/Licencia: Unlicense/)).toBeVisible();
    // Image actually loads.
    const loaded = await page.getByRole('img', { name: 'Sentadilla al cajón con cadenas' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  });

  test('everyday words find exercises; no dead ends when nothing matches exactly or the place hides them', async ({ page }) => {
    // As typed in production: «banca» (catalog says «banco»), «pectorales» (muscle «Pecho»), and
    // a combination no exercise has. The closest ones show up instead of an empty list.
    await page.getByLabel('Buscar ejercicio').fill('curls con barra en banca para pectorales');
    await expect(page.getByText('Estos son los más parecidos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /^Press de banca con barra, agarre medio/ })).toBeVisible();

    await page.getByLabel('Buscar ejercicio').fill('press banca pecho');
    await expect(page.getByText('Estos son los más parecidos')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Press de banca con barra, agarre medio/ })).toBeVisible();

    // Casa has no barbell: the place filter hides them, but says so and lets you see them.
    await page.getByRole('button', { name: 'Filtros' }).click();
    await page.getByLabel('Lugar').selectOption({ label: 'Casa' });
    await expect(page.getByRole('link', { name: /^Press de banca con barra, agarre medio/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Ver también \d+ que piden? equipo que no tienes en Casa/ }).click();
    await expect(page.getByRole('link', { name: /^Press de banca con barra, agarre medio/ })).toBeVisible();
  });

  test('favorites sync to a second device; own exercises are private', async ({ page, browser, baseURL, context }) => {
    test.setTimeout(90_000); // several browser contexts
    await page.getByLabel('Buscar ejercicio').fill('curl martillo');
    await page.getByRole('link', { name: /^Curl martillo(?! (alterno|en|cruzado|predicador))/ }).click();
    await page.getByRole('button', { name: 'Agregar a favoritos' }).click();
    await expect(page.getByRole('button', { name: 'Quitar de favoritos' })).toBeVisible();

    // Own exercise.
    await page.getByRole('navigation').getByRole('link', { name: 'Ejercicios' }).click();
    await page.getByRole('link', { name: 'Crear ejercicio' }).click();
    await expect(page.getByRole('heading', { name: 'Ejercicio nuevo' })).toBeVisible();
    await page.getByLabel('Nombre').fill('Remo con mochila');
    await page.getByRole('group', { name: 'Músculos principales' }).getByText('Espalda media').click();
    await page.getByLabel('Pasos (uno por línea)').fill('Llena una mochila\nRema hacia el abdomen');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Remo con mochila' })).toBeVisible();
    await expect(page.getByText('Rema hacia el abdomen')).toBeVisible();

    // Same account on another device sees the favorite and the own exercise.
    const cookies = await context.cookies();
    const other = await browser.newContext({ baseURL });
    await other.addCookies(cookies);
    const page2 = await other.newPage();
    await expect(async () => {
      await page2.goto('/exercises');
      await page2.getByRole('button', { name: 'Filtros' }).click();
      await page2.getByLabel('Solo favoritos').check();
      await expect(page2.getByRole('link', { name: /^Curl martillo(?! (alterno|en|cruzado|predicador))/ })).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await page2.getByLabel('Solo favoritos').uncheck();
    await page2.getByLabel('Buscar ejercicio').fill('mochila');
    // The own exercise may arrive on the next sync cycle after the favorite (slow mobile runs).
    await expect(page2.getByRole('link', { name: /Remo con mochila/ })).toBeVisible({ timeout: 20_000 });
    await other.close();

    // A different user never sees it.
    const stranger = await browser.newContext({ baseURL });
    await signUpViaApi(stranger.request, baseURL!);
    const page3 = await stranger.newPage();
    await page3.goto('/');
    await completeOnboarding(page3);
    await page3.goto('/exercises');
    await page3.getByLabel('Buscar ejercicio').fill('mochila');
    await expect(page3.getByText('0 ejercicios')).toBeVisible({ timeout: 15_000 });
    await stranger.close();
  });

  test('exercise details and images work offline after the first load', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not run service workers');
    await waitForServiceWorker(page);
    await page.getByLabel('Buscar ejercicio').fill('giro ruso');
    await page.getByRole('link', { name: /Giro ruso/ }).click();
    await expect(page.getByRole('img', { name: 'Giro ruso' })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Giro ruso' })).toBeVisible();
    const loaded = await page.getByRole('img', { name: 'Giro ruso' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
    await context.setOffline(false);
  });

  test('credits page lists the sources and licenses', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    await page.getByRole('link', { name: 'Créditos de ejercicios e imágenes' }).click();
    await expect(page.getByRole('heading', { name: 'Créditos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'free-exercise-db' })).toBeVisible();
    await expect(page.getByText(/Licencia: Unlicense/)).toBeVisible();
  });
});
