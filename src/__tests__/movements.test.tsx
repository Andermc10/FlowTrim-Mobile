// Movimientos y registro rápido (HU-86) sobre las rutas reales con una API simulada.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { emptyToday, installFakeApi, type FakeRoute } from '@/testing/fake-api';
import {
  accountFixture,
  categoryFixture,
  transactionFixture,
  transactionList,
} from '@/testing/movements-fixtures';
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

const accounts = [
  accountFixture({ id: 'acc-cash', name: 'Cash wallet' }),
  accountFixture({ id: 'acc-bank', name: 'Main bank', type: 'Bank' }),
  accountFixture({ id: 'acc-old', name: 'Old card', isArchived: true }),
];
const categories = [
  categoryFixture({ id: 'cat-food', name: 'Food' }),
  categoryFixture({ id: 'cat-transport', name: 'Transport' }),
  categoryFixture({ id: 'cat-salary', name: 'Salary', kind: 'Income' }),
];

const monthItems = [
  transactionFixture({ id: 'tx-1', date: '2026-11-06', description: 'Lunch', amount: 38_900 }),
  transactionFixture({
    id: 'tx-2',
    date: '2026-11-06',
    type: 'Income',
    categoryId: 'cat-salary',
    categoryName: 'Salary',
    accountId: 'acc-bank',
    accountName: 'Main bank',
    amount: 3_000_000,
  }),
  transactionFixture({
    id: 'tx-3',
    date: '2026-11-02',
    type: 'Transfer',
    categoryId: null,
    categoryName: null,
    toAccountId: 'acc-cash',
    toAccountName: 'Cash wallet',
    accountName: 'Main bank',
    amount: 200_000,
  }),
];
const monthTotals = [{ currency: 'COP', income: 3_000_000, expense: 38_900, net: 2_961_100 }];

// Mismo criterio que today.test: cada espacio acepta también el no separable que pone Intl.
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]')}$`);

function api(routes: Record<string, FakeRoute | (() => FakeRoute)> = {}) {
  return installFakeApi({
    'GET /api/dashboard/today': { body: emptyToday() },
    'GET /api/transactions': { body: transactionList(monthItems, { totals: monthTotals }) },
    'GET /api/accounts': { body: accounts },
    'GET /api/categories': { body: categories },
    ...routes,
  });
}

const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);
// Solo el listado del mes (página de 50); la consulta de uso reciente del registro rápido pide 200.
const listCalls = (calls: Request[]) =>
  calls.filter((call) => {
    const url = new URL(call.url);
    return (
      call.method === 'GET' &&
      url.pathname === '/api/transactions' &&
      url.searchParams.get('pageSize') === '50'
    );
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
  mockStorage.set(validSession());
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
  // 6 de noviembre de 2026, 10:00 en Bogotá: "hoy" y el mes actual de las pruebas.
  jest.useFakeTimers({ now: new Date('2026-11-06T15:00:00Z') });
});

describe('Movements', () => {
  it('movements_CurrentMonth_GroupsByDayWithSignedAmountsAndApiTotals', async () => {
    const fake = api();
    await renderRouter('./src/app', { initialUrl: '/movements' });

    expect(await screen.findByText('Lunch')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'November 2026' })).toBeOnTheScreen();
    expect(screen.getByText('Nov 6, 2026')).toBeOnTheScreen();
    expect(screen.getByText('Nov 2, 2026')).toBeOnTheScreen();
    // Una vez en la fila y otra en el total de gastos del mes.
    expect(screen.getAllByText(exact('-COP 38,900'))).toHaveLength(2);
    expect(screen.getAllByText(exact('+COP 3,000,000'))).toHaveLength(2);
    // Transferencia: sin signo y con el tipo en palabras.
    expect(screen.getByText(exact('COP 200,000'))).toBeOnTheScreen();
    expect(screen.getByText('Transfer · Main bank → Cash wallet')).toBeOnTheScreen();
    // Totales tal como los envía la API (la app no suma).
    expect(screen.getByText(exact('COP 2,961,100'))).toBeOnTheScreen();

    expect(query(listCalls(fake.calls)[0]!)).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
      page: '1',
      pageSize: '50',
    });
  });

  it('movements_PreviousMonthAndTypeFilter_AreSentToTheApi', async () => {
    const fake = api();
    await renderRouter('./src/app', { initialUrl: '/movements' });
    await screen.findByText('Lunch');

    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(query(listCalls(fake.calls).at(-1)!)).toMatchObject({ from: '2026-10-01' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Income' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Old card (archived)' }));

    await waitFor(() =>
      expect(query(listCalls(fake.calls).at(-1)!)).toMatchObject({
        from: '2026-10-01',
        type: 'Income',
        accountId: 'acc-old',
      }),
    );
    expect(screen.getByRole('button', { name: 'Filters (2 active)' })).toBeOnTheScreen();
  });

  it('movements_MorePagesOnServer_LoadsTheNextPage', async () => {
    const fake = api({
      'GET /api/transactions': () => {
        const page = query(listCalls(fake.calls).at(-1)!).page;
        return page === '2'
          ? {
              body: transactionList([transactionFixture({ id: 'tx-9', description: 'Taxi' })], {
                page: 2,
                totalCount: 51,
              }),
            }
          : { body: transactionList(monthItems, { totalCount: 51, totals: monthTotals }) };
      },
    });
    await renderRouter('./src/app', { initialUrl: '/movements' });
    await screen.findByText('Lunch');

    await fireEvent.press(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Taxi')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('movements_EmptyMonth_GuidesToQuickAdd', async () => {
    api({ 'GET /api/transactions': { body: transactionList([]) } });
    await renderRouter('./src/app', { initialUrl: '/movements' });

    expect(await screen.findByRole('header', { name: 'No movements this month' })).toBeOnTheScreen();
    expect(screen.getByText('Tap + to record an expense, income or transfer.')).toBeOnTheScreen();
  });
});

describe('Quick add', () => {
  it('quickAdd_Expense_PostsRequestRemembersAccountAndRefreshesLists', async () => {
    const fake = api({
      'POST /api/transactions': () => ({
        status: 201,
        body: transactionFixture({ id: 'tx-new', accountId: 'acc-bank', accountName: 'Main bank' }),
      }),
    });
    await renderRouter('./src/app', { initialUrl: '/movements' });
    await screen.findByText('Lunch');
    const listsBefore = listCalls(fake.calls).length;

    await fireEvent.press(screen.getByRole('link', { name: 'Add a movement' }));
    await fireEvent.changeText(await screen.findByLabelText('Amount (COP)'), '12,50');
    await fireEvent.press(screen.getByRole('radio', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Main bank · COP' }));
    await fireEvent.changeText(screen.getByLabelText('Description (optional)'), 'Coffee');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    // waitFor síncrono (uno asíncrono solapa act() y contamina las pruebas siguientes); el cuerpo se lee después.
    await waitFor(() => expect(fake.calls.some((call) => call.method === 'POST')).toBe(true));
    const posted: unknown = await fake.calls
      .find((call) => call.method === 'POST')!
      .clone()
      .json();
    expect(posted).toEqual({
      type: 'Expense',
      accountId: 'acc-bank',
      toAccountId: null,
      categoryId: 'cat-food',
      amount: 12.5,
      date: '2026-11-06',
      description: 'Coffee',
      note: null,
    });
    // Se cierra, se recuerda la cuenta (solo el id) y el listado se vuelve a pedir (FR-3).
    expect(await screen.findByText('Lunch')).toBeOnTheScreen();
    expect(await AsyncStorage.getItem('flowtrim.quickAdd.lastAccountId')).toBe('acc-bank');
    await waitFor(() => expect(listCalls(fake.calls).length).toBeGreaterThan(listsBefore));
  });

  it('quickAdd_RememberedAccountAndUsage_PreselectsAccountAndOrdersChips', async () => {
    await AsyncStorage.setItem('flowtrim.quickAdd.lastAccountId', 'acc-bank');
    api({
      'GET /api/transactions': {
        body: transactionList([
          transactionFixture({ categoryId: 'cat-transport' }),
          transactionFixture({ categoryId: 'cat-transport' }),
        ]),
      },
    });
    await renderRouter('./src/app', { initialUrl: '/quick-add' });

    expect(await screen.findByRole('radio', { name: 'Main bank · COP' })).toBeChecked();
    const chips = screen.getAllByRole('radio').map((chip) => chip.props.accessibilityLabel as string);
    expect(chips.indexOf('Transport')).toBeLessThan(chips.indexOf('Food'));
    // Las cuentas archivadas no se ofrecen para registrar.
    expect(screen.queryByRole('radio', { name: 'Old card · COP' })).toBeNull();
  });

  it('quickAdd_InvalidDraft_ShowsFieldErrorsWithoutCallingTheApi', async () => {
    const fake = api();
    await renderRouter('./src/app', { initialUrl: '/quick-add' });

    await fireEvent.changeText(await screen.findByLabelText('Other date'), '2026-11-07');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('! Enter the amount.')).toBeOnTheScreen();
    expect(screen.getByText('! Choose a category.')).toBeOnTheScreen();
    expect(screen.getByText('! The date cannot be in the future.')).toBeOnTheScreen();
    expect(fake.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('quickAdd_ApiValidationError_IsShownOnTheField', async () => {
    api({
      'POST /api/transactions': {
        status: 400,
        body: { title: 'Validation failed', errors: { amount: ['Amount must be greater than zero.'] } },
      },
    });
    await renderRouter('./src/app', { initialUrl: '/quick-add' });

    await fireEvent.changeText(await screen.findByLabelText('Amount (COP)'), '1');
    await fireEvent.press(screen.getByRole('radio', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('! Amount must be greater than zero.')).toBeOnTheScreen();
  });

  it('quickAdd_SaveAndAddAnother_KeepsFormOpenWithTypeAndAccount', async () => {
    api({ 'POST /api/transactions': { status: 201, body: transactionFixture({ amount: 38_900 }) } });
    await renderRouter('./src/app', { initialUrl: '/quick-add' });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Food' }));
    await fireEvent.changeText(screen.getByLabelText('Amount (COP)'), '38900');
    await fireEvent.press(screen.getByRole('button', { name: 'Save and add another' }));

    expect(await screen.findByText(exact('✓ Expense saved · Food · COP 38,900'))).toBeOnTheScreen();
    expect(screen.getByLabelText('Amount (COP)')).toHaveDisplayValue('');
    expect(screen.getByRole('radio', { name: 'Food' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Cash wallet · COP' })).toBeChecked();
  });

  it('quickAdd_Transfer_OffersOnlyOtherAccountsInSameCurrency', async () => {
    api();
    await renderRouter('./src/app', { initialUrl: '/quick-add' });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Transfer' }));

    expect(screen.queryByText('Category')).toBeNull();
    expect(screen.getByText('To account')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Main bank' })).toBeOnTheScreen();
  });
});
