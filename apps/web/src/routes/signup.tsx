import { BrandMark } from '@/components/BrandMark';
import { useState, type FormEvent } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import { apiFetch } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-errors';
import { useAuthConfig } from '@/lib/auth-config';

export const Route = createFileRoute('/signup')({
  validateSearch: z.object({ invite: z.string().optional() }),
  component: SignupPage,
});

type SignUpInput = Parameters<typeof authClient.signUp.email>[0];

function SignupPage() {
  const { invite } = Route.useSearch();
  const [inviteCode, setInviteCode] = useState(invite ?? '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const config = useAuthConfig();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t('auth.errors.passwordTooShort'));
    setBusy(true);
    // The invite code travels with the sign-up; the server consumes it atomically.
    const { error } = await authClient.signUp.email({ name, email, password, inviteCode } as SignUpInput);
    setBusy(false);
    if (error) setError(authErrorMessage(error));
  }

  async function withGoogle() {
    setError(null);
    try {
      await apiFetch('/invitations/claim', { method: 'POST', body: JSON.stringify({ code: inviteCode }) });
      await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
    } catch {
      setError(t('auth.signup.inviteInvalid'));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BrandMark />
      <h1 className="text-3xl font-bold">{t('auth.signup.title')}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t('auth.signup.inviteCode')}
          hint={t('auth.signup.inviteHint')}
          autoCapitalize="characters"
          autoComplete="off"
          required
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
        <TextField label={t('auth.name')} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={busy}>
          {t('auth.signup.submit')}
        </Button>
      </form>
      {config.google && (
        <Button variant="outline" onClick={() => void withGoogle()} disabled={!inviteCode}>
          {t('auth.signup.google')}
        </Button>
      )}
      <p className="text-sm">
        {t('auth.signup.haveAccount')}{' '}
        <Link to="/login" className="underline">
          {t('auth.signup.toLogin')}
        </Link>
      </p>
    </div>
  );
}
