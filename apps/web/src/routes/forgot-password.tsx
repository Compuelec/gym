import { BrandMark } from '@/components/BrandMark';
import { useState, type FormEvent } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-errors';

export const Route = createFileRoute('/forgot-password')({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('auth.errors.invalidEmail'));
    setBusy(true);
    const { error } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${location.origin}/reset-password` });
    setBusy(false);
    // The server answers the same whether or not the email exists (no account enumeration);
    // only real failures (rate limit, server or network errors) are shown.
    if (error) setError(authErrorMessage(error));
    else setSent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <BrandMark />
        <h1 className="text-3xl font-bold">{t('auth.forgot.title')}</h1>
        <p className="text-muted-foreground">{t('auth.forgot.intro')}</p>
      </header>
      {sent ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2">
          {t('auth.forgot.sent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <TextField label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" size="lg" disabled={busy}>
            {t('auth.forgot.submit')}
          </Button>
        </form>
      )}
      <Link to="/login" className="text-sm underline">
        {t('auth.forgot.toLogin')}
      </Link>
    </div>
  );
}
