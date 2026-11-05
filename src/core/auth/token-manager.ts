// Gestor de tokens: restaura la sesión, entrega un access token vigente y lo refresca cuando hace falta.
// Las dependencias (almacenamiento, refresco, reloj) se inyectan para probar la lógica sin teléfono ni Auth0.
import { needsRefresh, parseStoredSession, type StoredSession } from './session';

/** El refresh token ya no sirve (revocado, rotado o vencido): hay que volver a iniciar sesión. */
export class SessionExpiredError extends Error {
  override name = 'SessionExpiredError';
}

export interface TokenStorage {
  load(): Promise<string | null>;
  save(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface TokenManagerDependencies {
  storage: TokenStorage;
  /** Pide tokens nuevos a Auth0. Debe lanzar SessionExpiredError si Auth0 rechaza el refresh token. */
  refresh: (session: StoredSession) => Promise<StoredSession>;
  now: () => number;
  /** Se llama cuando la sesión venció de forma definitiva (para volver a la pantalla de bienvenida). */
  onExpired: () => void;
}

export interface TokenManager {
  restore(): Promise<StoredSession | null>;
  setSession(session: StoredSession): Promise<void>;
  /** Sesión en memoria (para revocar el refresh token al cerrar sesión). */
  getSession(): StoredSession | null;
  getAccessToken(): Promise<string | null>;
  clear(): Promise<void>;
}

export function createTokenManager(deps: TokenManagerDependencies): TokenManager {
  let current: StoredSession | null = null;
  // Refresco en curso compartido: diez peticiones a la vez provocan un solo refresco. Con rotación de refresh
  // tokens, dos refrescos paralelos con el mismo token harían que Auth0 detecte "reutilización" y revoque todo.
  let refreshing: Promise<StoredSession | null> | null = null;

  async function persist(session: StoredSession): Promise<void> {
    current = session;
    await deps.storage.save(JSON.stringify(session));
  }

  async function expire(): Promise<void> {
    current = null;
    await deps.storage.clear();
    deps.onExpired();
  }

  async function refreshOnce(session: StoredSession): Promise<StoredSession | null> {
    if (!session.refreshToken) {
      await expire();
      return null;
    }
    try {
      const next = await deps.refresh(session);
      await persist(next);
      return next;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await expire();
        return null;
      }
      // Sin red u otro fallo temporal: la sesión se conserva y la petición falla como error de red.
      throw error;
    }
  }

  return {
    async restore() {
      const stored = parseStoredSession(await deps.storage.load());
      if (!stored) {
        // Valor ausente o dañado: se borra para no volver a leerlo en cada arranque.
        await deps.storage.clear();
        current = null;
        return null;
      }
      current = stored;
      return stored;
    },

    async setSession(session) {
      await persist(session);
    },

    getSession() {
      return current;
    },

    async getAccessToken() {
      const session = current;
      if (!session) {
        return null;
      }
      if (!needsRefresh(session, deps.now())) {
        return session.accessToken;
      }
      refreshing ??= refreshOnce(session).finally(() => {
        refreshing = null;
      });
      const refreshed = await refreshing;
      return refreshed?.accessToken ?? null;
    },

    async clear() {
      current = null;
      refreshing = null;
      await deps.storage.clear();
    },
  };
}
