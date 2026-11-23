import { completeOnboarding, expect, signUpViaApi, test } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

type Change = { entity: string; id: string; data: Record<string, unknown> | null };

async function serverData(request: APIRequestContext) {
  const res = await request.get('/api/sync/pull?cursor=0');
  expect(res.status()).toBe(200);
  return ((await res.json()) as { changes: Change[] }).changes;
}

const inWeeks = (w: number) => new Date(Date.now() + w * 7 * 86_400_000).toISOString().slice(0, 10);

test.describe('objetivo y avisos', () => {
  test('goal: body data and target give a healthy pace; saved to the server with a weight entry', async ({ page, context, baseURL }) => {
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);

    // From the home card.
    await page.getByRole('link', { name: /Mi objetivo/ }).click();
    await expect(page.getByRole('heading', { name: 'Mi objetivo' })).toBeVisible();
    await page.getByLabel('Peso actual (kg)').fill('80');
    await page.getByLabel('Estatura (cm)').fill('175');
    await page.getByLabel('Edad').fill('40');
    await page.getByLabel('Sexo').selectOption('male');
    await page.getByLabel(/Actividad diaria/).selectOption('light');
    await page.getByLabel('Lesiones o limitaciones').fill('Rodilla derecha');
    await page.getByLabel('Peso objetivo (kg)').fill('74');
    await page.getByLabel('Fecha meta').fill(inWeeks(12));
    const status = page.getByRole('status').filter({ hasText: 'Para bajar' });
    await expect(status).toContainText('Para bajar 6 kg en 12 semanas');
    await expect(status).toContainText('Es un ritmo saludable.');
    await expect(status).toContainText('Índice de masa corporal: 26,1 (sobrepeso).');

    // A date that is too close: warned, in red.
    await page.getByLabel('Fecha meta').fill(inWeeks(3));
    await expect(page.getByRole('status').filter({ hasText: 'Para bajar' })).toContainText('demasiado rápido');
    await page.getByLabel('Fecha meta').fill(inWeeks(12));

    // Impossible values are not saved.
    await page.getByLabel('Estatura (cm)').fill('17');
    await page.getByRole('button', { name: 'Guardar mi objetivo' }).click();
    await expect(page.getByText('Revisa los datos')).toBeVisible();
    await page.getByLabel('Estatura (cm)').fill('175');
    await page.getByRole('button', { name: 'Guardar mi objetivo' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Guardado.' })).toBeVisible();

    await expect
      .poll(async () => {
        const changes = await serverData(context.request);
        const profile = changes.find((c) => c.entity === 'profile')?.data;
        const weights = changes.filter((c) => c.entity === 'bodyMeasurement').map((c) => c.data?.weightKg);
        return { target: profile?.targetWeightKg, height: profile?.heightCm, activity: profile?.activityLevel, injuries: profile?.injuries, weights };
      })
      .toEqual({ target: 74, height: 175, activity: 'light', injuries: 'Rodilla derecha', weights: [80] });

    // Back on the home screen the card shows the plan.
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Mi objetivo/ })).toContainText('Para bajar 6 kg');
  });

  test('notifications: reminder days and time, weekly summary; the server rejects an invalid time', async ({ page, context, baseURL }) => {
    await signUpViaApi(context.request, baseURL!);
    await page.goto('/');
    await completeOnboarding(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
    await page.getByRole('link', { name: 'Avisos y recordatorios' }).click();
    await expect(page.getByRole('heading', { name: 'Avisos' })).toBeVisible();

    const days = page.getByRole('group', { name: 'Días del recordatorio' });
    await days.getByRole('button', { name: 'Lunes' }).click();
    await days.getByRole('button', { name: 'Miércoles' }).click();
    await expect(days.getByRole('button', { name: 'Lunes' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Hora del recordatorio').fill('07:30');
    await page.getByRole('checkbox', { name: /Resumen semanal/ }).check();

    await expect
      .poll(async () => {
        const p = (await serverData(context.request)).find((c) => c.entity === 'profile')?.data;
        return { days: p?.reminderDays, time: p?.reminderTime, weekly: p?.weeklySummary, tz: typeof p?.timeZone };
      })
      .toEqual({ days: [1, 3], time: '07:30', weekly: true, tz: 'string' });

    await page.reload();
    await expect(page.getByRole('group', { name: 'Días del recordatorio' }).getByRole('button', { name: 'Miércoles' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Hora del recordatorio')).toHaveValue('07:30');

    // Crafted values never reach the database.
    const p = (await serverData(context.request)).find((c) => c.entity === 'profile')!;
    const res = await context.request.post('/api/sync/push', {
      headers: { origin: new URL(baseURL!).origin },
      data: {
        clientId: crypto.randomUUID(),
        mutations: [{ mutationId: crypto.randomUUID(), op: 'upsert', clientUpdatedAt: new Date().toISOString(), entity: 'profile', id: p.id, data: { ...p.data, reminderTime: '25:00', timeZone: 'Marte/Base' } }],
      },
    });
    expect(((await res.json()) as { results: Array<{ status: string }> }).results[0]!.status).not.toBe('applied');
  });
});
