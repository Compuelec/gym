import { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import { useNow } from '@/lib/use-now';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cancelRestPush, restFinishedFeedback, restWarningFeedback, scheduleRestPush } from './device';
import { REST_WARNING_SECONDS, addRest, formatClock, loadRest, overtimeSeconds, remainingSeconds, saveRest, startRest, type RestState } from './rest-timer';

/** Rest countdown pinned above the navigation; persists across reloads. */
export function useRest(sessionId: string) {
  const [rest, setRestState] = useState<RestState | null>(() => loadRest(sessionId));
  const set = (next: RestState | null) => {
    saveRest(sessionId, next);
    setRestState(next);
  };
  return {
    rest,
    start(seconds: number, nextText?: string) {
      if (seconds <= 0) return;
      const next = startRest(seconds, Date.now(), nextText);
      set(next);
      void scheduleRestPush(sessionId, next.endsAt, next.next);
    },
    add(seconds: number) {
      if (!rest) return;
      const next = addRest(rest, seconds);
      set(next);
      void scheduleRestPush(sessionId, next.endsAt, next.next);
    },
    clear() {
      set(null);
      void cancelRestPush(sessionId);
    },
  };
}

export function RestBar({ rest, onAdd, onSubtract, onSkip }: { rest: RestState | null; onAdd: () => void; onSubtract?: () => void; onSkip: () => void }) {
  const now = useNow(250, Boolean(rest));
  const notified = useRef<number | null>(null);
  const warned = useRef<number | null>(null);
  const remaining = remainingSeconds(rest, now);
  useEffect(() => {
    if (!rest) return;
    if (remaining === 0 && notified.current !== rest.endsAt) {
      notified.current = rest.endsAt;
      void restFinishedFeedback(t('session.restDone'), rest.next ?? t('session.rest'));
    } else if (remaining > 0 && remaining <= REST_WARNING_SECONDS && rest.totalSeconds > REST_WARNING_SECONDS && warned.current !== rest.endsAt) {
      warned.current = rest.endsAt;
      void restWarningFeedback(t('session.restWarning', { seconds: REST_WARNING_SECONDS }), rest.next ?? '');
    }
  }, [rest, remaining]);
  if (!rest) return null;
  const done = remaining === 0;
  return (
    <div
      role="timer"
      // The countdown changes every second: do not read each tick, only announce the end.
      aria-live="off"
      className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 px-3"
    >
      <div className={`mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-2.5 shadow-card ${done ? 'bg-success text-background' : 'border border-border bg-card text-card-foreground'}`}>
        <Timer className={`size-5 ${done ? '' : 'text-accent'}`} aria-hidden />
        <span role="status" className="sr-only">
          {done ? t('session.restDone') : ''}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-lg font-semibold uppercase tabular-nums">
            {done ? `${t('session.restDone')} ${t('session.overtime', { time: formatClock(overtimeSeconds(rest, now)) })}` : `${t('session.rest')} ${formatClock(remaining)}`}
          </span>
          {rest.next && <span className={`truncate text-xs ${done ? '' : 'text-muted-foreground'}`}>{rest.next}</span>}
        </span>
        {!done && onSubtract && (
          <Button size="sm" variant="outline" onClick={onSubtract}>
            {t('session.sub15')}
          </Button>
        )}
        {!done && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            {t('session.add15')}
          </Button>
        )}
        {/* On the green bar the outline button has a white background: keep its text dark. */}
        <Button size="sm" variant={done ? 'outline' : 'ghost'} className={done ? 'text-foreground' : undefined} onClick={onSkip}>
          {done ? t('common.next') : t('session.skip')}
        </Button>
      </div>
    </div>
  );
}
