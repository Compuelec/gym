import { useState, type FormEvent } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-errors';
import { useAuthConfig } from '@/lib/auth-config';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useAuthConfig();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) setError(authErrorMessage(error));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('auth.login.title')}</h1>
        <p className="text-muted-foreground">{t('app.tagline')}</p>
      </header>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label={t('auth.password')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={busy}>
          {t('auth.login.submit')}
        </Button>
      </form>
      {config.google && (
        <Button variant="outline" onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/' })}>
          {t('auth.login.google')}
        </Button>
      )}
      <div className="flex flex-col gap-2 text-sm">
        <Link to="/forgot-password" className="underline">
          {t('auth.login.forgot')}
        </Link>
        <p>
          {t('auth.login.noAccount')}{' '}
          <Link to="/signup" className="underline">
            {t('auth.login.toSignup')}
          </Link>
        </p>
      </div>
    </div>
  );
}
