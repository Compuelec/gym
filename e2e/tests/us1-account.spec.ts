import { completeOnboarding, createInvite, expect, test, uniqueEmail, waitForServiceWorker } from '../fixtures';

test.describe('US1 · cuenta e instalación', () => {
  test('sign-up with an invite link, onboarding with locations, and the same data on a second device', async ({ page, browser, baseURL }) => {
    test.setTimeout(90_000); // several browser contexts
    const started = Date.now();
    const email = uniqueEmail('us1');
    const invite = createInvite();

    // 1) Invite link prefills the code.
    await page.goto(`/signup?invite=${invite}`);
    await expect(page.getByLabel('Código de invitación')).toHaveValue(invite);
    await page.getByLabel('Tu nombre').fill('Carla Pérez');
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill('una-clave-segura');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // 2) Onboarding wizard.
    await expect(page.getByRole('heading', { name: 'Cuéntanos de ti' })).toBeVisible();
    await page.getByLabel('¿Cuál es tu objetivo principal?').selectOption('strength');
    await page.getByLabel('Días por semana').selectOption('4');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Casa is preselected with dumbbells, band and mat; add a pull-up bar. Also enable Gimnasio.
    const home = page.locator('div.rounded-lg', { has: page.getByText('Casa', { exact: true }) }).first();
    await home.getByText('Barra de dominadas').click();
    await page.getByLabel('Gimnasio').check();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByText('no reemplaza el consejo de un médico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comenzar' })).toBeDisabled();
    await page.getByLabel('Entiendo y acepto').check();
    await page.getByRole('button', { name: 'Comenzar' }).click();
    await expect(page.getByRole('heading', { name: 'Hola, Carla' })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(3 * 60_000); // SC-007

    // 3) Profile shows what was chosen.
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    await expect(page.getByLabel('¿Cuál es tu objetivo principal?')).toHaveValue('strength');
    await expect(page.getByLabel('Días por semana')).toHaveValue('4');
    await expect(page.getByText('Mancuernas, Barra de dominadas, Banda elástica, Colchoneta')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gimnasio' })).toBeVisible();

    // Wait until everything reached the server.
    await expect(page.getByText(/cambios por sincronizar/)).toHaveCount(0);

    // 4) Second device: sign in, no onboarding, same profile and locations.
    const other = await browser.newContext({ baseURL });
    const page2 = await other.newPage();
    await page2.goto('/');
    await expect(page2).toHaveURL(/\/login$/);
    await page2.getByLabel('Correo').fill(email);
    await page2.getByLabel('Contraseña').fill('una-clave-segura');
    await page2.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page2.getByRole('heading', { name: 'Hola, Carla' })).toBeVisible();
    await page2.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    await expect(page2.getByLabel('Días por semana')).toHaveValue('4');
    await expect(page2.getByRole('heading', { name: 'Casa' })).toBeVisible();
    await expect(page2.getByRole('heading', { name: 'Gimnasio' })).toBeVisible();

    // 5) An edit on device 2 reaches device 1.
    await page2.getByLabel('Minutos por sesión').selectOption('60');
    // Device 1 picks it up on its next sync (opening the app syncs immediately).
    await expect(async () => {
      await page.reload();
      await expect(page.getByLabel('Minutos por sesión')).toHaveValue('60', { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await other.close();
  });

  test('a signed-in user keeps using the app offline after a reload', async ({ page, context, browserName, baseURL }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not run service workers');
    const { signUpViaApi } = await import('../fixtures');
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Hola/ })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    // Offline edits are kept and synced later.
    await page.getByLabel('Días por semana').selectOption('6');
    await expect(page.getByText('1 cambio por sincronizar').first()).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(/cambios por sincronizar/)).toHaveCount(0);
  });

  test('sign out syncs first and wipes this device', async ({ page, context, baseURL }) => {
    const { signUpViaApi } = await import('../fixtures');
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(dbs.filter((n) => n?.startsWith('gym-'))).toEqual([]);
  });
});
