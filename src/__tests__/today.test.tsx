// Today (HU-85) sobre las rutas reales con una API simulada. AC-1: la pantalla muestra exactamente las cifras de la
// API (las mismas que ve la web), solo formateadas.
import { getLocales } from 'expo-localization';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { emptyToday, installFakeApi } from '@/testing/fake-api';
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

// Respuesta fija con cifras redondas para poder leerlas en la prueba.
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
  chargesUntilMonthEnd: [
    {
      subscriptionId: '00000000-0000-0000-0000-000000000001',
      name: 'Streaming',
      amount: 44_900,
      currency: 'COP',
      nextBillingDate: '2026-11-03',
      isOverdue: true,
    },
  ],
  budgetsToWatch: [
    {
      id: '00000000-0000-0000-0000-000000000002',
      categoryId: '00000000-0000-0000-0000-000000000003',
      categoryName: 'Groceries',
      categoryColor: 'green',
      categoryIcon: 'cart',
      categoryArchived: false,
      currency: 'COP',
      limit: 800_000,
      spent: 700_000,
      remaining: 100_000,
      over: 0,
      percent: 87.5,
      state: 'Warning',
    },
  ],
};

// Texto exacto tal como se ve ("$ 48.000"): se escapan los caracteres especiales y cada espacio acepta también el
// no separable (U+00A0) que Intl pone entre el símbolo y el número.
const exact = (text: string) =>
  new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]')}$`);

beforeEach(() => {
  jest.clearAllMocks();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'es' }]);
  mockStorage.set(validSession());
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
});

describe('Today', () => {
  it('today_ApiFigures_AreShownExactlyAsReturned', async () => {
    installFakeApi({ 'GET /api/dashboard/today': { body: today } });

    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByText('Puedes gastar hoy')).toBeOnTheScreen();
    expect(screen.getByText(exact('$ 48.000'))).toBeOnTheScreen();
    expect(screen.getByText('Por día para los 25 días que quedan del mes, hoy incluido.')).toBeOnTheScreen();
    expect(screen.getByText(exact('+$ 3.000.000'))).toBeOnTheScreen();
    expect(screen.getByText(exact('-$ 1.200.000'))).toBeOnTheScreen();
  });

  it('today_HowIsThisCalculated_ShowsFormulaWithRealNumbersAndCaveat', async () => {
    installFakeApi({ 'GET /api/dashboard/today': { body: today } });
    await renderRouter('./src/app', { initialUrl: '/' });

    await fireEvent.press(await screen.findByRole('button', { name: '¿Cómo se calcula?' }));

    expect(screen.getByText(exact('($ 1.500.000 − $ 300.000) ÷ 25 = $ 48.000'))).toBeOnTheScreen();
    expect(screen.getByText('Cobros esperados hasta el 30 de nov de 2026')).toBeOnTheScreen();
    expect(screen.getByText(/Es una estimación, no una asesoría financiera/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ocultar el cálculo' })).toBeOnTheScreen();
  });

  it('today_OverdueChargeAndBudget_AreDescribedWithText', async () => {
    installFakeApi({ 'GET /api/dashboard/today': { body: today } });
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByText('Streaming')).toBeOnTheScreen();
    expect(screen.getByText('Vencido · 3 de nov de 2026')).toBeOnTheScreen();
    expect(screen.getByText('Cerca del límite')).toBeOnTheScreen();
    expect(screen.getByText(exact('$ 700.000 de $ 800.000 (87.5 %)'))).toBeOnTheScreen();
  });

  it('today_Shortfall_IsAnnouncedAsAlert', async () => {
    const short = {
      ...today,
      currencies: [{ ...today.currencies[0]!, shortfall: 200_000, safeToSpendToday: 0 }],
    };
    installFakeApi({ 'GET /api/dashboard/today': { body: short } });
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /superan tu dinero disponible en \$[\s ]200\.000/,
    );
  });

  it('today_NoAccounts_ShowsGuideInsteadOfZeros', async () => {
    installFakeApi({ 'GET /api/dashboard/today': { body: emptyToday() } });
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByRole('header', { name: 'Agrega tu primera cuenta' })).toBeOnTheScreen();
    expect(screen.queryByText('Puedes gastar hoy')).toBeNull();
    expect(screen.getByText('No se esperan cobros antes de que termine el mes.')).toBeOnTheScreen();
  });

  it('today_ServerError_ShowsReferenceAndRetries', async () => {
    let fail = true;
    installFakeApi({
      'GET /api/dashboard/today': () =>
        fail
          ? { status: 500, body: { title: 'An error occurred.', correlationId: 'ref-today-1' } }
          : { body: today },
    });
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByText('Referencia: ref-today-1', {}, { timeout: 15000 })).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    expect(await screen.findByText('Puedes gastar hoy')).toBeOnTheScreen();
  });

  it('today_Request_SendsBearerTokenAndInterfaceLanguage', async () => {
    const api = installFakeApi({ 'GET /api/dashboard/today': { body: today } });
    await renderRouter('./src/app', { initialUrl: '/' });
    await screen.findByText('Puedes gastar hoy');

    const request = api.calls.find((call) => call.url.endsWith('/api/dashboard/today'))!;
    expect(request.headers.get('Authorization')).toBe('Bearer test-access-token');
    expect(request.headers.get('Accept-Language')).toBe('es');
  });
});
