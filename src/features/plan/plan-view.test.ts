import { goalFixture } from '@/testing/plan-fixtures';

import {
  estimatedMonth,
  goalStatusKey,
  meterWidth,
  toContributionRequest,
  validateContribution,
  type ContributionDraft,
} from './plan-view';

const today = '2026-11-06';
const draft = (patch: Partial<ContributionDraft> = {}): ContributionDraft => ({
  kind: 'deposit',
  amount: '100000',
  date: today,
  note: '',
  ...patch,
});

describe('plan view', () => {
  it('meterWidth_ClampsTheApiPercentToTheBar', () => {
    expect(meterWidth(37.5)).toBe(37.5);
    expect(meterWidth(140)).toBe(100);
    expect(meterWidth(-5)).toBe(0);
  });

  it('goalStatusKey_CompletedWinsOverOverdue', () => {
    expect(goalStatusKey(goalFixture())).toBeNull();
    expect(goalStatusKey(goalFixture({ isOverdue: true }))).toBe('plan.goal.overdue');
    expect(goalStatusKey(goalFixture({ completed: true, isOverdue: true }))).toBe('plan.goal.completed');
  });

  it('estimatedMonth_MonthTitleOrNullWithoutData', () => {
    expect(estimatedMonth(goalFixture(), 'es')).toBe('Febrero de 2028');
    expect(estimatedMonth(goalFixture({ estimatedCompletion: null }), 'en')).toBeNull();
  });

  it('validateContribution_InvalidFields_ReturnOneKeyEach', () => {
    expect(validateContribution(draft(), today)).toEqual({});
    expect(
      validateContribution(draft({ amount: '0', date: '2026-11-07', note: 'x'.repeat(201) }), today),
    ).toEqual({
      amount: 'quickAdd.error.amountInvalid',
      date: 'quickAdd.error.dateInFuture',
      note: 'plan.contribution.noteLength',
    });
    expect(validateContribution(draft({ amount: '' }), today)).toEqual({
      amount: 'quickAdd.error.amountRequired',
    });
  });

  it('toContributionRequest_WithdrawalIsSentAsNegativeAmount', () => {
    expect(toContributionRequest(draft({ amount: '50000,5', note: '  bonus  ' }))).toEqual({
      amount: 50000.5,
      date: today,
      note: 'bonus',
    });
    expect(toContributionRequest(draft({ kind: 'withdrawal', amount: '20000' }))).toEqual({
      amount: -20000,
      date: today,
      note: null,
    });
  });
});
