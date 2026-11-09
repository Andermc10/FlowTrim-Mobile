// Pagos recurrentes ficticios para las pruebas (nunca datos reales).
import type { Subscription, UpcomingCharge } from '@/features/payments/payments-view';

const stamp = '2026-11-01T12:00:00Z';

export function subscriptionFixture(patch: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-netflix',
    name: 'Streaming',
    category: null,
    amount: 38_900,
    currency: 'COP',
    billingCycle: 'Monthly',
    nextBillingDate: '2026-11-08',
    status: 'Active',
    kind: 'Subscription',
    paymentUrl: null,
    defaultAccountId: null,
    categoryId: null,
    monthlyEquivalent: 38_900,
    totalInstalments: null,
    paidInstalments: 0,
    createdAt: stamp,
    updatedAt: stamp,
    ...patch,
  };
}

export function chargeFixture(patch: Partial<UpcomingCharge> = {}): UpcomingCharge {
  return {
    id: 'sub-netflix',
    name: 'Streaming',
    amount: 38_900,
    currency: 'COP',
    billingCycle: 'Monthly',
    nextBillingDate: '2026-11-08',
    daysUntilCharge: 2,
    alertWindow: 'DueWithin3Days',
    ...patch,
  };
}
