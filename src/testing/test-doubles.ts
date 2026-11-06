// Dobles de prueba compartidos: almacenamiento en memoria y un "Auth0" falso controlado por cada prueba.
import type { AuthService, SignInResult } from '@/core/auth/auth-service';
import type { StoredSession } from '@/core/auth/session';
import type { TokenStorage } from '@/core/auth/token-manager';
import type { LockDevice } from '@/core/lock/lock-device';

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

export interface FakeLockOptions {
  /** 0 = nada configurado, 1 = PIN, 3 = huella. */
  level?: number;
  enabled?: boolean;
  offered?: boolean;
  authenticates?: boolean;
}

// Teléfono simulado para el bloqueo: qué tiene configurado, si la huella "funciona" y qué quedó guardado.
export function createFakeLockDevice(options: FakeLockOptions = {}) {
  const state = {
    level: options.level ?? 3,
    enabled: options.enabled ?? false,
    offered: options.offered ?? true,
    authenticates: options.authenticates ?? true,
  };
  const device: LockDevice & { state: typeof state } = {
    state,
    enrolledLevel: jest.fn(async () => state.level),
    authenticate: jest.fn(async () => state.authenticates),
    loadEnabled: jest.fn(async () => state.enabled),
    saveEnabled: jest.fn(async (enabled: boolean) => {
      state.enabled = enabled;
    }),
    loadOffered: jest.fn(async () => state.offered),
    saveOffered: jest.fn(async () => {
      state.offered = true;
    }),
    protectScreen: jest.fn(async () => undefined),
  };
  return device;
}
