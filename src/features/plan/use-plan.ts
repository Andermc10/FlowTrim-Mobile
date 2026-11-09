// Datos de Plan: presupuestos del mes, metas y aportes/retiros (HU-88).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/api/api-client';
import { useApi } from '@/core/api/api-provider';

import type { BudgetList, ContributionRequest, Goal, GoalDetail } from './plan-view';

// Prefijo 'budgets': el registro rápido y "Marcar como pagado" ya lo invalidan al registrar un gasto.
export function useBudgets(month: string) {
  const api = useApi();
  return useQuery<BudgetList>({
    queryKey: ['budgets', month],
    queryFn: ({ signal }) => unwrap(api.GET('/api/budgets', { params: { query: { month } }, signal })),
  });
}

export function useGoals() {
  const api = useApi();
  return useQuery<Goal[]>({
    queryKey: ['goals', 'list'],
    queryFn: ({ signal }) => unwrap(api.GET('/api/goals', { signal })),
  });
}

export function useGoal(id: string) {
  const api = useApi();
  return useQuery<GoalDetail>({
    queryKey: ['goals', 'detail', id],
    queryFn: ({ signal }) => unwrap(api.GET('/api/goals/{id}', { params: { path: { id } }, signal })),
  });
}

export function useAddContribution(goalId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ContributionRequest) =>
      unwrap(api.POST('/api/goals/{id}/contributions', { params: { path: { id: goalId } }, body: request })),
    // Lo ahorrado, el restante y la estimación cambian: se vuelven a pedir las metas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
}
