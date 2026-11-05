// Sesión local: los tokens que devuelve Auth0 y cuándo vencen. Funciones puras, sin módulos nativos.

export interface StoredSession {
  accessToken: string;
  /** Solo existe si Auth0 concedió offline_access (rotación de refresh tokens, spec D8). */
  refreshToken?: string;
  /** Momento de vencimiento del access token, en milisegundos desde 1970 (UTC). */
  expiresAt: number;
}

/** Se refresca un minuto antes de vencer: una petición lenta no debe llegar con un token ya vencido. */
export const REFRESH_MARGIN_MS = 60_000;

export interface TokenResponseLike {
  accessToken: string;
  refreshToken?: string;
  /** Segundos de vida del token. */
  expiresIn?: number;
  /** Momento de emisión, en segundos. */
  issuedAt?: number;
}

export function sessionFromTokenResponse(
  response: TokenResponseLike,
  nowMs: number,
  previousRefreshToken?: string,
): StoredSession {
  const issuedAtMs = response.issuedAt ? response.issuedAt * 1000 : nowMs;
  return {
    accessToken: response.accessToken,
    // Con rotación, Auth0 entrega un refresh token nuevo; si una respuesta no lo trae, se conserva el anterior.
    refreshToken: response.refreshToken ?? previousRefreshToken,
    // Sin expiresIn se asume vencido: es más seguro pedir uno nuevo que usar un token de vida desconocida.
    expiresAt: issuedAtMs + (response.expiresIn ?? 0) * 1000,
  };
}

export function needsRefresh(session: StoredSession, nowMs: number): boolean {
  return nowMs >= session.expiresAt - REFRESH_MARGIN_MS;
}

// Lee lo guardado en SecureStore. Un valor dañado o de otra versión se descarta (null) en lugar de romper la app.
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const { accessToken, refreshToken, expiresAt } = value as Record<string, unknown>;
    if (typeof accessToken !== 'string' || accessToken.length === 0 || typeof expiresAt !== 'number') {
      return null;
    }
    if (refreshToken !== undefined && typeof refreshToken !== 'string') {
      return null;
    }
    return { accessToken, refreshToken, expiresAt };
  } catch {
    return null;
  }
}
