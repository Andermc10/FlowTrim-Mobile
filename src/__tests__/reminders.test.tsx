// Recordatorios locales (HU-89) sobre las rutas reales con una API y un teléfono simulados.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import type { createFakeReminderDevice } from '@/testing/test-doubles';
import { emptyToday, installFakeApi } from '@/testing/fake-api';
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

// El teléfono simulado que jest.setup.ts instala en lugar de expo-notifications.
const device = (
  jest.requireMock('@/core/reminders/reminder-device') as {
    nativeReminderDevice: ReturnType<typeof createFakeReminderDevice>;
  }
).nativeReminderDevice;

function api() {
  installFakeApi({
    'GET /api/dashboard/today': { body: emptyToday() },
    'GET /api/subscriptions/upcoming': {
      body: {
        referenceDate: '2026-11-06',
        items: [chargeFixture({ nextBillingDate: '2026-11-07', daysUntilCharge: 1 })],
      },
    },
    'GET /api/subscriptions': {
      body: { items: [subscriptionFixture()], page: 1, pageSize: 100, totalCount: 1 },
    },
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
  mockStorage.set(validSession());
  Object.assign(mockLockDevice.state, { level: 3, enabled: false, offered: true, authenticates: true });
  Object.assign(device.state, {
    permission: 'granted',
    grantsOnRequest: true,
    enabled: false,
    offered: true,
    scheduled: [],
  });
  // Los recordatorios siguen la zona del entorno (Bogotá en este PC, UTC en CI). A las 06:00 UTC (01:00 en Bogotá)
  // es 6 de noviembre en ambas y las dos 09:00 del pago de mañana aún no pasan: el resultado es el mismo.
  jest.useFakeTimers({ now: new Date('2026-11-06T06:00:00Z') });
  api();
});

async function openSettings() {
  await fireEvent.press(await screen.findByRole('link', { name: 'Open settings' }));
  return screen.findByRole('switch', { name: 'Remind me of expected charges' });
}

describe('Reminders', () => {
  it('reminders_TurnedOnInSettings_AsksPermissionAndSchedulesFromUpcoming', async () => {
    device.state.permission = 'denied';
    await renderRouter('./src/app', { initialUrl: '/' });

    await fireEvent(await openSettings(), 'valueChange', true);

    await waitFor(() => expect(device.state.scheduled).toHaveLength(2));
    expect(device.requestPermission).toHaveBeenCalledTimes(1);
    expect(device.state.enabled).toBe(true);
    expect(device.state.scheduled.map((reminder) => reminder.title)).toEqual([
      'Expected charge tomorrow',
      'Expected charge today',
    ]);
  });

  it('reminders_PermissionDenied_ToggleStaysOffWithHint', async () => {
    device.state.permission = 'denied';
    device.state.grantsOnRequest = false;
    await renderRouter('./src/app', { initialUrl: '/' });

    const toggle = await openSettings();
    await fireEvent(toggle, 'valueChange', true);

    expect(await screen.findByText(/Notifications are blocked for FlowTrim/)).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Remind me of expected charges' })).not.toBeChecked();
    expect(device.state.enabled).toBe(false);
    expect(device.state.scheduled).toEqual([]);
  });

  it('reminders_TurnedOff_CancelsEverything', async () => {
    device.state.enabled = true;
    await renderRouter('./src/app', { initialUrl: '/' });
    await waitFor(() => expect(device.state.scheduled).toHaveLength(2));

    await fireEvent(await openSettings(), 'valueChange', false);

    await waitFor(() => expect(device.state.scheduled).toEqual([]));
    expect(device.state.enabled).toBe(false);
  });

  it('reminders_SignOut_CancelsAndForgetsTheOptIn', async () => {
    device.state.enabled = true;
    await renderRouter('./src/app', { initialUrl: '/' });
    await waitFor(() => expect(device.state.scheduled).toHaveLength(2));

    await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    await waitFor(() => expect(device.state.scheduled).toEqual([]));
    expect(device.state.enabled).toBe(false);
  });

  it('reminders_NotOfferedYet_AreOfferedOnceAfterPaymentsLoad', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    device.state.offered = false;
    await renderRouter('./src/app', { initialUrl: '/' });

    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    expect(alert.mock.calls[0]![0]).toBe('Remind you of upcoming charges?');
    expect(device.state.offered).toBe(true);
    expect(device.requestPermission).not.toHaveBeenCalled();
  });

  it('reminders_Tapped_OpensThePaymentsTab', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await screen.findByRole('link', { name: 'Open settings' });

    await act(async () => device.open('sub-netflix'));

    expect(await screen.findByText('In 1 day · Nov 7, 2026')).toBeOnTheScreen();
  });
});
