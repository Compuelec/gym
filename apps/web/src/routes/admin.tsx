import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { FormError, SelectField, TextField } from '@/components/ui/field';
import { t } from '@/i18n';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useUser } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';

export const Route = createFileRoute('/admin')({ component: AdminPage });

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
  if (user.role !== 'admin') return <p>{t('admin.forbidden')}</p>;
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">{t('admin.title')}</h1>
      <AiSection />
      <InvitationsSection />
      <AuditSection />
    </div>
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

  if (!ai) return null;
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
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/invitations', { method: 'POST', body: JSON.stringify({ ...(email ? { email } : {}), days: Number(days) }) }) as Promise<{ url: string }>,
    onSuccess: (r) => {
      setCreated(r.url);
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
      <Button variant="outline" onClick={() => create.mutate()} disabled={create.isPending}>
        {t('admin.createInvite')}
      </Button>
      {created && (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
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
