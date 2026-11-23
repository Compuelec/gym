import { createAuthClient } from 'better-auth/react';

/** Better Auth client on the same origin (`/api/auth`). */
export const authClient = createAuthClient({ basePath: '/api/auth' });

export const { useSession, signIn, signUp, signOut } = authClient;
