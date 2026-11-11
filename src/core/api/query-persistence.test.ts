import { isOnline } from '@/core/network/network-status';

import { shouldPersistQuery } from './query-persistence';

const ok = (queryKey: readonly unknown[]) => ({ queryKey, state: { status: 'success' } }) as never;

describe('query persistence', () => {
  it('shouldPersistQuery_OnlyTheD10Screens_ArePersisted', () => {
    expect(shouldPersistQuery(ok(['dashboard', 'today']), '2026-11')).toBe(true);
    expect(shouldPersistQuery(ok(['subscriptions', 'upcoming']), '2026-11')).toBe(true);
    expect(shouldPersistQuery(ok(['subscriptions', 'all']), '2026-11')).toBe(true);
    expect(shouldPersistQuery(ok(['budgets', '2026-11']), '2026-11')).toBe(true);
    expect(shouldPersistQuery(ok(['goals', 'list']), '2026-11')).toBe(true);
    // Solo sirven para escribir (y escribir sin red no se puede): no se guardan.
    expect(shouldPersistQuery(ok(['accounts', { includeArchived: true }]), '2026-11')).toBe(false);
    expect(shouldPersistQuery(ok(['categories', { includeArchived: true }]), '2026-11')).toBe(false);
    expect(shouldPersistQuery(ok(['goals', 'detail', 'goal-1']), '2026-11')).toBe(false);
    expect(shouldPersistQuery(ok(['subscriptions', 'detail', 'sub-1']), '2026-11')).toBe(false);
    expect(shouldPersistQuery(ok(['transactions', 'usage', '2026-08-09', '2026-11-06']), '2026-11')).toBe(
      false,
    );
  });

  it('shouldPersistQuery_Transactions_OnlyTheCurrentMonth', () => {
    const list = (month: string) => ok(['transactions', 'list', { month, accountId: null, type: null }]);
    expect(shouldPersistQuery(list('2026-11'), '2026-11')).toBe(true);
    expect(shouldPersistQuery(list('2026-10'), '2026-11')).toBe(false);
  });

  it('shouldPersistQuery_ErrorsOrPendingQueries_AreNeverPersisted', () => {
    const key = ['dashboard', 'today'];
    expect(shouldPersistQuery({ queryKey: key, state: { status: 'error' } } as never, '2026-11')).toBe(false);
    expect(shouldPersistQuery({ queryKey: key, state: { status: 'pending' } } as never, '2026-11')).toBe(
      false,
    );
  });

  it('isOnline_OnlyAnExplicitFalseMeansOffline', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: null, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});
