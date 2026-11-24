import type { APIRequestContext, Page } from '@playwright/test';
import { FAKE_AI_KEY, completeOnboarding, expect, promoteToAdmin, resetAiSettings, signUpViaApi, test } from '../fixtures';


async function adminSetup(request: APIRequestContext, baseURL: string, patch: Record<string, unknown> = {}) {
  const origin = new URL(baseURL).origin;
  const { email } = await signUpViaApi(request, baseURL);
  promoteToAdmin(email);
  expect((await request.put('/api/admin/settings/ai/key', { headers: { origin }, data: { apiKey: FAKE_AI_KEY } })).status()).toBe(200);
  expect((await request.patch('/api/admin/settings/ai', { headers: { origin }, data: { enabled: true, ...patch } })).status()).toBe(200);
}

async function ask(page: Page, text: string) {
  await page.goto('/coach');
  await expect(page.getByRole('heading', { name: 'Coach' })).toBeVisible();
  await page.getByLabel('Cuéntale al coach').fill(text);
  await page.getByRole('button', { name: 'Enviar al coach' }).click();
}

test.describe('US6 · coach con IA', () => {

  test.beforeEach(async ({ playwright, baseURL }) => {
    resetAiSettings();
    const admin = await playwright.request.newContext({ baseURL });
    await adminSetup(admin, baseURL!);
    await admin.dispose();
  });

  test('asks for a program, sees it with home equipment only, accepts it and trains it', async ({ page, context, baseURL }) => {
    test.setTimeout(90_000);
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page); // Casa: mancuernas, banda, colchoneta
    await page.getByRole('link', { name: 'Pídele un programa al coach' }).click();
    await expect(page.getByText('no reemplaza el consejo de un médico')).toBeVisible();
    await expect(page.getByText('Te quedan 20 de 20 consultas hoy.')).toBeVisible();
    await ask(page, 'quiero ganar fuerza, 3 días, en casa tengo mancuernas');
    await expect(page.getByText('El coach está preparando tu respuesta…')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Programa propuesto' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Fuerza en casa')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Día 1: / })).toBeVisible();
    // Every exercise exists in the local catalog (shown by its Spanish name, never a raw id).
    await expect(page.locator('article li', { hasText: 'fedb:' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Aceptar y crear las rutinas' }).click();
    await expect(page).toHaveURL(/\/routines$/);
    await expect(page.getByRole('heading', { name: 'Fuerza en casa · Día 1' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Fuerza en casa · Día 3' })).toBeVisible();

    await page.getByRole('navigation').getByRole('link', { name: 'Entrenar' }).click();
    await page.getByRole('button', { name: 'Empezar «Fuerza en casa · Día 1»' }).click();
    await expect(page.getByText('3 series × 8–12 reps', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Te quedan', { exact: false })).toHaveCount(0);
  });

  test('invented exercises never reach the user; refusals and unavailability are explained', async ({ page, context, baseURL, playwright }) => {
    test.setTimeout(90_000);
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);

    await ask(page, 'programa de fuerza [[INVENT]]');
    await expect(page.getByRole('heading', { name: 'Programa propuesto' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('fedb:Inventado')).toHaveCount(0);
    await page.getByRole('button', { name: 'Nueva consulta' }).click();

    // Texts longer than allowed are shortened, not a failed request (seen in production).
    await ask(page, 'programa para bajar grasa [[LONG]]');
    await expect(page.getByRole('heading', { name: 'Programa propuesto' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Programa de 4 semanas con mancuernas', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('El coach no respondió')).toHaveCount(0);
    await page.getByRole('button', { name: 'Nueva consulta' }).click();

    await ask(page, 'algo raro [[REFUSE]]');
    await expect(page.getByRole('alert')).toContainText('El coach no pudo responder a esta solicitud', { timeout: 20_000 });

    // Health topic → referral note.
    await page.getByRole('button', { name: 'Nueva consulta' }).click();
    await ask(page, 'tengo dolor de rodilla, quiero un programa suave');
    await expect(page.getByRole('note')).toContainText('consulta a un médico', { timeout: 20_000 });

    // Admin switches the AI off → the coach says so; the rest of the app keeps working.
    const admin = await playwright.request.newContext({ baseURL });
    await adminSetup(admin, baseURL!, { enabled: false });
    await admin.dispose();
    await page.goto('/coach');
    await expect(page.getByText('El coach no está disponible por ahora.')).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Ejercicios' }).click();
    await expect(page.getByRole('heading', { name: 'Ejercicios' })).toBeVisible();
  });

  test('daily limit message and offline notice', async ({ page, context, baseURL, playwright }) => {
    test.setTimeout(90_000);
    resetAiSettings();
    const admin = await playwright.request.newContext({ baseURL });
    await adminSetup(admin, baseURL!, { dailyLimitPerUser: 1 });
    await admin.dispose();
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await ask(page, 'programa de fuerza en casa');
    await expect(page.getByRole('heading', { name: 'Programa propuesto' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Nueva consulta' }).click();
    await ask(page, 'otro programa por favor');
    await expect(page.getByRole('alert')).toContainText('Alcanzaste el límite diario del coach');

    await context.setOffline(true);
    await page.reload().catch(() => {});
    await page.evaluate(() => window.dispatchEvent(new Event('offline'))).catch(() => {});
    await expect(page.getByText('Necesitas conexión para usar el coach.')).toBeVisible();
    await context.setOffline(false);
  });
});
