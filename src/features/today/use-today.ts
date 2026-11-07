// Datos de Today desde GET /api/dashboard/today, tal cual los calcula el backend.
import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/api/api-client';
import { useApi } from '@/core/api/api-provider';

import type { TodayDashboard } from './today-view';

// Clave del caché: las pantallas que registren movimientos (HU-86/HU-87) la invalidan para refrescar Today.
export const TODAY_QUERY_KEY = ['dashboard', 'today'] as const;

export function useToday() {
  const api = useApi();
  return useQuery<TodayDashboard>({
    queryKey: TODAY_QUERY_KEY,
    // signal: si la pantalla se cierra antes de responder, la petición se cancela.
    queryFn: ({ signal }) => unwrap(api.GET('/api/dashboard/today', { signal })),
  });
}
