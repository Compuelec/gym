import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ChartLine, Dumbbell, ListChecks, Play, User } from 'lucide-react';
import { t } from '@/i18n';
import { BackButton } from './BackButton';
import { StatusBar } from './StatusBar';
import { UpdatePrompt } from './UpdatePrompt';

const NAV = [
  { to: '/', label: 'nav.train', icon: Play },
  { to: '/routines', label: 'nav.routines', icon: ListChecks },
  { to: '/exercises', label: 'nav.exercises', icon: Dumbbell },
  { to: '/progress', label: 'nav.progress', icon: ChartLine },
  { to: '/profile', label: 'nav.profile', icon: User },
] as const;

export function AppShell({ children, userId }: { children: ReactNode; userId: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <StatusBar userId={userId} />
      <UpdatePrompt />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4 pb-32">
        <BackButton />
        {children}
      </main>
      {/* Floating tab bar: the active tab is an electric-blue pill. */}
      <nav aria-label={t('app.name')} className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <ul className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-3xl border border-border bg-nav p-1.5 shadow-card">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === '/' }}
                className="flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] text-muted-foreground transition-colors data-[status=active]:bg-primary data-[status=active]:font-semibold data-[status=active]:text-primary-foreground"
              >
                <Icon className="size-5" aria-hidden />
                <span>{t(label)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
