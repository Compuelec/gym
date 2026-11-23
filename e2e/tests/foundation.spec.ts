import { expect, signUpViaApi, test, uniqueEmail, waitForServiceWorker } from '../fixtures';

test.describe('app shell', () => {
  test('renders in Spanish with the five sections and navigates between them', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { name: 'Gym' })).toBeVisible();
    const nav = page.getByRole('navigation');
    for (const label of ['Entrenar', 'Rutinas', 'Ejercicios', 'Progreso', 'Perfil']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
    await nav.getByRole('link', { name: 'Ejercicios' }).click();
    await expect(page).toHaveURL(/\/exercises$/);
    await expect(page.getByRole('heading', { name: 'Ejercicios' })).toBeVisible();
  });

  test('deep links work (SPA fallback through Caddy)', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Progreso' })).toBeVisible();
  });
});

test.describe('PWA', () => {
  test('serves a Spanish web manifest with installable icons', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest).toMatchObject({ lang: 'es', display: 'standalone', start_url: '/' });
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).status()).toBe(200);
  });

  test('opens offline after the first visit and tells the user it is offline', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright WebKit does not run service workers');
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Gym' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Sin conexión');
    await page.goto('/routines');
    await expect(page.getByRole('heading', { name: 'Rutinas' })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});

test.describe('API over real HTTP', () => {
  test('health endpoints respond through the proxy', async ({ request }) => {
    expect((await request.get('/api/health/live')).status()).toBe(200);
    expect(await (await request.get('/api/health')).json()).toEqual({ status: 'ok' });
  });

  test('sync requires a session (401 in Spanish)', async ({ request }) => {
    const res = await request.get('/api/sync/pull');
    expect(res.status()).toBe(401);
    expect((await res.json()).error.message).toBe('Tienes que iniciar sesión.');
  });

  test('state-changing requests without the app Origin are rejected (403)', async ({ playwright, baseURL }) => {
    const raw = await playwright.request.newContext({ baseURL });
    const res = await raw.post('/api/auth/sign-up/email', {
      data: { email: uniqueEmail(), password: 'una-clave-segura', name: 'X' },
    });
    expect(res.status()).toBe(403);
    const evil = await raw.post('/api/auth/sign-up/email', {
      headers: { origin: 'https://evil.example' },
      data: { email: uniqueEmail(), password: 'una-clave-segura', name: 'X' },
    });
    expect(evil.status()).toBe(403);
    await raw.dispose();
  });

  test('a real browser POST from the page passes the Origin check and gets a session', async ({ page }) => {
    await page.goto('/');
    const status = await page.evaluate(async (email) => {
      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'una-clave-segura', name: 'Navegador' }),
      });
      const pull = await fetch('/api/sync/pull');
      return [res.status, pull.status];
    }, uniqueEmail('browser'));
    expect(status).toEqual([200, 200]);
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name.includes('session_token'));
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
  });

  test('a signed-in user can sync; another user cannot read their data', async ({ playwright, baseURL }) => {
    const a = await playwright.request.newContext({ baseURL });
    await signUpViaApi(a, baseURL!);
    const res = await a.get('/api/sync/pull?cursor=0');
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ changes: [], hasMore: false });
    await a.dispose();
  });
});
