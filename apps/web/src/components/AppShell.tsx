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
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4 pb-28">
        <BackButton />
        {children}
      </main>
      <nav
        aria-label={t('app.name')}
        className="fixed inset-x-0 bottom-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === '/' }}
                className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground data-[status=active]:text-foreground"
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
