// Aislamiento entre cuentas (AC-1 de HU-83): al cerrar sesión o al vencer, no queda nada del usuario anterior.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/core/api/query-client';
import type { StoredSession } from '@/core/auth/session';
import { createFakeAuthService, createMemoryStorage, validSession } from '@/testing/test-doubles';

import { AuthProvider, useAuth } from './auth-provider';

async function setup(initial: StoredSession | null = validSession()) {
  const queryClient = createQueryClient();
  const storage = createMemoryStorage(initial);
  const service = createFakeAuthService();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider service={service} storage={storage}>
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
  const { result } = await renderHook(() => useAuth(), { wrapper });
  // Espera a que termine de restaurar la sesión guardada.
  await waitFor(() => expect(result.current.status).not.toBe('restoring'));
  return { result, queryClient, storage, service };
}

describe('AuthProvider', () => {
  it('restore_StoredSession_IsSignedIn', async () => {
    const { result } = await setup();
    expect(result.current.status).toBe('signedIn');
  });

  it('signOut_WithCachedData_ClearsCacheAndTokens', async () => {
    const { result, queryClient, storage, service } = await setup();
    // Datos de la cuenta A en el caché (lo que verían las pantallas).
    queryClient.setQueryData(['accounts'], [{ name: 'Account of A' }]);

    await act(async () => result.current.signOut());

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.current()).toBeNull();
    expect(service.endSession).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'test-refresh-token' }),
    );
  });

  it('expireSession_After401_ClearsCacheAndShowsExpiredNotice', async () => {
    const { result, queryClient, storage } = await setup();
    queryClient.setQueryData(['accounts'], [{ name: 'Account of A' }]);

    await act(async () => result.current.expireSession());

    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.notice).toBe('expired');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.current()).toBeNull();
  });

  it('signIn_NewAccount_ClearsDataLeftFromBefore', async () => {
    const { result, queryClient, service } = await setup(null);
    queryClient.setQueryData(['accounts'], [{ name: 'Stale' }]);
    service.nextSignIn(() => ({ kind: 'success', session: { ...validSession(), accessToken: 'account-b' } }));

    await act(async () => result.current.signIn());

    expect(result.current.status).toBe('signedIn');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    await expect(result.current.getAccessToken()).resolves.toBe('account-b');
  });

  it('signIn_Failure_KeepsSignedOutWithFailedNotice', async () => {
    const { result, service } = await setup(null);
    service.nextSignIn(() => ({ kind: 'failed' }));

    await act(async () => result.current.signIn());

    expect(result.current.notice).toBe('failed');
    expect(result.current.status).toBe('signedOut');
  });
});
