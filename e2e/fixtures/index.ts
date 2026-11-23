import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

export { expect };

let counter = 0;

const COMPOSE = fileURLToPath(new URL('../../infra/docker-compose.e2e.yml', import.meta.url));
const invitePool: string[] = [];

/** Real invitation codes created with the admin CLI inside the API container (pooled per worker). */
export function createInvite(): string {
  if (invitePool.length === 0) {
    const out = execFileSync(
      'docker',
      ['compose', '-f', COMPOSE, 'exec', '-T', 'api', 'node', '--import', 'tsx', 'src/cli/admin.ts', 'invite', '--count', '25'],
      { encoding: 'utf8' },
    );
    for (const line of out.trim().split('\n')) invitePool.push((JSON.parse(line) as { code: string }).code);
  }
  return invitePool.pop()!;
}

export const MAILPIT = process.env.E2E_MAILPIT_URL ?? 'http://localhost:58026';

/** Latest email sent to `to`, read from Mailpit's API. */
export async function latestEmail(request: APIRequestContext, to: string) {
  for (let i = 0; i < 60; i++) {
    const res = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const body = (await res.json()) as { messages: Array<{ ID: string }> };
    if (body.messages.length) {
      const msg = await request.get(`${MAILPIT}/api/v1/message/${body.messages[0]!.ID}`);
      return (await msg.json()) as { Subject: string; Text: string; HTML: string };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${to}`);
}

export function uniqueEmail(prefix = 'e2e') {
  counter += 1;
  return `${prefix}-${Date.now()}-${process.pid}-${counter}@test.local`;
}

/** Signs up through the real HTTP endpoint with the app Origin, like the browser does. */
export async function signUpViaApi(request: APIRequestContext, baseURL: string, email = uniqueEmail()) {
  const res = await request.post('/api/auth/sign-up/email', {
    headers: { origin: new URL(baseURL).origin },
    data: { email, password: 'una-clave-segura', name: 'Prueba', inviteCode: createInvite() },
  });
  expect(res.status(), await res.text()).toBe(200);
  return { email, password: 'una-clave-segura' };
}

/** A fresh browser context already signed in as a new user (cookies set by the real server). */
export async function signedInContext(browser: Browser, baseURL: string): Promise<{ context: BrowserContext; email: string }> {
  const context = await browser.newContext({ baseURL, locale: 'es-ES' });
  const { email } = await signUpViaApi(context.request, baseURL);
  return { context, email };
}

/** Waits until a service worker controls the page (reload once if needed). */
export async function waitForServiceWorker(page: Page) {
  // `ready` resolves once a service worker is active for this page's scope.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
  }
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

/** Fills the onboarding wizard with defaults (for tests that only need a ready account). */
export async function completeOnboarding(page: Page) {
  await expect(page.getByRole('heading', { name: 'Cuéntanos de ti' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Entiendo y acepto').check();
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await expect(page.getByRole('heading', { name: /Hola/ })).toBeVisible();
}

export const test = base;
