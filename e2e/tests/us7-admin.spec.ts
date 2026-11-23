import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FAKE_AI_KEY, completeOnboarding, expect, promoteToAdmin, resetAiSettings, signUpViaApi, test } from '../fixtures';

const COMPOSE = fileURLToPath(new URL('../../infra/docker-compose.e2e.yml', import.meta.url));

// The AI settings are global: these tests run one after another, in one browser project.
test.describe.configure({ mode: 'serial' });

test.describe('US7 · administración de la IA', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'global settings: run once');

  test.beforeAll(() => resetAiSettings());

  test('admin saves the key (only ••••wxyz shown), enables and disables the AI; users see it at once', async ({ page, context, baseURL, browser }) => {
    test.setTimeout(90_000);
    const { email } = await signUpViaApi(context.request, baseURL!);
    promoteToAdmin(email);
    await page.goto('/');
    await completeOnboarding(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    await page.getByRole('link', { name: 'Administración' }).click();
    await expect(page.getByRole('heading', { name: 'Administración' })).toBeVisible();
    await expect(page.getByText('Todavía no hay clave.')).toBeVisible();

    // Wrong key: rejected, nothing stored.
    await page.getByLabel('Clave del servicio de IA').fill('sk-ant-this-key-is-wrong-0000');
    await page.getByRole('button', { name: 'Probar y guardar clave' }).click();
    await expect(page.getByRole('alert')).toContainText('rechazó la clave');

    await page.getByLabel('Clave del servicio de IA').fill(FAKE_AI_KEY);
    await page.getByRole('button', { name: 'Probar y guardar clave' }).click();
    await expect(page.getByText('Clave guardada: ••••wxyz')).toBeVisible();
    await expect(page.getByLabel('Clave del servicio de IA')).toHaveValue('');
    await expect(page.getByText(FAKE_AI_KEY)).toHaveCount(0);

    await page.getByRole('button', { name: 'Probar conexión' }).click();
    await expect(page.getByText(/Conexión correcta/)).toBeVisible();

    // A normal user: coach availability follows the admin switch with no redeploy (SC-010).
    const other = await browser.newContext({ baseURL });
    await signUpViaApi(other.request, baseURL!);
    const status = async () => (await (await other.request.get('/api/coach/status')).json()) as { available: boolean; reason?: string };
    expect(await status()).toEqual({ available: false, reason: 'DISABLED' });
    const started = Date.now();
    await page.getByLabel('Activar la IA para todos').check();
    await expect(page.getByText('Disponible para los usuarios')).toBeVisible();
    expect(await status()).toEqual({ available: true });
    await page.getByLabel('Activar la IA para todos').uncheck();
    await expect(page.getByText(/No disponible \(Desactivado\)/)).toBeVisible();
    expect(await status()).toEqual({ available: false, reason: 'DISABLED' });
    expect(Date.now() - started).toBeLessThan(60_000);

    // A normal user cannot reach the admin API (403) nor see the admin screen.
    expect((await other.request.get('/api/admin/settings/ai')).status()).toBe(403);
    const otherPage = await other.newPage();
    await otherPage.goto('/');
    await completeOnboarding(otherPage);
    await expect(otherPage.getByRole('link', { name: 'Administración' })).toHaveCount(0);
    await otherPage.goto('/admin');
    await expect(otherPage.getByText('Esta sección es sólo para administradores.')).toBeVisible();
    await other.close();

    // The key never appears in the API logs.
    const logs = execFileSync('docker', ['compose', '-f', COMPOSE, 'logs', 'api'], { encoding: 'utf8' });
    expect(logs).not.toContain(FAKE_AI_KEY);

    // History shows what changed.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Historial de cambios' })).toBeVisible();
    await expect(page.getByText('Clave guardada', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('IA activada', { exact: true }).first()).toBeVisible();
  });

  test('admin creates an invitation link that works once; revoked invitations stop working', async ({ page, context, baseURL, browser }) => {
    const { email } = await signUpViaApi(context.request, baseURL!);
    promoteToAdmin(email);
    await page.goto('/');
    await completeOnboarding(page);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Crear invitación' }).click();
    const link = (await page.locator('code').textContent())!;
    expect(link).toMatch(/\/signup\?invite=/);
    const guest = await browser.newContext({ baseURL });
    const g = await guest.newPage();
    await g.goto(new URL(link).pathname + new URL(link).search);
    await g.getByLabel('Tu nombre').fill('Invitada');
    await g.getByLabel('Correo').fill(`inv-${Date.now()}@test.local`);
    await g.getByLabel('Contraseña').fill('una-clave-segura');
    await g.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(g.getByRole('heading', { name: 'Cuéntanos de ti' })).toBeVisible();
    await guest.close();
    await page.reload();
    await expect(page.getByText('Usada').first()).toBeVisible();
  });
});
