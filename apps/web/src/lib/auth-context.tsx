import { createContext, useContext } from 'react';
import type { SessionUser } from './session';

export const UserContext = createContext<SessionUser | null>(null);

/** The signed-in user. Only use inside screens rendered for signed-in users. */
export function useUser(): SessionUser {
  const user = useContext(UserContext);
  if (!user) throw new Error('useUser must be used inside a signed-in screen');
  return user;
}
