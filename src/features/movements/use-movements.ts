// Datos de Movimientos y del registro rápido: listado del mes, cuentas, categorías y guardar un movimiento (HU-86).
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { unwrap } from '@/core/api/api-client';
import { useApi } from '@/core/api/api-provider';
import { monthRange, shiftDays } from '@/core/format/product-calendar';

import {
  MOVEMENTS_PAGE_SIZE,
  USAGE_WINDOW_DAYS,
  countByCategory,
  nextPage,
  type Account,
  type Category,
  type TransactionRequest,
  type TransactionType,
} from './movements-view';

export interface MovementsFilter {
  month: string;
  accountId: string | null;
  type: TransactionType | null;
}

// Prefijos de caché que cambian cuando se registra un movimiento (spec FR-3). 'budgets' lo usa HU-88.
const AFFECTED_BY_TRANSACTION = [['dashboard'], ['transactions'], ['accounts'], ['budgets']] as const;

export function invalidateAfterTransaction(queryClient: QueryClient): Promise<void> {
  return Promise.all(
    AFFECTED_BY_TRANSACTION.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}

export function useMovements(filter: MovementsFilter) {
  const api = useApi();
  const { from, to } = monthRange(filter.month);
  return useInfiniteQuery({
    queryKey: ['transactions', 'list', filter],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      unwrap(
        api.GET('/api/transactions', {
          params: {
            query: {
              from,
              to,
              accountId: filter.accountId ?? undefined,
              type: filter.type ?? undefined,
              page: pageParam,
              pageSize: MOVEMENTS_PAGE_SIZE,
            },
          },
          signal,
        }),
      ),
    getNextPageParam: nextPage,
  });
}

// Con archivadas: el filtro del listado las necesita para el historial; el registro rápido las descarta.
export function useAccounts() {
  const api = useApi();
  return useQuery<Account[]>({
    queryKey: ['accounts', { includeArchived: true }],
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/accounts', { params: { query: { includeArchived: true } }, signal })),
  });
}

export function useCategories() {
  const api = useApi();
  return useQuery<Category[]>({
    queryKey: ['categories', { includeArchived: true }],
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/categories', { params: { query: { includeArchived: true } }, signal })),
  });
}

/** Usos por categoría en los últimos 90 días (página máxima de la API: los 200 más recientes), como la web. */
export function useCategoryUsage(today: string) {
  const api = useApi();
  const from = shiftDays(today, -(USAGE_WINDOW_DAYS - 1));
  return useQuery({
    queryKey: ['transactions', 'usage', from, today],
    queryFn: async ({ signal }) =>
      countByCategory(
        (
          await unwrap(
            api.GET('/api/transactions', {
              params: { query: { from, to: today, page: 1, pageSize: 200 } },
              signal,
            }),
          )
        ).items,
      ),
  });
}

export function useCreateTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TransactionRequest) => unwrap(api.POST('/api/transactions', { body: request })),
    // Today, el listado, saldos de cuentas y presupuestos se vuelven a pedir con el movimiento nuevo.
    onSuccess: () => invalidateAfterTransaction(queryClient),
  });
}

// Solo el id de la última cuenta usada (dato no sensible, spec FR-1). Si ya no existe o es de otra cuenta de usuario,
// simplemente no coincide con ninguna y se elige la primera.
const LAST_ACCOUNT_KEY = 'flowtrim.quickAdd.lastAccountId';

export async function loadLastAccountId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export async function saveLastAccountId(accountId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ACCOUNT_KEY, accountId);
  } catch {
    // Recordar la cuenta es una comodidad: si falla, el registro ya se guardó igual.
  }
}
