import { accountFixture, categoryFixture, transactionFixture } from '@/testing/movements-fixtures';
import { chargeFixture, subscriptionFixture } from '@/testing/payments-fixtures';

import {
  accountsForPayment,
  alertKey,
  alertTone,
  countdown,
  initialDraft,
  joinPayments,
  kindKey,
  resultKey,
  safePaymentUrl,
  toMarkPaidRequest,
  validateMarkPaid,
  type MarkPaidDraft,
} from './payments-view';

const today = '2026-11-06';
const accounts = [
  accountFixture({ id: 'acc-cash' }),
  accountFixture({ id: 'acc-bank', name: 'Main bank' }),
  accountFixture({ id: 'acc-usd', currency: 'USD' }),
  accountFixture({ id: 'acc-closed', isArchived: true }),
];
const categories = [categoryFixture({ id: 'cat-subs', name: 'Subscriptions' })];

describe('payments view', () => {
  it('joinPayments_KeepsServerOrderAndToleratesMissingDetail', () => {
    const upcoming = {
      referenceDate: today,
      items: [chargeFixture({ id: 'b' }), chargeFixture({ id: 'a' }), chargeFixture({ id: 'x' })],
    };
    const joined = joinPayments(upcoming, [
      subscriptionFixture({ id: 'a' }),
      subscriptionFixture({ id: 'b' }),
    ]);
    expect(joined.map((payment) => [payment.charge.id, payment.subscription?.id ?? null])).toEqual([
      ['b', 'b'],
      ['a', 'a'],
      ['x', null],
    ]);
  });

  it('alertKeyAndTone_EveryWindow_HasTextAndUnknownFallsBackToLater', () => {
    expect(alertKey('Overdue')).toBe('payments.alert.Overdue');
    expect(alertKey('DueWithin7Days')).toBe('payments.alert.DueWithin7Days');
    expect(alertKey('Someday')).toBe('payments.alert.Later');
    expect(alertTone('Today')).toBe('danger');
    expect(alertTone('DueWithin3Days')).toBe('warning');
    expect(alertTone('Later')).toBe('muted');
    expect(kindKey('Instalment')).toBe('payments.kind.Instalment');
  });

  it('countdown_PastTodayAndFuture_AreDescribedDifferently', () => {
    expect(countdown(-3)).toEqual({ key: 'payments.overdueMany', count: 3 });
    expect(countdown(-1)).toEqual({ key: 'payments.overdueOne', count: 1 });
    expect(countdown(0)).toEqual({ key: 'payments.dueToday', count: 0 });
    expect(countdown(1)).toEqual({ key: 'payments.inOne', count: 1 });
    expect(countdown(9)).toEqual({ key: 'payments.inMany', count: 9 });
  });

  it('safePaymentUrl_OnlyHttpsWithoutCredentials', () => {
    expect(safePaymentUrl('https://pay.example.test/bill')).toBe('https://pay.example.test/bill');
    expect(safePaymentUrl('http://pay.example.test')).toBeNull();
    expect(safePaymentUrl('javascript:alert(1)')).toBeNull();
    expect(safePaymentUrl('intent://scan#Intent;end')).toBeNull();
    expect(safePaymentUrl('https://user:pass@pay.example.test')).toBeNull();
    expect(safePaymentUrl('not a url')).toBeNull();
    expect(safePaymentUrl(null)).toBeNull();
  });

  it('accountsForPayment_OnlyActiveAccountsInPaymentCurrency', () => {
    expect(accountsForPayment(subscriptionFixture(), accounts).map((a) => a.id)).toEqual([
      'acc-cash',
      'acc-bank',
    ]);
  });

  it('initialDraft_DefaultAccountAndCategory_RecordsWithPaymentAmount', () => {
    const payment = subscriptionFixture({
      defaultAccountId: 'acc-bank',
      categoryId: 'cat-subs',
      amount: 12.5,
    });
    expect(initialDraft(payment, accounts, categories, today)).toEqual({
      mode: 'record',
      accountId: 'acc-bank',
      amount: '12.5',
      date: today,
      categoryId: 'cat-subs',
    });
  });

  it('initialDraft_NoDefaultAndSeveralAccounts_OnlyMovesTheDate', () => {
    expect(initialDraft(subscriptionFixture(), accounts, categories, today)).toMatchObject({
      mode: 'dateOnly',
      accountId: '',
      categoryId: '',
    });
    // Una sola cuenta en la moneda: se elige sola.
    const usd = subscriptionFixture({ currency: 'USD' });
    expect(initialDraft(usd, accounts, categories, today)).toMatchObject({
      mode: 'record',
      accountId: 'acc-usd',
    });
  });

  it('validateMarkPaid_RecordNeedsAllFieldsDateOnlyNeedsNothing', () => {
    const draft: MarkPaidDraft = {
      mode: 'record',
      accountId: '',
      amount: '0',
      date: '2026-11-07',
      categoryId: '',
    };
    expect(validateMarkPaid(draft, today)).toEqual({
      accountId: 'markPaid.error.accountRequired',
      amount: 'quickAdd.error.amountInvalid',
      date: 'markPaid.error.dateInFuture',
      categoryId: 'markPaid.error.categoryRequired',
    });
    expect(validateMarkPaid({ ...draft, mode: 'dateOnly' }, today)).toEqual({});
  });

  it('toMarkPaidRequest_RecordSendsBodyDateOnlySendsNull', () => {
    const draft: MarkPaidDraft = {
      mode: 'record',
      accountId: 'acc-bank',
      amount: '41200,50',
      date: today,
      categoryId: 'cat-subs',
    };
    expect(toMarkPaidRequest(draft)).toEqual({
      accountId: 'acc-bank',
      amount: 41200.5,
      date: today,
      categoryId: 'cat-subs',
    });
    expect(toMarkPaidRequest({ ...draft, mode: 'dateOnly' })).toBeNull();
  });

  it('resultKey_CompletedRecordedOrMoved', () => {
    const subscription = subscriptionFixture();
    expect(resultKey({ subscription, transaction: transactionFixture(), completed: true })).toBe(
      'markPaid.result.completed',
    );
    expect(resultKey({ subscription, transaction: transactionFixture(), completed: false })).toBe(
      'markPaid.result.recorded',
    );
    expect(resultKey({ subscription, transaction: null, completed: false })).toBe('markPaid.result.moved');
  });
});
