// Dobles de prueba compartidos: almacenamiento en memoria y un "Auth0" falso controlado por cada prueba.
import type { AuthService, SignInResult } from '@/core/auth/auth-service';
import type { StoredSession } from '@/core/auth/session';
import type { TokenStorage } from '@/core/auth/token-manager';

export const validSession = (): StoredSession => ({
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: Date.now() + 3_600_000,
});

export function createMemoryStorage(initial: StoredSession | null = null) {
  let value: string | null = initial ? JSON.stringify(initial) : null;
  const storage: TokenStorage & {
    current: () => string | null;
    set: (session: StoredSession | null) => void;
  } = {
    load: jest.fn(async () => value),
    save: jest.fn(async (next: string) => {
      value = next;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    current: () => value,
    set: (session) => {
      value = session ? JSON.stringify(session) : null;
    },
  };
  return storage;
}

export function createFakeAuthService(signInResult: () => SignInResult = () => ({ kind: 'cancelled' })) {
  const service: AuthService & { nextSignIn: (result: () => SignInResult) => void } = {
    signIn: jest.fn(async () => signInResult()),
    refresh: jest.fn(async () => validSession()),
    endSession: jest.fn(async () => undefined),
    nextSignIn: (result) => {
      signInResult = result;
    },
  };
  return service;
}
