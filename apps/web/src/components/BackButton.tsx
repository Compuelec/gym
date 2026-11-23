import { useCanGoBack, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';
import { t } from '@/i18n';

/** Tabs in the bottom bar: they need no back button. */
export const TOP_LEVEL = ['/', '/routines', '/exercises', '/progress', '/profile'];

/** Where «Volver» goes when there is no previous page in this tab (opened from a link or a reload). */
export function parentOf(path: string): string {
  if (path.startsWith('/exercises/')) return '/exercises';
  if (path.startsWith('/routines/')) return '/routines';
  if (['/measurements', '/data'].includes(path)) return '/progress';
  if (['/credits', '/admin'].includes(path)) return '/profile';
  return '/';
}

/** «‹ Volver» on every secondary screen: back in history (keeping filters and scroll), else up. */
export function BackButton() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const canGoBack = useCanGoBack();
  const router = useRouter();
  const navigate = useNavigate();
  if (TOP_LEVEL.includes(path)) return null;
  return (
    <button
      type="button"
      className="-ml-1 mb-2 inline-flex items-center gap-1 self-start rounded-lg py-1 pr-2 text-sm text-muted-foreground hover:text-foreground"
      onClick={() => (canGoBack ? router.history.back() : void navigate({ to: parentOf(path) }))}
    >
      <ChevronLeft className="size-5" aria-hidden />
      {t('common.goBack')}
    </button>
  );
}
