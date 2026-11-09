// Presupuestos y metas ficticios para las pruebas (nunca datos reales).
import type { Budget, Goal } from '@/features/plan/plan-view';

export function budgetFixture(patch: Partial<Budget> = {}): Budget {
  return {
    id: 'bud-food',
    categoryId: 'cat-food',
    categoryName: 'Groceries',
    categoryColor: 'green',
    categoryIcon: 'cart',
    categoryArchived: false,
    currency: 'COP',
    limit: 800_000,
    spent: 300_000,
    remaining: 500_000,
    over: 0,
    percent: 37.5,
    state: 'OnTrack',
    ...patch,
  };
}

export function goalFixture(patch: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-trip',
    name: 'Trip',
    currency: 'COP',
    target: 2_000_000,
    targetDate: '2027-06-30',
    saved: 500_000,
    remaining: 1_500_000,
    percent: 25,
    completed: false,
    isOverdue: false,
    monthsLeft: 8,
    requiredPerMonth: 187_500,
    averagePerMonth: 100_000,
    estimatedCompletion: '2028-02-01',
    contributionsCount: 3,
    ...patch,
  };
}
