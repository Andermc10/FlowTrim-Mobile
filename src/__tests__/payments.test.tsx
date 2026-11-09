// Pagos recurrentes y "Marcar como pagado" (HU-87) sobre las rutas reales con una API simulada.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import { emptyToday, installFakeApi, type FakeRoute } from '@/testing/fake-api';
import { accountFixture, categoryFixture, transactionFixture } from '@/testing/movements-fixtures';
import { chargeFixture, subscriptionFixture } from '@/testing/payments-fixtures';
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

const streaming = subscriptionFixture({
  id: 'sub-streaming',
  name: 'Streaming',
  defaultAccountId: 'acc-bank',
  categoryId: 'cat-subs',
  paymentUrl: 'https://pay.example.test/streaming',
});
const rent = subscriptionFixture({ id: 'sub-rent', name: 'Rent', kind: 'Bill', amount: 1_200_000 });
const laptop = subscriptionFixture({
  id: 'sub-laptop',
  name: 'Laptop',
  kind: 'Instalment',
  amount: 300_000,
  totalInstalments: 3,
  paidInstalments: 2,
  defaultAccountId: 'acc-bank',
  categoryId: 'cat-subs',
});
const upcoming = {
  referenceDate: '2026-11-06',
  items: [
    chargeFixture({
      id: 'sub-rent',
      name: 'Rent',
      amount: 1_200_000,
      nextBillingDate: '2026-11-03',
      daysUntilCharge: -3,
      alertWindow: 'Overdue',
    }),
    chargeFixture({ id: 'sub-streaming', name: 'Streaming' }),
    chargeFixture({
      id: 'sub-laptop',
      name: 'Laptop',
      amount: 300_000,
      nextBillingDate: '2026-11-20',
      daysUntilCharge: 14,
      alertWindow: 'Later',
    }),
  ],
};
const accounts = [
  accountFixture({ id: 'acc-cash', name: 'Cash wallet' }),
  accountFixture({ id: 'acc-bank', name: 'Main bank' }),
  accountFixture({ id: 'acc-usd', name: 'Dollar savings', currency: 'USD' }),
];
const categories = [categoryFixture({ id: 'cat-subs', name: 'Subscriptions' })];

const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]')}$`);

function api(routes: Record<string, FakeRoute | (() => FakeRoute)> = {}) {
  return installFakeApi({
    'GET /api/dashboard/today': { body: emptyToday() },
    'GET /api/subscriptions/upcoming': { body: upcoming },
    'GET /api/subscriptions': {
      body: { items: [streaming, rent, laptop], page: 1, pageSize: 100, totalCount: 3 },
    },
    'GET /api/subscriptions/sub-streaming': { body: streaming },
    'GET /api/subscriptions/sub-rent': { body: rent },
    'GET /api/subscriptions/sub-laptop': { body: laptop },
    'GET /api/accounts': { body: accounts },
    'GET /api/categories': { body: categories },
    ...routes,
  });
}

const posts = (calls: Request[]) => calls.filter((call) => call.method === 'POST');
const upcomingCalls = (calls: Request[]) =>
  calls.filter((call) => new URL(call.url).pathname === '/api/subscriptions/upcoming');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
  mockStorage.set(validSession());
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
  jest.useFakeTimers({ now: new Date('2026-11-06T15:00:00Z') });
});

describe('Payments', () => {
  it('payments_ActivePayments_ShowCountdownWindowKindAndInstalments', async () => {
    api();
    await renderRouter('./src/app', { initialUrl: '/payments' });

    expect(await screen.findByRole('header', { name: 'Rent' })).toBeOnTheScreen();
    expect(screen.getByText('! Overdue')).toBeOnTheScreen();
    expect(screen.getByText('Overdue by 3 days · Nov 3, 2026')).toBeOnTheScreen();
    expect(screen.getByText('Bill')).toBeOnTheScreen();
    expect(screen.getByText('Within 3 days')).toBeOnTheScreen();
    expect(screen.getByText('In 2 days · Nov 8, 2026')).toBeOnTheScreen();
    expect(screen.getByText('Instalment plan')).toBeOnTheScreen();
    expect(screen.getByText('2 of 3 instalments paid')).toBeOnTheScreen();
    expect(screen.getByText('Create and edit recurring payments in the FlowTrim web app.')).toBeOnTheScreen();
  });

  it('payments_PayAtProvider_OpensTheHttpsLinkInTheSystemBrowser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    api();
    await renderRouter('./src/app', { initialUrl: '/payments' });

    // Solo Streaming tiene enlace.
    const buttons = await screen.findAllByRole('button', { name: 'Pay at provider ↗' });
    expect(buttons).toHaveLength(1);
    await fireEvent.press(buttons[0]!);

    expect(open).toHaveBeenCalledWith('https://pay.example.test/streaming');
  });
});

describe('Mark as paid', () => {
  it('markPaid_RecordInDefaultAccount_PostsBodyShowsResultAndRefreshesPayments', async () => {
    const fake = api({
      'POST /api/subscriptions/sub-streaming/mark-paid': {
        body: {
          subscription: { ...streaming, nextBillingDate: '2026-12-08' },
          transaction: transactionFixture({
            amount: 41_200,
            accountId: 'acc-bank',
            accountName: 'Main bank',
          }),
          completed: false,
        },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/payments' });
    await screen.findByRole('header', { name: 'Streaming' });
    const before = upcomingCalls(fake.calls).length;

    await fireEvent.press(screen.getAllByRole('button', { name: 'Mark as paid' })[1]!);

    expect(await screen.findByRole('radio', { name: 'Main bank' })).toBeChecked();
    // Solo cuentas en la moneda del pago.
    expect(screen.queryByRole('radio', { name: 'Dollar savings' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Subscriptions' })).toBeChecked();
    const amount = screen.getByLabelText('Amount paid (COP)');
    expect(amount).toHaveDisplayValue('38900');
    await fireEvent.changeText(amount, '41200');
    await fireEvent.press(screen.getByRole('button', { name: 'Record payment' }));

    expect(
      await screen.findByText(
        exact('✓ COP 41,200 for "Streaming" recorded in Main bank. Next expected charge: Dec 8, 2026.'),
      ),
    ).toBeOnTheScreen();
    expect(await posts(fake.calls)[0]!.clone().json()).toEqual({
      accountId: 'acc-bank',
      amount: 41200,
      date: '2026-11-06',
      categoryId: 'cat-subs',
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('header', { name: 'Rent' })).toBeOnTheScreen();
    await waitFor(() => expect(upcomingCalls(fake.calls).length).toBeGreaterThan(before));
  });

  it('markPaid_NoDefaultAccount_OnlyMovesTheDateWithoutBody', async () => {
    const fake = api({
      'POST /api/subscriptions/sub-rent/mark-paid': {
        body: {
          subscription: { ...rent, nextBillingDate: '2026-12-03' },
          transaction: null,
          completed: false,
        },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/mark-paid/sub-rent' });

    expect(await screen.findByRole('radio', { name: 'Paid outside FlowTrim' })).toBeChecked();
    expect(screen.queryByLabelText('Amount paid (COP)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Move next date' }));

    expect(
      await screen.findByText('✓ "Rent" marked as paid. Next expected charge: Dec 3, 2026.'),
    ).toBeOnTheScreen();
    expect(await posts(fake.calls)[0]!.clone().text()).toBe('');
  });

  it('markPaid_LastInstalment_SaysThePlanIsCompleted', async () => {
    api({
      'POST /api/subscriptions/sub-laptop/mark-paid': {
        body: {
          subscription: { ...laptop, paidInstalments: 3, status: 'Inactive' },
          transaction: transactionFixture({ amount: 300_000 }),
          completed: true,
        },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/mark-paid/sub-laptop' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Record payment' }));

    expect(
      await screen.findByText(
        '✓ "Laptop" is fully paid. The plan is completed and no longer counts as an expected charge.',
      ),
    ).toBeOnTheScreen();
  });

  it('markPaid_ApiValidationError_IsShownOnTheField', async () => {
    api({
      'POST /api/subscriptions/sub-streaming/mark-paid': {
        status: 400,
        body: {
          title: 'Validation failed',
          errors: { accountId: ['The account must use the payment currency.'] },
        },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/mark-paid/sub-streaming' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Record payment' }));

    expect(await screen.findByText('! The account must use the payment currency.')).toBeOnTheScreen();
  });

  it('markPaid_FutureDate_IsRejectedBeforeCallingTheApi', async () => {
    const fake = api();
    await renderRouter('./src/app', { initialUrl: '/mark-paid/sub-streaming' });

    await fireEvent.changeText(await screen.findByLabelText('Other date'), '2026-11-07');
    await fireEvent.press(screen.getByRole('button', { name: 'Record payment' }));

    expect(screen.getByText('! The payment date cannot be in the future.')).toBeOnTheScreen();
    expect(posts(fake.calls)).toHaveLength(0);
  });
});
