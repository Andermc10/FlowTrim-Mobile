// Datos de Pagos recurrentes: próximos cobros, detalle de cada pago y "Marcar como pagado" (HU-87).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { unwrap, type ApiClient } from '@/core/api/api-client';
import { useApi } from '@/core/api/api-provider';
import { invalidateAfterTransaction } from '@/features/movements/use-movements';

import type { MarkPaidRequest, Subscription, UpcomingCharges } from './payments-view';

/** Máximo de la API por página (ListSubscriptionsHandler.MaxPageSize). */
const SUBSCRIPTIONS_PAGE_SIZE = 100;

export function useUpcomingCharges() {
  const api = useApi();
  return useQuery<UpcomingCharges>({
    queryKey: ['subscriptions', 'upcoming'],
    queryFn: ({ signal }) => unwrap(api.GET('/api/subscriptions/upcoming', { signal })),
  });
}

// Todas las páginas: con solo la primera, los pagos 101+ quedarían sin tipo ni enlace (error que tuvo la web, PR #92).
async function listAllSubscriptions(api: ApiClient, signal: AbortSignal): Promise<Subscription[]> {
  const all: Subscription[] = [];
  for (let page = 1; ; page++) {
    const result = await unwrap(
      api.GET('/api/subscriptions', {
        params: { query: { page, pageSize: SUBSCRIPTIONS_PAGE_SIZE } },
        signal,
      }),
    );
    all.push(...result.items);
    if (result.items.length === 0 || page * result.pageSize >= result.totalCount) {
      return all;
    }
  }
}

export function useSubscriptions() {
  const api = useApi();
  return useQuery<Subscription[]>({
    queryKey: ['subscriptions', 'all'],
    queryFn: ({ signal }) => listAllSubscriptions(api, signal),
  });
}

export function useSubscription(id: string) {
  const api = useApi();
  return useQuery<Subscription>({
    queryKey: ['subscriptions', 'detail', id],
    queryFn: ({ signal }) => unwrap(api.GET('/api/subscriptions/{id}', { params: { path: { id } }, signal })),
  });
}

export function useMarkPaid(id: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    // null = "pagado fuera de FlowTrim": sin cuerpo, como la web (la API solo mueve la fecha, HU-57).
    mutationFn: (request: MarkPaidRequest | null) =>
      unwrap(
        api.POST('/api/subscriptions/{id}/mark-paid', {
          params: { path: { id } },
          body: request ?? undefined,
        }),
      ),
    // La próxima fecha cambia (pagos, Today) y, si se registró el gasto, también saldos, movimientos y presupuestos.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
        invalidateAfterTransaction(queryClient),
      ]),
  });
}
