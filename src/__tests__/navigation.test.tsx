// Prueba de navegación sobre las rutas reales de src/app, con sesión simulada (AC de HU-81 y HU-83).
// Vive fuera de src/app porque allí cada archivo se convierte en una pantalla.
import { getLocales } from 'expo-localization';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { createFakeAuthService, createMemoryStorage, validSession } from '@/testing/test-doubles';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

// "mock" al inicio del nombre: Jest permite usar estas variables dentro de jest.mock.
const mockStorage = createMemoryStorage();
const mockService = createFakeAuthService();
jest.mock('@/core/auth/token-store', () => ({ secureTokenStorage: mockStorage }));
jest.mock('@/core/auth/auth-service', () => ({ createAuthService: () => mockService }));

const mockedGetLocales = getLocales as jest.Mock;

function deviceLanguage(languageCode: string) {
  mockedGetLocales.mockReturnValue([{ languageCode }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  deviceLanguage('en');
  mockStorage.set(null);
  mockService.nextSignIn(() => ({ kind: 'cancelled' }));
});

describe('signed in', () => {
  beforeEach(() => mockStorage.set(validSession()));

  it('rootRoute_StoredSession_ShowsFourTabsAndToday', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });

    for (const label of ['Today', 'Movements', 'Payments', 'Plan']) {
      expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Your safe-to-spend estimate will appear here.')).toBeOnTheScreen();
  });

  it('paymentsRoute_SpanishDevice_ShowsSpanishTexts', async () => {
    deviceLanguage('es');

    await renderRouter('./src/app', { initialUrl: '/payments' });

    expect(await screen.findByRole('header', { name: 'Pagos recurrentes' })).toBeOnTheScreen();
    expect(screen.getAllByText('Movimientos').length).toBeGreaterThan(0);
  });

  it('signOut_FromSettings_ShowsWelcomeAndRemovesTokens', async () => {
    await renderRouter('./src/app', { initialUrl: '/settings' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    expect(mockStorage.current()).toBeNull();
    expect(mockService.endSession).toHaveBeenCalledTimes(1);
  });
});

describe('signed out', () => {
  it('protectedRoute_WithoutSession_ShowsWelcomeInstead', async () => {
    await renderRouter('./src/app', { initialUrl: '/payments' });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.queryByText('Your upcoming expected charges will appear here.')).toBeNull();
  });

  it('signIn_Success_StoresTokensAndShowsToday', async () => {
    mockService.nextSignIn(() => ({ kind: 'success', session: validSession() }));
    await renderRouter('./src/app', { initialUrl: '/' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Your safe-to-spend estimate will appear here.')).toBeOnTheScreen();
    expect(mockStorage.current()).toContain('test-access-token');
  });

  it('signIn_Cancelled_StaysOnWelcomeWithNotice', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Sign-in was cancelled.')).toBeOnTheScreen();
    expect(mockStorage.current()).toBeNull();
  });
});
