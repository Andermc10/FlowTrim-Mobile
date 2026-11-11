// Lectura sin conexión (HU-90) sobre las rutas reales: copia local, aviso, escrituras bloqueadas y reconexión.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';

import {
  PERSISTED_CACHE_BUSTER,
  PERSISTED_CACHE_KEY,
  createQueryPersister,
  shouldPersistQuery,
} from '@/core/api/query-persistence';
import { emptyToday, installFakeApi } from '@/testing/fake-api';
import { accountFixture, categoryFixture, transactionList } from '@/testing/movements-fixtures';
import { setNetworkConnected } from '@/testing/network';
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

const today = {
  ...emptyToday('2026-11-06'),
  currencies: [
    {
      currency: 'COP',
      available: 1_500_000,
      monthIncome: 3_000_000,
      monthExpenses: 1_200_000,
      monthNet: 1_800_000,
      todayExpenses: 45_000,
      committedUntilMonthEnd: 300_000,
      daysLeft: 25,
      safeToSpendToday: 48_000,
      shortfall: 0,
    },
  ],
};

function onlineApi() {
  return installFakeApi({
    'GET /api/dashboard/today': { body: today },
    'GET /api/subscriptions/upcoming': { body: { referenceDate: '2026-11-06', items: [] } },
    'GET /api/subscriptions': { body: { items: [], page: 1, pageSize: 100, totalCount: 0 } },
    'GET /api/accounts': { body: [accountFixture()] },
    'GET /api/categories': { body: [categoryFixture()] },
    'GET /api/transactions': { body: transactionList([]) },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
  mockStorage.set(validSession());
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
  jest.useFakeTimers({ now: new Date('2026-11-06T15:00:00Z') });
});

// Guarda en AsyncStorage una copia de Today como la que deja la app (persister real, buster y filtro de D10).
async function seedPersistedToday() {
  const client = new QueryClient();
  client.setQueryData(['dashboard', 'today'], today);
  await persistQueryClientSave({
    queryClient: client,
    persister: createQueryPersister(),
    buster: PERSISTED_CACHE_BUSTER,
    dehydrateOptions: { shouldDehydrateQuery: (query) => shouldPersistQuery(query, '2026-11') },
  });
  await flushPersistence();
}

// Deja pasar el agrupado de escrituras del persister (1 s) hasta que la copia llegue a AsyncStorage.
// Bucle explícito y no waitFor con callback asíncrono: ese solapa act() y rompe las pruebas siguientes.
async function flushPersistence(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    const saved = await AsyncStorage.getItem(PERSISTED_CACHE_KEY);
    if (saved) {
      return saved;
    }
  }
  throw new Error('The query cache was never persisted');
}

describe('Offline', () => {
  it('offline_RestartWithoutNetwork_ShowsTheSavedCopyWithTheBanner', async () => {
    // La copia que dejó una sesión anterior, guardada con el mismo persister y las mismas reglas que la app.
    await seedPersistedToday();
    // "Modo avión" al abrir la app: cualquier petición fallaría, pero no debe hacerse ninguna.
    setNetworkConnected(false);
    const offlineApi = installFakeApi({});

    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByText(/^Offline · last updated /)).toBeOnTheScreen();
    expect(screen.getByText('Safe to spend today')).toBeOnTheScreen();
    expect(screen.getByText(/48,000$/)).toBeOnTheScreen();
    expect(offlineApi.fetchMock).not.toHaveBeenCalled();
  });

  it('offline_NoSavedCopy_SaysSoInsteadOfLoadingForever', async () => {
    setNetworkConnected(false);
    installFakeApi({});
    await renderRouter('./src/app', { initialUrl: '/payments' });

    expect(
      await screen.findByText('There is no saved copy of this screen yet. Connect to load it.'),
    ).toBeOnTheScreen();
  });

  it('offline_QuickAddWithoutNetwork_ExplainsItCannotSave', async () => {
    setNetworkConnected(false);
    installFakeApi({});
    await renderRouter('./src/app', { initialUrl: '/quick-add' });

    expect(await screen.findByText("You're offline — connect to save.")).toBeOnTheScreen();
  });

  it('offline_ConnectionLostInAForm_DisablesSavingAndQueuesNothing', async () => {
    const api = onlineApi();
    await renderRouter('./src/app', { initialUrl: '/quick-add' });
    await fireEvent.changeText(await screen.findByLabelText('Amount (COP)'), '1000');

    await act(async () => setNetworkConnected(false));

    expect(await screen.findByText("! You're offline — connect to save.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save and add another' })).toBeDisabled();
    expect(api.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('offline_Reconnect_HidesTheBannerAndRefetches', async () => {
    const api = onlineApi();
    await renderRouter('./src/app', { initialUrl: '/' });
    await screen.findByText('Safe to spend today');

    await act(async () => setNetworkConnected(false));
    expect(await screen.findByText(/^Offline · last updated /)).toBeOnTheScreen();
    const before = api.calls.filter((call) => call.url.endsWith('/api/dashboard/today')).length;

    await act(async () => setNetworkConnected(true));

    await waitFor(() => expect(screen.queryByText(/^Offline · last updated /)).toBeNull());
    await waitFor(() =>
      expect(api.calls.filter((call) => call.url.endsWith('/api/dashboard/today')).length).toBeGreaterThan(
        before,
      ),
    );
  });

  it('offline_SignOut_RemovesTheSavedCopy', async () => {
    onlineApi();
    await renderRouter('./src/app', { initialUrl: '/' });
    await screen.findByText('Safe to spend today');
    expect(await flushPersistence()).toContain('dashboard');

    await fireEvent.press(screen.getByRole('link', { name: 'Open settings' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    const saved = await AsyncStorage.getItem(PERSISTED_CACHE_KEY);
    // Sin copia, o una copia sin ninguna consulta (el caché ya se vació).
    expect(saved === null || !saved.includes('dashboard')).toBe(true);
  });
});
