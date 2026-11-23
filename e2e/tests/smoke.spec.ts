import { expect, test } from '@playwright/test';

test('home page renders in Spanish', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: 'Gym' })).toBeVisible();
  await expect(page.getByText('Entrena en casa o en el gimnasio.')).toBeVisible();
});
