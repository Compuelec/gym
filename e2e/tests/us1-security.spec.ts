import { createInvite, expect, signUpViaApi, test, uniqueEmail } from '../fixtures';
import { randomUUID } from 'node:crypto';

test.describe('US1 · lo que no se debe poder hacer', () => {
  test('sign-up without a valid invite shows a Spanish error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Código de invitación').fill('AAAA-BBBB-CCCC-DDDD');
    await page.getByLabel('Tu nombre').fill('Sin invitación');
    await page.getByLabel('Correo').fill(uniqueEmail('noinv'));
    await page.getByLabel('Contraseña').fill('una-clave-segura');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert')).toHaveText('Necesitas una invitación válida para crear una cuenta.');
    await expect(page).toHaveURL(/\/signup/);
  });

  test('an invite cannot be used twice', async ({ request, baseURL }) => {
    const code = createInvite();
    const origin = new URL(baseURL!).origin;
    const first = await request.post('/api/auth/sign-up/email', {
      headers: { origin },
      data: { email: uniqueEmail(), password: 'una-clave-segura', name: 'A', inviteCode: code },
    });
    expect(first.status()).toBe(200);
    const second = await request.post('/api/auth/sign-up/email', {
      headers: { origin },
      data: { email: uniqueEmail(), password: 'una-clave-segura', name: 'B', inviteCode: code },
    });
    expect(second.status()).toBe(403);
  });

  test("user B cannot read or modify user A's locations over HTTP", async ({ playwright, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const a = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin } });
    const b = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { origin } });
    await signUpViaApi(a, baseURL!);
    await signUpViaApi(b, baseURL!);
    const id = randomUUID();
    const mutation = (name: string) => ({
      clientId: randomUUID(),
      mutations: [{ mutationId: randomUUID(), entity: 'location', op: 'upsert', id, data: { name, equipment: [], isDefault: true }, clientUpdatedAt: new Date().toISOString() }],
    });
    expect((await (await a.post('/api/sync/push', { data: mutation('Casa de A') })).json()).results[0].status).toBe('applied');
    const attack = await (await b.post('/api/sync/push', { data: mutation('Robado') })).json();
    expect(attack.results[0]).toMatchObject({ status: 'rejected', error: { code: 'NOT_FOUND' } });
    expect((await (await b.get('/api/sync/pull')).json()).changes).toEqual([]);
    const own = await (await a.get('/api/sync/pull')).json();
    expect(own.changes[0].data.name).toBe('Casa de A');
    await a.dispose();
    await b.dispose();
  });

  test('screens require a session: visiting the app signed out lands on login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('wrong password shows a Spanish error', async ({ page, request, baseURL }) => {
    const { email } = await signUpViaApi(request, baseURL!);
    await page.goto('/login');
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill('incorrecta-123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
  });
});
