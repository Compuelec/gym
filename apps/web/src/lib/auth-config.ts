import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

export interface AuthConfig {
  google: boolean;
}

/** Which sign-in methods the server offers (Google only when configured). */
export function useAuthConfig(): AuthConfig {
  const { data } = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => apiFetch('/config') as Promise<AuthConfig>,
    staleTime: Infinity,
    retry: false,
  });
  return data ?? { google: false };
}
