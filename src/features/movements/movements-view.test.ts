import { accountFixture, categoryFixture, transactionFixture } from '@/testing/movements-fixtures';

import {
  amountSign,
  categoriesFor,
  countByCategory,
  destinationAccounts,
  groupByDay,
  nextPage,
  parseAmount,
  toRequest,
  validateDraft,
  type QuickAddDraft,
} from './movements-view';

const draft = (patch: Partial<QuickAddDraft> = {}): QuickAddDraft => ({
  type: 'Expense',
  accountId: 'acc-cash',
  toAccountId: '',
  categoryId: 'cat-food',
  amount: '38900',
  date: '2026-11-06',
  description: '',
  ...patch,
});

describe('movements view', () => {
  it('groupByDay_ItemsOrderedByDate_KeepsApiOrderInsideEachDay', () => {
    const items = [
      transactionFixture({ id: 'a', date: '2026-11-06' }),
      transactionFixture({ id: 'b', date: '2026-11-06' }),
      transactionFixture({ id: 'c', date: '2026-11-04' }),
    ];
    expect(groupByDay(items).map((day) => [day.date, day.data.map((item) => item.id)])).toEqual([
      ['2026-11-06', ['a', 'b']],
      ['2026-11-04', ['c']],
    ]);
    expect(groupByDay([])).toEqual([]);
  });

  it('nextPage_MoreItemsOnServer_ReturnsNextPageOtherwiseUndefined', () => {
    const list = { items: [], totals: [], page: 1, pageSize: 50, totalCount: 51 };
    expect(nextPage(list)).toBe(2);
    expect(nextPage({ ...list, totalCount: 50 })).toBeUndefined();
    expect(nextPage({ ...list, totalCount: 0 })).toBeUndefined();
  });

  it('amountSign_ByType_IncomePlusExpenseMinusTransferNone', () => {
    expect(amountSign('Income')).toBe('+');
    expect(amountSign('Expense')).toBe('-');
    expect(amountSign('Transfer')).toBe('');
  });

  it('categoriesFor_UsageCounts_MostUsedFirstAndArchivedOrOtherKindLeftOut', () => {
    const categories = [
      categoryFixture({ id: 'cat-bills', name: 'Bills' }),
      categoryFixture({ id: 'cat-food', name: 'Food' }),
      categoryFixture({ id: 'cat-old', name: 'Old', isArchived: true }),
      categoryFixture({ id: 'cat-salary', name: 'Salary', kind: 'Income' }),
      categoryFixture({ id: 'cat-transport', name: 'Transport' }),
    ];
    const usage = countByCategory([
      transactionFixture({ categoryId: 'cat-transport' }),
      transactionFixture({ categoryId: 'cat-food' }),
      transactionFixture({ categoryId: 'cat-food' }),
      transactionFixture({ type: 'Transfer', categoryId: null }),
    ]);

    expect(categoriesFor('Expense', categories, usage).map((c) => c.id)).toEqual([
      'cat-food',
      'cat-transport',
      'cat-bills',
    ]);
    expect(categoriesFor('Income', categories, usage).map((c) => c.id)).toEqual(['cat-salary']);
  });

  it('destinationAccounts_Transfer_OnlyOtherActiveAccountsInSameCurrency', () => {
    const accounts = [
      accountFixture({ id: 'acc-cash' }),
      accountFixture({ id: 'acc-bank' }),
      accountFixture({ id: 'acc-usd', currency: 'USD' }),
      accountFixture({ id: 'acc-closed', isArchived: true }),
    ];
    expect(destinationAccounts('acc-cash', accounts).map((a) => a.id)).toEqual(['acc-bank']);
  });

  it('parseAmount_DotOrCommaUpToTwoDecimals_OtherwiseNull', () => {
    expect(parseAmount('38900')).toBe(38900);
    expect(parseAmount(' 12,5 ')).toBe(12.5);
    expect(parseAmount('0.99')).toBe(0.99);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
    expect(parseAmount('1.500,00')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('validateDraft_ValidExpense_HasNoErrors', () => {
    expect(validateDraft(draft(), '2026-11-06')).toEqual({});
  });

  it('validateDraft_MissingOrInvalidFields_ReturnsOneKeyPerField', () => {
    expect(
      validateDraft(
        draft({
          accountId: '',
          categoryId: '',
          amount: '0',
          date: '2026-11-07',
          description: 'x'.repeat(141),
        }),
        '2026-11-06',
      ),
    ).toEqual({
      accountId: 'quickAdd.error.accountRequired',
      categoryId: 'quickAdd.error.categoryRequired',
      amount: 'quickAdd.error.amountInvalid',
      date: 'quickAdd.error.dateInFuture',
      description: 'quickAdd.error.descriptionLength',
    });
    expect(validateDraft(draft({ amount: ' ', date: '2026-02-30' }), '2026-11-06')).toEqual({
      amount: 'quickAdd.error.amountRequired',
      date: 'quickAdd.error.dateInvalid',
    });
  });

  it('validateDraft_Transfer_NeedsDestinationButNoCategory', () => {
    expect(validateDraft(draft({ type: 'Transfer', categoryId: '' }), '2026-11-06')).toEqual({
      toAccountId: 'quickAdd.error.toAccountRequired',
    });
  });

  it('toRequest_ExpenseAndTransfer_SendOnlyTheFieldsOfTheirType', () => {
    expect(toRequest(draft({ amount: '12,50', description: '  Lunch  ', toAccountId: 'acc-bank' }))).toEqual({
      type: 'Expense',
      accountId: 'acc-cash',
      toAccountId: null,
      categoryId: 'cat-food',
      amount: 12.5,
      date: '2026-11-06',
      description: 'Lunch',
      note: null,
    });
    expect(toRequest(draft({ type: 'Transfer', toAccountId: 'acc-bank' }))).toMatchObject({
      toAccountId: 'acc-bank',
      categoryId: null,
      description: null,
    });
  });
});
