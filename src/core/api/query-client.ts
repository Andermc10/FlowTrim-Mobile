// Configuración de TanStack Query: caché de datos del servidor para todas las pantallas.
import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './api-error';
import { PERSISTED_MAX_AGE_MS } from './query-persistence';

export const MAX_QUERY_RETRIES = 2;

// Solo vale la pena reintentar lo que puede arreglarse solo: red o fallo del servidor. Un 4xx no cambia al repetirlo.
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) {
    return false;
  }
  return isApiError(error) && (error.kind === 'network' || error.kind === 'server');
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        // 30 s "frescos": cambiar de pestaña no vuelve a pedir lo que se acaba de cargar.
        staleTime: 30_000,
        // Una semana en memoria: igual que la copia local (HU-90); si fuera menor, la copia se descartaría antes.
        gcTime: PERSISTED_MAX_AGE_MS,
        // Al volver la red se recarga todo lo que está en pantalla aunque sea reciente: sin conexión pudo cambiar en
        // la web (HU-90 FR-3).
        refetchOnReconnect: 'always',
      },
      mutations: {
        // Nunca reintentar escrituras: un gasto podría registrarse dos veces.
        retry: false,
        // Sin red una escritura falla al momento en lugar de quedar en cola (HU-90 FR-2: nada se encola).
        networkMode: 'always',
      },
    },
  });
}
