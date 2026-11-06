// Sesión local: los tokens que devuelve Auth0 y cuándo vencen. Funciones puras, sin módulos nativos.

export interface StoredSession {
  accessToken: string;
  /** Solo existe si Auth0 concedió offline_access (rotación de refresh tokens, spec D8). */
  refreshToken?: string;
  /** Momento de vencimiento del access token, en milisegundos desde 1970 (UTC). */
  expiresAt: number;
  /** Correo de la cuenta, solo para mostrarlo en Ajustes. */
  email?: string;
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
  idToken?: string;
}

// Lee el correo del id_token (JWT) sin verificar su firma. Es aceptable porque llega directo del token endpoint de
// Auth0 por HTTPS y SOLO se usa para mostrarlo: nunca decide permisos (eso lo valida la API con el access token).
export function emailFromIdToken(idToken: string | undefined): string | undefined {
  const payload = idToken?.split('.')[1];
  if (!payload) {
    return undefined;
  }
  try {
    // base64url → base64 estándar, con el relleno "=" que atob necesita.
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    // atob da bytes; cada byte pasa a %xx para que decodeURIComponent arme el texto UTF-8 (tildes, ñ).
    const utf8 = Array.from(
      atob(base64),
      (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
    ).join('');
    const claims: unknown = JSON.parse(decodeURIComponent(utf8));
    const email = (claims as Record<string, unknown>).email;
    return typeof email === 'string' && email.includes('@') ? email : undefined;
  } catch {
    return undefined;
  }
}

export function sessionFromTokenResponse(
  response: TokenResponseLike,
  nowMs: number,
  previous?: Pick<StoredSession, 'refreshToken' | 'email'>,
): StoredSession {
  const issuedAtMs = response.issuedAt ? response.issuedAt * 1000 : nowMs;
  return {
    accessToken: response.accessToken,
    // Con rotación, Auth0 entrega un refresh token nuevo; si una respuesta no lo trae, se conserva el anterior.
    refreshToken: response.refreshToken ?? previous?.refreshToken,
    email: emailFromIdToken(response.idToken) ?? previous?.email,
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
    const { accessToken, refreshToken, expiresAt, email } = value as Record<string, unknown>;
    if (typeof accessToken !== 'string' || accessToken.length === 0 || typeof expiresAt !== 'number') {
      return null;
    }
    if (refreshToken !== undefined && typeof refreshToken !== 'string') {
      return null;
    }
    return { accessToken, refreshToken, expiresAt, email: typeof email === 'string' ? email : undefined };
  } catch {
    return null;
  }
}
