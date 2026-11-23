import { BrandMark } from '@/components/BrandMark';
import { useState, type FormEvent } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-errors';

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? t('auth.errors.invalidToken') : null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) return setError(t('auth.errors.passwordTooShort'));
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) setError(authErrorMessage(error));
    else setDone(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <BrandMark />
      <h1 className="text-3xl font-bold">{t('auth.reset.title')}</h1>
      {done ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2">
          {t('auth.reset.done')}
        </p>
      ) : !token ? (
        <FormError message={error ?? t('auth.reset.missingToken')} />
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label={t('auth.reset.newPassword')}
            hint={t('auth.passwordHint')}
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={busy}>
            {t('auth.reset.submit')}
          </Button>
        </form>
      )}
      <Link to="/login" className="text-sm underline">
        {t('auth.forgot.toLogin')}
      </Link>
    </div>
  );
}
