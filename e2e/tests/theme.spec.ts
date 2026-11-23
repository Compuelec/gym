import { completeOnboarding, expect, signUpViaApi, test } from '../fixtures';

test('appearance: automatic follows the phone; dark and light are chosen in Perfil and remembered', async ({ page, context, baseURL }) => {
  await signUpViaApi(context.request, baseURL!);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await completeOnboarding(page);
  const html = page.locator('html');
  await expect(html).toHaveClass(/dark/); // automatic + phone in dark mode

  await page.getByRole('navigation').getByRole('link', { name: 'Perfil' }).click();
  const picker = page.getByRole('radiogroup', { name: 'Apariencia' });
  await expect(picker.getByRole('radio', { name: 'Automático' })).toHaveAttribute('aria-checked', 'true');
  await picker.getByRole('radio', { name: 'Claro' }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.reload();
  await expect(html).not.toHaveClass(/dark/); // remembered, even with the phone in dark mode
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f3f5fb');

  await page.getByRole('radiogroup', { name: 'Apariencia' }).getByRole('radio', { name: 'Oscuro' }).click();
  await expect(html).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(html).toHaveClass(/dark/);
});
