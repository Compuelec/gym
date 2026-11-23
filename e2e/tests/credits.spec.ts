import { readFileSync } from 'node:fs';
import { completeOnboarding, expect, signUpViaApi, test } from '../fixtures';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

test('version and «Creado y diseñado por Compuelec Soporte» at the foot of sign-in and Perfil', async ({ page, context, baseURL }) => {
  await page.goto('/login');
  const footer = page.locator('footer');
  await expect(footer).toContainText(`v${version}`);
  await expect(footer).toContainText('Creado y diseñado por');
  await expect(footer).toContainText('Compuelec Soporte');
  await expect(footer).toContainText(`© ${new Date().getFullYear()} · Todos los derechos reservados`);

  await signUpViaApi(context.request, baseURL!);
  await page.goto('/');
  await completeOnboarding(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
  await expect(page.locator('footer')).toContainText(`v${version}`);
  await expect(page.locator('footer')).toContainText('Compuelec Soporte');
});
