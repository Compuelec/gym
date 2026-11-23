import { expect, latestEmail, signUpViaApi, test } from '../fixtures';

test('password reset: the email arrives in Spanish and its link sets a new password', async ({ page, request, baseURL }) => {
  const { email } = await signUpViaApi(request, baseURL!);
  await page.goto('/login');
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
  await page.getByLabel('Correo').fill(email);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('status')).toContainText('te llegará un enlace');

  const mail = await latestEmail(request, email);
  expect(mail.Subject).toBe('Cambia tu contraseña de Gym');
  const link = mail.Text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel('Contraseña nueva').fill('otra-clave-segura');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('status')).toContainText('Ya puedes entrar');

  await page.getByRole('link', { name: 'Volver a entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill('otra-clave-segura');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cuéntanos de ti' })).toBeVisible();

  // The link works only once.
  const again = await page.context().browser()!.newPage();
  await again.goto(link!);
  await expect(again.getByRole('alert')).toContainText('venció o ya se usó');
  await again.close();
});
