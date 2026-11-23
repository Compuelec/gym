import { test as base, expect, type APIRequestContext, type Browser, type BrowserContext } from '@playwright/test';

export { expect };

let counter = 0;

export function uniqueEmail(prefix = 'e2e') {
  counter += 1;
  return `${prefix}-${Date.now()}-${process.pid}-${counter}@test.local`;
}

/** Signs up through the real HTTP endpoint with the app Origin, like the browser does. */
export async function signUpViaApi(request: APIRequestContext, baseURL: string, email = uniqueEmail()) {
  const res = await request.post('/api/auth/sign-up/email', {
    headers: { origin: new URL(baseURL).origin },
    data: { email, password: 'una-clave-segura', name: 'Prueba' },
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
export async function waitForServiceWorker(page: import('@playwright/test').Page) {
  // `ready` resolves once a service worker is active for this page's scope.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
  }
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

export const test = base;
