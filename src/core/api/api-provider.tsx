// Proveedor del cliente API: une la sesión (token) y el idioma con el cliente tipado de HU-82.
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAuth } from '@/core/auth/auth-provider';
import { useI18n } from '@/core/i18n/i18n';

import { createApiClient, type ApiClient } from './api-client';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children, baseUrl }: { children: ReactNode; baseUrl: string }) {
  // getAccessToken y expireSession son estables (useCallback en AuthProvider).
  const { getAccessToken, expireSession } = useAuth();
  const { language } = useI18n();

  // Se recrea solo si cambia el idioma (raro y barato): así cada petición envía el Accept-Language vigente.
  const client = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getAccessToken,
        getLanguage: () => language,
        onUnauthorized: expireSession,
      }),
    [baseUrl, getAccessToken, expireSession, language],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error('useApi must be used inside ApiProvider');
  }
  return client;
}
