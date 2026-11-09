// Plan: presupuestos y metas (HU-88) sobre las rutas reales con una API simulada.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { emptyToday, installFakeApi, type FakeRoute } from '@/testing/fake-api';
import { budgetFixture, goalFixture } from '@/testing/plan-fixtures';
import {
  createFakeAuthService,
  createFakeLockDevice,
  createMemoryStorage,
  validSession,
} from '@/testing/test-doubles';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));
const mockStorage = createMemoryStorage();
const mockService = createFakeAuthService();
const mockLockDevice = createFakeLockDevice();
jest.mock('@/core/auth/token-store', () => ({ secureTokenStorage: mockStorage }));
jest.mock('@/core/auth/auth-service', () => ({ createAuthService: () => mockService }));
jest.mock('@/core/lock/lock-device', () => ({ nativeLockDevice: mockLockDevice }));

const budgets = {
  month: '2026-11',
  items: [
    budgetFixture(),
    budgetFixture({
      id: 'bud-fun',
      categoryName: 'Entertainment',
      limit: 200_000,
      spent: 250_000,
      remaining: 0,
      over: 50_000,
      percent: 125,
      state: 'Exceeded',
    }),
  ],
};
const trip = goalFixture();
const laptop = goalFixture({
  id: 'goal-laptop',
  name: 'Laptop',
  target: 1_000_000,
  saved: 1_000_000,
  remaining: 0,
  percent: 100,
  completed: true,
  targetDate: null,
  requiredPerMonth: null,
  estimatedCompletion: null,
});

const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]')}$`);

function api(routes: Record<string, FakeRoute | (() => FakeRoute)> = {}) {
  return installFakeApi({
    'GET /api/dashboard/today': { body: emptyToday() },
    'GET /api/budgets': { body: budgets },
    'GET /api/goals': { body: [trip, laptop] },
    'GET /api/goals/goal-trip': { body: { goal: trip, contributions: [] } },
    ...routes,
  });
}

const posts = (calls: Request[]) => calls.filter((call) => call.method === 'POST');
const goalListCalls = (calls: Request[]) =>
  calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname === '/api/goals');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
  mockStorage.set(validSession());
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
  jest.useFakeTimers({ now: new Date('2026-11-06T15:00:00Z') });
});

describe('Plan', () => {
  it('plan_BudgetsAndGoals_ShowApiFiguresWithStatesInWords', async () => {
    const fake = api();
    await renderRouter('./src/app', { initialUrl: '/plan' });

    expect(await screen.findByRole('header', { name: 'Budgets · November 2026' })).toBeOnTheScreen();
    expect(
      new URL(fake.calls.find((call) => call.url.includes('/api/budgets'))!.url).searchParams.get('month'),
    ).toBe('2026-11');
    expect(screen.getByText('On track')).toBeOnTheScreen();
    expect(screen.getByText(exact('COP 300,000 of COP 800,000 (37.5 %)'))).toBeOnTheScreen();
    expect(screen.getByText(exact('COP 500,000 left'))).toBeOnTheScreen();
    expect(screen.getByText('! Over the limit')).toBeOnTheScreen();
    expect(screen.getByText(exact('COP 50,000 over the limit'))).toBeOnTheScreen();

    expect(screen.getByRole('header', { name: 'Trip' })).toBeOnTheScreen();
    expect(screen.getByText(exact('COP 500,000 of COP 2,000,000 (25 %)'))).toBeOnTheScreen();
    expect(screen.getByText(exact('COP 187,500'))).toBeOnTheScreen();
    expect(screen.getByText('February 2028')).toBeOnTheScreen();
    expect(screen.getByText('✓ Completed')).toBeOnTheScreen();
    expect(screen.getByText(/they are not promises/)).toBeOnTheScreen();
  });

  it('plan_NoBudgetsOrGoals_GuidesToTheWeb', async () => {
    api({ 'GET /api/budgets': { body: { month: '2026-11', items: [] } }, 'GET /api/goals': { body: [] } });
    await renderRouter('./src/app', { initialUrl: '/plan' });

    expect(await screen.findByText(/No budgets yet/)).toBeOnTheScreen();
    expect(screen.getByText(/No savings goals yet/)).toBeOnTheScreen();
  });
});

describe('Goal contribution', () => {
  it('contribution_Withdrawal_PostsNegativeAmountAndRefreshesGoals', async () => {
    const fake = api({
      'POST /api/goals/goal-trip/contributions': {
        status: 201,
        body: {
          id: 'c-1',
          amount: -20_000,
          date: '2026-11-06',
          note: null,
          createdAt: '2026-11-06T15:00:00Z',
        },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/plan' });
    await screen.findByRole('header', { name: 'Trip' });
    const before = goalListCalls(fake.calls).length;

    await fireEvent.press(screen.getAllByRole('button', { name: 'Add or withdraw' })[0]!);
    expect(await screen.findByText(exact('Saved so far: COP 500,000 of COP 2,000,000.'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Withdrawal' }));
    await fireEvent.changeText(screen.getByLabelText('Amount (COP)'), '20000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(posts(fake.calls)).toHaveLength(1));
    expect(await posts(fake.calls)[0]!.clone().json()).toEqual({
      amount: -20000,
      date: '2026-11-06',
      note: null,
    });
    expect(await screen.findByRole('header', { name: 'Budgets · November 2026' })).toBeOnTheScreen();
    await waitFor(() => expect(goalListCalls(fake.calls).length).toBeGreaterThan(before));
  });

  it('contribution_WithdrawalBelowZero_ShowsTheApiErrorOnTheAmount', async () => {
    api({
      'POST /api/goals/goal-trip/contributions': {
        status: 400,
        body: { title: 'Validation failed', errors: { amount: ['The goal cannot go below zero.'] } },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/goal-contribution/goal-trip' });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Withdrawal' }));
    await fireEvent.changeText(screen.getByLabelText('Amount (COP)'), '900000');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('! The goal cannot go below zero.')).toBeOnTheScreen();
  });

  it('contribution_FutureDate_IsRejectedBeforeCallingTheApi', async () => {
    const fake = api();
    await renderRouter('./src/app', { initialUrl: '/goal-contribution/goal-trip' });

    await fireEvent.changeText(await screen.findByLabelText('Amount (COP)'), '1000');
    await fireEvent.changeText(screen.getByLabelText('Other date'), '2026-11-07');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('! The date cannot be in the future.')).toBeOnTheScreen();
    expect(posts(fake.calls)).toHaveLength(0);
  });
});
