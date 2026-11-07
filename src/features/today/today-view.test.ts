import { budgetStateKey, hasMoneyData, monthEnd, type TodayDashboard } from './today-view';

describe('monthEnd', () => {
  it.each([
    ['2026-11-06', '2026-11-30'],
    ['2026-12-31', '2026-12-31'],
    ['2027-02-10', '2027-02-28'],
    ['2028-02-10', '2028-02-29'],
  ])('monthEnd_%s_Returns%s', (reference, expected) => {
    expect(monthEnd(reference)).toBe(expected);
  });
});

describe('hasMoneyData', () => {
  const empty: TodayDashboard = {
    referenceDate: '2026-11-06',
    currencies: [],
    accounts: [],
    recentTransactions: [],
    chargesUntilMonthEnd: [],
    budgetsToWatch: [],
  };

  it('hasMoneyData_NoCurrencies_ReturnsFalse', () => {
    expect(hasMoneyData(empty)).toBe(false);
  });
});

describe('budgetStateKey', () => {
  it.each([
    ['OnTrack', 'budgets.state.OnTrack'],
    ['Warning', 'budgets.state.Warning'],
    ['Exceeded', 'budgets.state.Exceeded'],
    ['SomethingNew', 'budgets.state.Warning'],
  ])('budgetStateKey_%s_Returns%s', (state, key) => {
    expect(budgetStateKey(state)).toBe(key);
  });
});
