import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSpinner } from '@/components/Spinner';
import { Button } from '@/components/ui/button';
import { FormError, SelectField, TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useUser } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';

const TABS = ['ai', 'mail', 'invitations', 'users', 'audit'] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute('/admin')({
  // The open section lives in the address: back and reload keep it.
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  component: AdminPage,
});

interface AiView {
  enabled: boolean;
  available: boolean;
  reason: 'DISABLED' | 'NO_KEY' | 'PAUSED' | null;
  model: string;
  allowedModels: string[];
  keyConfigured: boolean;
  keySource: 'admin' | 'secret' | null;
  keyLast4: string | null;
  dailyLimitPerUser: number;
  monthlyBudgetUsd: number;
  monthSpentUsd: number;
  pausedReason: string | null;
  encryptionReady: boolean;
}

interface Invitation {
  id: string;
  email: string | null;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

const message = (err: unknown) => (err instanceof ApiRequestError ? err.message : t('auth.errors.generic'));

function AdminPage() {
  const user = useUser();
  const { tab = 'ai' } = Route.useSearch();
  const navigate = useNavigate({ from: '/admin' });
  if (user.role !== 'admin') return <p>{t('admin.forbidden')}</p>;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
      <nav aria-label={t('admin.sections')} className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            aria-current={tab === k ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${tab === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
            onClick={() => void navigate({ search: { tab: k as Tab }, replace: true })}
          >
            {t(`admin.tabs.${k}`)}
          </button>
        ))}
      </nav>
      {tab === 'ai' && <AiSection />}
      {tab === 'mail' && <MailSection />}
      {tab === 'invitations' && <InvitationsSection />}
      {tab === 'users' && <UsersSection />}
      {tab === 'audit' && <AuditSection />}
    </div>
  );
}

interface MailView {
  source: 'admin' | 'secret' | null;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  user: string | null;
  passwordSet: boolean;
  from: string | null;
  defaultFrom: string;
  encryptionReady: boolean;
}

function MailSection() {
  const qc = useQueryClient();
  const me = useUser();
  const { data: mail } = useQuery({ queryKey: ['admin-mail'], queryFn: () => apiFetch('/admin/settings/mail') as Promise<MailView> });
  const [form, setForm] = useState<{ host: string; port: string; secure: boolean; user: string; password: string; from: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/admin/settings/mail', { method: 'PUT', body: JSON.stringify(body) }) as Promise<MailView>,
    onSuccess: (v) => {
      qc.setQueryData(['admin-mail'], v);
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
      setForm(null);
      setError(null);
      setNote(t('admin.mail.saved'));
    },
    onError: (e) => setError(message(e)),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch('/admin/settings/mail', { method: 'DELETE' }) as Promise<MailView>,
    onSuccess: (v) => {
      qc.setQueryData(['admin-mail'], v);
      setForm(null);
      setNote(null);
    },
  });
  const test = useMutation({
    mutationFn: () => apiFetch('/admin/settings/mail/test', { method: 'POST', body: '{}' }) as Promise<{ ok: boolean; to: string; error?: string }>,
    onSuccess: (r) => {
      if (r.ok) {
        setError(null);
        setNote(t('admin.mail.testOk', { to: r.to }));
      } else {
        setNote(null);
        setError(r.error ?? t('auth.errors.generic'));
      }
    },
    onError: (e) => setError(message(e)),
  });
  if (!mail) return <PageSpinner />;
  const f = form ?? {
    host: mail.host ?? '',
    port: String(mail.port ?? 465),
    secure: mail.secure ?? true,
    user: mail.user ?? '',
    password: '',
    from: mail.from ?? mail.defaultFrom,
  };
  const set = (patch: Partial<typeof f>) => setForm({ ...f, ...patch });
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('admin.mail.title')}</h2>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
        {mail.source === 'admin' ? t('admin.mail.sourceAdmin', { host: mail.host ?? '' }) : mail.source === 'secret' ? t('admin.mail.sourceSecret') : t('admin.mail.sourceNone')}
      </p>
      <p className="text-sm text-muted-foreground">{t('admin.mail.help')}</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            host: f.host.trim(),
            port: Number(f.port),
            secure: f.secure,
            ...(f.user.trim() ? { user: f.user.trim() } : {}),
            ...(f.password ? { password: f.password } : {}),
            from: f.from.trim(),
          });
        }}
      >
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <TextField label={t('admin.mail.host')} placeholder="mail.ejemplo.cl" value={f.host} onChange={(e) => set({ host: e.target.value })} required />
          <TextField label={t('admin.mail.port')} type="number" min={1} max={65535} value={f.port} onChange={(e) => set({ port: e.target.value, secure: e.target.value === '465' })} required />
        </div>
        <SelectField label={t('admin.mail.security')} value={f.secure ? 'tls' : 'starttls'} onChange={(e) => set({ secure: e.target.value === 'tls' })}>
          <option value="tls">{t('admin.mail.tls')}</option>
          <option value="starttls">{t('admin.mail.starttls')}</option>
        </SelectField>
        <TextField label={t('admin.mail.user')} autoComplete="off" value={f.user} onChange={(e) => set({ user: e.target.value })} />
        <TextField
          label={t('admin.mail.password')}
          type="password"
          autoComplete="new-password"
          placeholder={mail.passwordSet ? t('admin.mail.passwordKeep') : ''}
          value={f.password}
          onChange={(e) => set({ password: e.target.value })}
        />
        <TextField label={t('admin.mail.from')} hint={t('admin.mail.fromHint')} value={f.from} onChange={(e) => set({ from: e.target.value })} required />
        <FormError message={error} />
        {note && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
            {note}
          </p>
        )}
        <Button type="submit" disabled={save.isPending || !mail.encryptionReady}>
          {t('common.save')}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!mail.source || test.isPending} onClick={() => test.mutate()}>
          {test.isPending ? t('admin.mail.testing') : t('admin.mail.test', { to: me.email })}
        </Button>
        {mail.source === 'admin' && (
          <Button variant="ghost" onClick={() => remove.mutate()}>
            {t('admin.mail.remove')}
          </Button>
        )}
      </div>
    </section>
  );
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  disabledAt: string | null;
  lastSeenAt: string | null;
}

function UsersSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-users'], queryFn: () => apiFetch('/admin/users') as Promise<{ users: AdminUser[]; total: number; me: string }> });
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
    onError: (e) => setError(message(e)),
  });
  if (!data) return <PageSpinner />;
  const q = text.trim().toLowerCase();
  const users = data.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : t('admin.users.never'));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('admin.users.title', { count: data.total })}</h2>
      {data.users.length > 5 && <TextField label={t('admin.users.search')} type="search" value={text} onChange={(e) => setText(e.target.value)} />}
      <FormError message={error} />
      <ul className="flex flex-col gap-2">
        {users.map((u) => {
          const self = u.id === data.me;
          return (
            <li key={u.id} aria-label={u.email} className={`flex flex-col gap-2 rounded-lg border border-border p-3 ${u.disabledAt ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.name} {self && <span className="text-sm text-muted-foreground">({t('admin.users.you')})</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.users.since', { date: date(u.createdAt) })} · {t('admin.users.lastSeen', { date: date(u.lastSeenAt) })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {u.role === 'admin' && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{t('admin.users.admin')}</span>}
                  {u.disabledAt && <span className="rounded-full bg-red-100 px-2 text-xs text-red-800">{t('admin.users.disabled')}</span>}
                </div>
              </div>
              {!self && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={change.isPending} onClick={() => change.mutate({ id: u.id, body: { role: u.role === 'admin' ? 'user' : 'admin' } })}>
                    {u.role === 'admin' ? t('admin.users.demote') : t('admin.users.promote')}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={change.isPending} onClick={() => change.mutate({ id: u.id, body: { disabled: !u.disabledAt } })}>
                    {u.disabledAt ? t('admin.users.enable') : t('admin.users.disable')}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AiSection() {
  const qc = useQueryClient();
  const { data: ai } = useQuery({ queryKey: ['admin-ai'], queryFn: () => apiFetch('/admin/settings/ai') as Promise<AiView> });
  const [key, setKey] = useState('');
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [limits, setLimits] = useState<{ daily: string; budget: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = (view: AiView, msg?: string) => {
    qc.setQueryData(['admin-ai'], view);
    void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    setError(null);
    setNote(msg ?? null);
  };
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch('/admin/settings/ai', { method: 'PATCH', body: JSON.stringify(body) }) as Promise<AiView>,
    onSuccess: (v) => done(v),
    onError: (e) => setError(message(e)),
  });
  const saveKey = useMutation({
    mutationFn: () => apiFetch('/admin/settings/ai/key', { method: 'PUT', body: JSON.stringify({ apiKey: key }) }) as Promise<AiView>,
    onSuccess: (v) => {
      setKey('');
      done(v, t('admin.keySaved'));
    },
    onError: (e) => setError(message(e)),
  });
  const deleteKey = useMutation({
    mutationFn: () => apiFetch('/admin/settings/ai/key', { method: 'DELETE' }) as Promise<AiView>,
    onSuccess: (v) => done(v),
  });
  const test = useMutation({
    mutationFn: () => apiFetch('/admin/settings/ai/test', { method: 'POST' }) as Promise<{ ok: boolean; latencyMs: number }>,
    onSuccess: (r) => (r.ok ? setNote(t('admin.testOk', { ms: r.latencyMs })) : setError(t('admin.testFail'))),
  });

  if (!ai) return <PageSpinner />;
  const daily = limits?.daily ?? String(ai.dailyLimitPerUser);
  const budget = limits?.budget ?? String(ai.monthlyBudgetUsd);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t('admin.ai')}</h2>
      <p role="status" className={`rounded-lg px-3 py-2 text-sm ${ai.available ? 'bg-green-50 text-green-800' : 'bg-muted'}`}>
        {t('admin.status')}: {ai.available ? t('admin.available') : `${t('admin.unavailable')} (${t(`admin.reasons.${ai.reason}`)})`}
      </p>
      {ai.pausedReason && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>{t('admin.paused', { reason: t(`admin.pauseReasons.${ai.pausedReason}`) })}</span>
          <Button size="sm" variant="outline" onClick={() => patch.mutate({ clearPause: true })}>
            {t('admin.resume')}
          </Button>
        </div>
      )}
      <label className="flex items-center gap-3 font-medium">
        <input
          type="checkbox"
          className="size-5"
          // Optimistic: reflects the tap at once; reverts if the server refuses (e.g. no key).
          checked={pendingEnabled ?? ai.enabled}
          onChange={(e) => {
            setPendingEnabled(e.target.checked);
            patch.mutate({ enabled: e.target.checked }, { onSettled: () => setPendingEnabled(null) });
          }}
        />
        {t('admin.enabled')}
      </label>
      <SelectField label={t('admin.model')} value={ai.model} onChange={(e) => patch.mutate({ model: e.target.value })}>
        {ai.allowedModels.map((m) => (
          <option key={m} value={m}>
            {t(`admin.models.${m}`)}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <TextField label={t('admin.dailyLimit')} type="number" min={0} max={500} value={daily} onChange={(e) => setLimits({ daily: e.target.value, budget })} />
        <TextField label={t('admin.monthlyBudget')} type="number" min={0} step="0.5" value={budget} onChange={(e) => setLimits({ daily, budget: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.spent', { amount: formatNumber(ai.monthSpentUsd, 4) })}</p>
      <Button
        variant="outline"
        onClick={() => {
          patch.mutate({ dailyLimitPerUser: Number(daily), monthlyBudgetUsd: Number(budget) });
          setLimits(null);
        }}
      >
        {t('admin.saveLimits')}
      </Button>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h3 className="font-medium">{t('admin.key')}</h3>
        <p className="text-sm text-muted-foreground">
          {ai.keySource === 'admin' && ai.keyLast4
            ? t('admin.keyConfigured', { last4: ai.keyLast4 })
            : ai.keySource === 'secret'
              ? t('admin.keyFromSecret')
              : t('admin.keyMissing')}
        </p>
        {!ai.encryptionReady && <FormError message={t('admin.encryptionMissing')} />}
        <TextField
          label={t('admin.key')}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('admin.keyPlaceholder')}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={key.trim().length < 20 || saveKey.isPending || !ai.encryptionReady} onClick={() => saveKey.mutate()}>
            {t('admin.saveKey')}
          </Button>
          {ai.keyConfigured && (
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {t('admin.testKey')}
            </Button>
          )}
          {ai.keySource === 'admin' && (
            <Button variant="ghost" onClick={() => deleteKey.mutate()}>
              {t('admin.deleteKey')}
            </Button>
          )}
        </div>
      </div>
      {note && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {note}
        </p>
      )}
      <FormError message={error} />
    </section>
  );
}

function inviteStatus(i: Invitation) {
  if (i.usedAt) return 'used';
  if (i.revokedAt) return 'revoked';
  if (Date.parse(i.expiresAt) < Date.now()) return 'expired';
  return 'pending';
}

function InvitationsSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-invites'], queryFn: () => apiFetch('/admin/invitations') as Promise<{ invitations: Invitation[] }> });
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('7');
  const [send, setSend] = useState(true);
  const [created, setCreated] = useState<string | null>(null);
  const [sent, setSent] = useState<{ to: string; ok: boolean; error: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/invitations', {
        method: 'POST',
        body: JSON.stringify({ ...(email ? { email, send } : {}), days: Number(days) }),
      }) as Promise<{ url: string; emailed: boolean; emailError: string | null }>,
    onSuccess: (r) => {
      setCreated(r.url);
      setSent(email && send ? { to: email, ok: r.emailed, error: r.emailError } : null);
      setCopied(false);
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['admin-invites'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-invites'] }),
  });
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('admin.invitations')}</h2>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <TextField label={t('admin.inviteEmail')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label={t('admin.inviteDays')} type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      {email && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={send} onChange={(e) => setSend(e.target.checked)} />
          {t('admin.inviteSend')}
        </label>
      )}
      <Button variant="outline" onClick={() => create.mutate()} disabled={create.isPending}>
        {email && send ? t('admin.createAndSend') : t('admin.createInvite')}
      </Button>
      {created && (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
          {sent?.ok && <span className="font-medium text-green-800">{t('admin.inviteSent', { to: sent.to })}</span>}
          {sent && !sent.ok && <span className="font-medium text-red-700">{t('admin.inviteNotSent', { error: sent.error ?? '' })}</span>}
          <span>{t('admin.inviteCreated')}</span>
          <code className="break-all">{created}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard?.writeText(created);
              setCopied(true);
            }}
          >
            {copied ? t('admin.copied') : t('admin.copy')}
          </Button>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-border text-sm">
        {(data?.invitations ?? []).map((i) => {
          const status = inviteStatus(i);
          return (
            <li key={i.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {i.email ?? '—'} · {new Date(i.expiresAt).toLocaleDateString('es')}
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 text-xs">{t(`admin.inviteStatus.${status}`)}</span>
                {status === 'pending' && (
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                    {t('admin.revoke')}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AuditSection() {
  const { data } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiFetch('/admin/audit') as Promise<{ entries: Array<{ id: string; action: string; createdAt: string }> }>,
  });
  const entries = data?.entries ?? [];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{t('admin.audit')}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.auditEmpty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {entries.slice(0, 30).map((e) => (
            <li key={e.id} className="flex justify-between py-1.5">
              <span>{t(`admin.actions.${e.action}`)}</span>
              <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString('es')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
