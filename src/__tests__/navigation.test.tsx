// Prueba de navegación sobre las rutas reales de src/app, con sesión y teléfono simulados (HU-81, HU-83, HU-84).
// Vive fuera de src/app porque allí cada archivo se convierte en una pantalla.
import { getLocales } from 'expo-localization';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

import {
  createFakeAuthService,
  createFakeLockDevice,
  createMemoryStorage,
  validSession,
} from '@/testing/test-doubles';

jest.mock('expo-localization', () => ({ getLocales: jest.fn() }));

// "mock" al inicio del nombre: Jest permite usar estas variables dentro de jest.mock.
const mockStorage = createMemoryStorage();
const mockService = createFakeAuthService();
jest.mock('@/core/auth/token-store', () => ({ secureTokenStorage: mockStorage }));
jest.mock('@/core/auth/auth-service', () => ({ createAuthService: () => mockService }));
const mockLockDevice = createFakeLockDevice();
jest.mock('@/core/lock/lock-device', () => ({ nativeLockDevice: mockLockDevice }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));

const mockedGetLocales = getLocales as jest.Mock;

function deviceLanguage(languageCode: string) {
  mockedGetLocales.mockReturnValue([{ languageCode }]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  deviceLanguage('en');
  mockStorage.set(null);
  mockService.nextSignIn(() => ({ kind: 'cancelled' }));
  // Por defecto: teléfono con huella, bloqueo apagado y oferta ya mostrada (sin diálogos en las pruebas).
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
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

describe('settings (HU-84)', () => {
  beforeEach(() => mockStorage.set({ ...validSession(), email: 'ana@example.test' }));

  it('settings_SignedIn_ShowsAccountEmailAndVersion', async () => {
    await renderRouter('./src/app', { initialUrl: '/settings' });

    expect(await screen.findByText('Signed in as ana@example.test')).toBeOnTheScreen();
    expect(screen.getByText(/^Version /)).toBeOnTheScreen();
  });

  it('settings_ChooseSpanish_TranslatesAndRemembersLanguage', async () => {
    await renderRouter('./src/app', { initialUrl: '/settings' });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Español' }));

    expect(await screen.findByRole('header', { name: 'Preferencias' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Español' })).toBeChecked();
    expect(JSON.parse((await AsyncStorage.getItem('flowtrim.preferences')) ?? '{}')).toMatchObject({
      language: 'es',
    });
  });

  it('settings_ChooseDarkTheme_RemembersTheme', async () => {
    await renderRouter('./src/app', { initialUrl: '/settings' });

    await fireEvent.press(await screen.findByRole('radio', { name: 'Dark' }));

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(JSON.parse((await AsyncStorage.getItem('flowtrim.preferences')) ?? '{}')).toMatchObject({
      theme: 'dark',
    });
  });

  it('settings_NothingEnrolled_DisablesLockWithExplanation', async () => {
    mockLockDevice.state.level = 0;
    await renderRouter('./src/app', { initialUrl: '/settings' });

    expect(await screen.findAllByText(/Set up a fingerprint, PIN or pattern/)).not.toHaveLength(0);
    expect(screen.getByRole('switch', { name: 'Lock with fingerprint or PIN' })).toBeDisabled();
  });

  it('settings_PrivacyNotes_OpenInSystemBrowser', async () => {
    await renderRouter('./src/app', { initialUrl: '/settings' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Privacy notes' }));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\//));
  });
});

describe('app lock (HU-84)', () => {
  beforeEach(() => mockStorage.set(validSession()));

  it('coldStart_LockEnabled_HidesContentBehindLockScreen', async () => {
    Object.assign(mockLockDevice.state, { enabled: true, authenticates: false });
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByRole('header', { name: 'FlowTrim is locked' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeOnTheScreen();
  });

  it('coldStart_UnlockSucceeds_ShowsToday', async () => {
    Object.assign(mockLockDevice.state, { enabled: true, authenticates: true });
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await screen.findByText('Your safe-to-spend estimate will appear here.')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'FlowTrim is locked' })).toBeNull();
  });
});
