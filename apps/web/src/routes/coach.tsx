import { useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoachProgram, CoachReview } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { Choice } from '@/components/ui/choice';
import { FormError } from '@/components/ui/field';
import { useExercises } from '@/features/catalog/exercises';
import { useRoutines } from '@/features/training/repo';
import { t } from '@/i18n';
import { ApiRequestError, apiFetch } from '@/lib/api';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';
import { getSyncEngine, useOnline } from '@/lib/sync-client';

export const Route = createFileRoute('/coach')({ component: CoachPage });

interface CoachRequest {
  id: string;
  kind: 'program' | 'weekly_review';
  status: 'queued' | 'running' | 'done' | 'failed' | 'rejected';
  message: string;
  result: CoachProgram | CoachReview | null;
  errorMessage: string | null;
  accepted: boolean;
  createdAt: string;
}

function CoachPage() {
  const user = useUser();
  const online = useOnline();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const locations = useLocations(user.id) ?? [];
  const status = useQuery({
    queryKey: ['coach-status'],
    queryFn: () => apiFetch('/coach/status') as Promise<{ available: boolean }>,
    enabled: online,
  });
  const quota = useQuery({
    queryKey: ['coach-quota'],
    queryFn: () => apiFetch('/coach/quota') as Promise<{ used: number; limit: number; resetsAt: string }>,
    enabled: online && status.data?.available === true,
  });
  const history = useQuery({
    queryKey: ['coach-requests'],
    queryFn: () => apiFetch('/coach/requests') as Promise<{ requests: CoachRequest[] }>,
    enabled: online,
  });
  const [kind, setKind] = useState<'program' | 'weekly_review'>('program');
  const [message, setMessage] = useState('');
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locationIds = chosen ?? locations.map((l) => l.id);

  const active = useQuery({
    queryKey: ['coach-request', activeId],
    queryFn: () => apiFetch(`/coach/requests/${activeId}`) as Promise<CoachRequest>,
    enabled: Boolean(activeId) && online,
    // Poll until the worker finishes.
    refetchInterval: (q) => (q.state.data && ['done', 'failed', 'rejected'].includes(q.state.data.status) ? false : 1500),
  });
  useEffect(() => {
    if (active.data && ['done', 'failed'].includes(active.data.status)) {
      void qc.invalidateQueries({ queryKey: ['coach-quota'] });
      void qc.invalidateQueries({ queryKey: ['coach-requests'] });
    }
  }, [active.data, qc]);

  const send = useMutation({
    mutationFn: () => apiFetch('/coach/requests', { method: 'POST', body: JSON.stringify({ kind, message, locationIds }) }) as Promise<{ id: string }>,
    onSuccess: ({ id }) => {
      setError(null);
      setActiveId(id);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.status === 429) {
        const resets = quota.data?.resetsAt ? new Date(quota.data.resetsAt) : new Date(Date.now() + 86_400_000);
        setError(t('coach.limit', { date: resets.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) }));
      } else setError(err instanceof ApiRequestError ? err.message : t('auth.errors.generic'));
    },
  });
  const accept = useMutation({
    mutationFn: (id: string) => apiFetch(`/coach/requests/${id}/accept`, { method: 'POST' }),
    onSuccess: async () => {
      await getSyncEngine(user.id).sync();
      await navigate({ to: '/routines' });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : t('auth.errors.generic')),
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('coach.title')}</h1>
        <p className="text-muted-foreground">{t('coach.intro')}</p>
      </header>
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('coach.disclaimer')}</p>

      {!online ? (
        <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {t('coach.offline')}
        </p>
      ) : status.data && !status.data.available ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {t('coach.unavailable')}
        </p>
      ) : status.data?.available ? (
        <>
          {activeId && active.data ? (
            <RequestView
              request={active.data}
              userId={user.id}
              onAccept={() => accept.mutate(active.data!.id)}
              accepting={accept.isPending}
              onNew={() => {
                setActiveId(null);
                setMessage('');
              }}
            />
          ) : (
            <section className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t('coach.kind')}</legend>
                <Choice name="kind" checked={kind === 'program'} onChange={() => setKind('program')} label={t('coach.kindProgram')} />
                <Choice name="kind" checked={kind === 'weekly_review'} onChange={() => setKind('weekly_review')} label={t('coach.kindReview')} />
              </fieldset>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t('coach.message')}
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={message}
                  placeholder={kind === 'program' ? t('coach.messagePlaceholder') : t('coach.reviewPlaceholder')}
                  onChange={(e) => setMessage(e.target.value)}
                  className="rounded-lg border border-border bg-background p-3 text-base font-normal"
                />
              </label>
              {kind === 'program' && locations.length > 1 && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{t('coach.locations')}</legend>
                  {locations.map((l) => (
                    <Choice
                      key={l.id}
                      type="checkbox"
                      checked={locationIds.includes(l.id)}
                      onChange={(on) => setChosen(on ? [...locationIds, l.id] : locationIds.filter((x) => x !== l.id))}
                      label={l.name}
                    />
                  ))}
                </fieldset>
              )}
              {quota.data && (
                <p className="text-sm text-muted-foreground">{t('coach.quota', { left: Math.max(0, quota.data.limit - quota.data.used), limit: quota.data.limit })}</p>
              )}
              <FormError message={error} />
              <Button size="lg" disabled={message.trim().length < 3 || send.isPending || locationIds.length === 0} onClick={() => send.mutate()}>
                {t('coach.send')}
              </Button>
            </section>
          )}
          <FormError message={activeId ? error : null} />
          <History requests={history.data?.requests ?? []} onOpen={setActiveId} />
        </>
      ) : null}
    </div>
  );
}

function RequestView({
  request,
  userId,
  onAccept,
  accepting,
  onNew,
}: {
  request: CoachRequest;
  userId: string;
  onAccept: () => void;
  accepting: boolean;
  onNew: () => void;
}) {
  const exercises = useExercises(userId);
  const routines = useRoutines(userId) ?? [];
  const names = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e.nameEs])), [exercises]);
  if (request.status === 'queued' || request.status === 'running') {
    return (
      <p role="status" aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-3 text-blue-900">
        {t('coach.working')}
      </p>
    );
  }
  if (request.status !== 'done' || !request.result) {
    return (
      <div className="flex flex-col gap-3">
        <FormError message={t('coach.failed', { message: request.errorMessage ?? t('auth.errors.generic') })} />
        <Button variant="outline" onClick={onNew}>
          {t('coach.newRequest')}
        </Button>
      </div>
    );
  }
  if (request.kind === 'weekly_review') {
    const r = request.result as CoachReview;
    const routineName = new Map(routines.map((x) => [x.id, x.name]));
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('coach.reviewTitle')}</h2>
        <h3 className="font-medium">{t('coach.highlights')}</h3>
        <ul className="list-disc pl-5 text-sm">{r.highlightsEs.map((h, i) => <li key={i}>{h}</li>)}</ul>
        {r.concernsEs.length > 0 && (
          <>
            <h3 className="font-medium">{t('coach.concerns')}</h3>
            <ul className="list-disc pl-5 text-sm">{r.concernsEs.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </>
        )}
        <h3 className="font-medium">{t('coach.adjustments')}</h3>
        {r.adjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('coach.noAdjustments')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {r.adjustments.map((a, i) => (
              <li key={i}>
                <strong>{routineName.get(a.routineId)}</strong> · {names.get(a.exerciseId) ?? a.exerciseId}: {a.changeEs}
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={onNew}>
          {t('coach.newRequest')}
        </Button>
      </section>
    );
  }
  const p = request.result as CoachProgram;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('coach.programTitle')}</h2>
      <div>
        <p className="font-medium">{p.name}</p>
        <p className="text-sm text-muted-foreground">{t('coach.weeks', { weeks: p.weeks })}</p>
      </div>
      <p className="text-sm">{p.summaryEs}</p>
      {p.safetyNoteEs && (
        <p role="note" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          <strong>{t('coach.safety')}:</strong> {p.safetyNoteEs}
        </p>
      )}
      <p className="text-sm">
        <strong>{t('coach.progression')}:</strong> {p.progressionNoteEs}
      </p>
      {p.days.map((d) => (
        <article key={d.dayIndex} className="flex flex-col gap-1 rounded-lg border border-border p-3">
          <h3 className="font-medium">{t('coach.day', { day: d.dayIndex, title: d.title })}</h3>
          <ol className="flex flex-col gap-1 text-sm">
            {d.items.map((i, n) => (
              <li key={n}>
                <span className="font-medium">{names.get(i.exerciseId) ?? i.exerciseId}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {t('coach.item', { sets: i.sets, reps: i.seconds ? `${i.seconds} s` : i.repMin === i.repMax ? `${i.repMin}` : `${i.repMin}–${i.repMax}`, rest: i.restSeconds })}
                </span>
                {i.noteEs && <span className="block text-xs text-muted-foreground">{i.noteEs}</span>}
              </li>
            ))}
          </ol>
        </article>
      ))}
      {request.accepted ? (
        <p role="status">{t('coach.accepted')}</p>
      ) : (
        <Button size="lg" onClick={onAccept} disabled={accepting}>
          {t('coach.accept')}
        </Button>
      )}
      <Button variant="outline" onClick={onNew}>
        {t('coach.newRequest')}
      </Button>
    </section>
  );
}

function History({ requests, onOpen }: { requests: CoachRequest[]; onOpen: (id: string) => void }) {
  if (requests.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{t('coach.history')}</h2>
      <ul className="flex flex-col divide-y divide-border text-sm">
        {requests.slice(0, 5).map((r) => (
          <li key={r.id}>
            <button type="button" className="flex w-full justify-between gap-2 py-2 text-left" onClick={() => onOpen(r.id)}>
              <span className="truncate">{r.message}</span>
              <span className="shrink-0 text-muted-foreground">{t(`coach.statuses.${r.status}`)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
