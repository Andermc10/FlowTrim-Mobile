// Configuración de TanStack Query: caché de datos del servidor para todas las pantallas.
import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './api-error';

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
      },
      mutations: {
        // Nunca reintentar escrituras: un gasto podría registrarse dos veces.
        retry: false,
      },
    },
  });
}
