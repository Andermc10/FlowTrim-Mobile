// Comportamiento del bloqueo (HU-84): arranque en frío, regla de 60 s, activar con autenticación, cerrar sesión.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { createQueryClient } from '@/core/api/query-client';
import { AuthProvider, useAuth } from '@/core/auth/auth-provider';
import type { StoredSession } from '@/core/auth/session';
import { I18nProvider } from '@/core/i18n/i18n';
import {
  createFakeAuthService,
  createFakeLockDevice,
  createMemoryStorage,
  validSession,
  type FakeLockOptions,
} from '@/testing/test-doubles';

import { AppLockProvider, useAppLock } from './app-lock';

let appStateListener: ((state: AppStateStatus) => void) | undefined;

beforeEach(() => {
  // Se captura el listener de AppState para simular "ir a segundo plano" y "volver".
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function setup(lock: FakeLockOptions = {}, session: StoredSession | null = validSession()) {
  const device = createFakeLockDevice(lock);
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLanguage="en">
        <AuthProvider service={createFakeAuthService()} storage={createMemoryStorage(session)}>
          <AppLockProvider device={device}>{children}</AppLockProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
  const { result } = await renderHook(() => ({ lock: useAppLock(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(result.current.lock.enabled).not.toBeNull());
  return { result, device };
}

// Simula salir de la app, esperar `seconds` y volver.
async function leaveAndReturn(seconds: number) {
  const start = Date.now();
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(start);
  await act(async () => appStateListener?.('background'));
  now.mockReturnValue(start + seconds * 1000);
  await act(async () => appStateListener?.('active'));
  now.mockRestore();
}

describe('AppLockProvider', () => {
  it('coldStart_LockEnabled_IsLockedUntilUnlocked', async () => {
    const { result } = await setup({ enabled: true });
    expect(result.current.lock.locked).toBe(true);

    await act(async () => result.current.lock.unlock());

    expect(result.current.lock.locked).toBe(false);
  });

  it('unlock_AuthenticationCancelled_StaysLocked', async () => {
    const { result } = await setup({ enabled: true, authenticates: false });

    await act(async () => result.current.lock.unlock());

    expect(result.current.lock.locked).toBe(true);
  });

  // AC-1 de HU-84.
  it('resume_After61Seconds_Locks', async () => {
    const { result } = await setup({ enabled: true });
    await act(async () => result.current.lock.unlock());

    await leaveAndReturn(61);

    expect(result.current.lock.locked).toBe(true);
  });

  it('resume_After30Seconds_DoesNotLock', async () => {
    const { result } = await setup({ enabled: true });
    await act(async () => result.current.lock.unlock());

    await leaveAndReturn(30);

    expect(result.current.lock.locked).toBe(false);
  });

  it('resume_LockDisabled_NeverLocks', async () => {
    const { result } = await setup({ enabled: false });

    await leaveAndReturn(3600);

    expect(result.current.lock.locked).toBe(false);
  });

  it('enable_AfterAuthentication_SavesAndProtectsScreen', async () => {
    const { result, device } = await setup({ enabled: false });

    await act(async () => {
      await result.current.lock.setEnabled(true);
    });

    expect(device.state.enabled).toBe(true);
    await waitFor(() => expect(device.protectScreen).toHaveBeenLastCalledWith(true));
  });

  it('enable_AuthenticationFails_StaysOff', async () => {
    const { result, device } = await setup({ enabled: false, authenticates: false });

    let changed = true;
    await act(async () => {
      changed = await result.current.lock.setEnabled(true);
    });

    expect(changed).toBe(false);
    expect(device.state.enabled).toBe(false);
  });

  it('availability_NothingEnrolled_IsNotEnrolled', async () => {
    const { result } = await setup({ level: 0 });
    expect(result.current.lock.availability).toBe('notEnrolled');
  });

  it('signOut_ClearsLockSettingAndScreenProtection', async () => {
    const { result, device } = await setup({ enabled: true });
    await act(async () => result.current.lock.unlock());

    await act(async () => result.current.auth.signOut());

    await waitFor(() => expect(device.state.enabled).toBe(false));
    expect(result.current.lock.locked).toBe(false);
    await waitFor(() => expect(device.protectScreen).toHaveBeenLastCalledWith(false));
  });

  it('firstSignIn_LockAvailableAndNeverOffered_OffersOnce', async () => {
    const { result, device } = await setup({ enabled: false, offered: false });
    expect(result.current.lock.offerPending).toBe(true);

    await act(async () => result.current.lock.dismissOffer());

    expect(result.current.lock.offerPending).toBe(false);
    expect(device.state.offered).toBe(true);
  });

  it('offer_NothingEnrolled_IsNotShown', async () => {
    const { result } = await setup({ level: 0, offered: false });
    expect(result.current.lock.offerPending).toBe(false);
  });
});
