// Mail settings are global (one row for the whole app): this file runs only in Chromium (see
// playwright.config.ts) and leaves the installation's mail server in place at the end.
import { completeOnboarding, expect, latestEmail, MAILPIT, promoteToAdmin, signUpViaApi, test, uniqueEmail } from '../fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('Administración · correo, invitaciones por correo y usuarios', () => {
  test('admin sets the mail server, sends a test email, invites by email, and deactivates an account', async ({ page, context, baseURL, browser, request }) => {
    test.setTimeout(120_000);
    const { email: adminEmail } = await signUpViaApi(context.request, baseURL!);
    promoteToAdmin(adminEmail);
    await page.goto('/');
    await completeOnboarding(page);

    // Mail: from the installation (Secret) to one configured here, with a real test email.
    await page.goto('/admin?tab=mail');
    await expect(page.getByText('Usando el servidor definido en la instalación.', { exact: false })).toBeVisible();
    await page.getByLabel('Servidor (SMTP)').fill('mailpit');
    await page.getByLabel('Puerto').fill('1025');
    await page.getByLabel('Seguridad').selectOption({ label: 'STARTTLS (normalmente puerto 587)' });
    await page.getByLabel('Remitente').fill('Gym Panel <panel@gym.test>');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Usando el servidor configurado aquí (mailpit).')).toBeVisible();
    await page.getByRole('button', { name: /^Enviar correo de prueba/ }).click();
    await expect(page.getByText(`Correo de prueba enviado a ${adminEmail}.`, { exact: false })).toBeVisible();
    const testMail = await latestEmail(request, adminEmail);
    expect(testMail.Subject).toBe('Prueba de correo de Gym');
    const raw = (await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${adminEmail}`)}`)).json()) as { messages: Array<{ From: { Address: string } }> };
    expect(raw.messages[0]!.From.Address).toBe('panel@gym.test');

    // Invitation sent by email; the link in the email creates the account.
    const guestEmail = uniqueEmail('invitada');
    await page.getByRole('button', { name: 'Invitaciones' }).click();
    await page.getByLabel('Correo (opcional)').fill(guestEmail);
    await expect(page.getByLabel('Enviarle la invitación por correo')).toBeChecked();
    await page.getByRole('button', { name: 'Crear y enviar invitación' }).click();
    await expect(page.getByText(`Invitación enviada a ${guestEmail}.`)).toBeVisible();
    const invite = await latestEmail(request, guestEmail);
    expect(invite.Subject).toBe('Te invitaron a Gym');
    const link = invite.Text.match(/https?:\/\/\S+\/signup\?invite=\S+/)![0];
    const guest = await browser.newContext({ baseURL });
    const g = await guest.newPage();
    await g.goto(new URL(link).pathname + new URL(link).search);
    await g.getByLabel('Tu nombre').fill('Invitada');
    await g.getByLabel('Correo').fill(guestEmail);
    await g.getByLabel('Contraseña').fill('una-clave-segura');
    await g.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(g.getByRole('heading', { name: 'Cuéntanos de ti' })).toBeVisible();

    // Users: the guest appears; deactivating signs her out and blocks sign-in; reactivating works.
    await page.getByRole('button', { name: 'Usuarios' }).click();
    const row = page.getByRole('listitem', { name: guestEmail });
    await expect(row).toContainText('Invitada');
    await expect(page.getByRole('listitem', { name: adminEmail })).not.toContainText('Desactivar cuenta');
    await row.getByRole('button', { name: 'Desactivar cuenta' }).click();
    await expect(row).toContainText('Desactivada');
    expect((await guest.request.get('/api/sync/pull')).status()).toBe(401);
    await guest.clearCookies();
    await g.goto('/login');
    await g.getByLabel('Correo').fill(guestEmail);
    await g.getByLabel('Contraseña').fill('una-clave-segura');
    await g.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(g.getByText('Tu cuenta está desactivada. Habla con quien administra la app.')).toBeVisible();
    await row.getByRole('button', { name: 'Reactivar cuenta' }).click();
    await expect(row).not.toContainText('Desactivada');
    await g.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(g.getByRole('heading', { name: /Hola|Cuéntanos de ti/ })).toBeVisible();
    await guest.close();

    // Make her an administrator from the list.
    await row.getByRole('button', { name: 'Hacer administrador' }).click();
    await expect(row).toContainText('Administrador');

    // History shows what was done; then back to the installation's mail server.
    await page.getByRole('button', { name: 'Historial' }).click();
    await expect(page.getByText('Cuenta desactivada').first()).toBeVisible();
    await expect(page.getByText('Servidor de correo cambiado').first()).toBeVisible();
    await page.getByRole('button', { name: 'Correo' }).click();
    await page.getByRole('button', { name: 'Volver al servidor de la instalación' }).click();
    await expect(page.getByText('Usando el servidor definido en la instalación.', { exact: false })).toBeVisible();
  });
});
