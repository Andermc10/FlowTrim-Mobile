// Diálogo con Auth0 (OAuth 2.0 para apps nativas, RFC 8252): navegador del sistema, PKCE S256, sin client secret.
import {
  AuthRequest,
  exchangeCodeAsync,
  fetchDiscoveryAsync,
  makeRedirectUri,
  refreshAsync,
  revokeAsync,
  TokenError,
  type DiscoveryDocument,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import type { AppConfig } from '@/core/config/app-config';

import { sessionFromTokenResponse, type StoredSession } from './session';
import { SessionExpiredError } from './token-manager';

// Alcances mínimos: identidad (openid), correo para mostrar la cuenta en Settings y offline_access para el refresh token.
export const SCOPES = ['openid', 'email', 'offline_access'];

// El mismo destino para volver del login y del logout; la ruta src/app/callback.tsx lo redirige al inicio.
export const REDIRECT_URI = makeRedirectUri({ scheme: 'flowtrim', path: 'callback' });

export type SignInResult =
  { kind: 'success'; session: StoredSession } | { kind: 'cancelled' } | { kind: 'failed' };

export interface AuthService {
  signIn(): Promise<SignInResult>;
  refresh(session: StoredSession): Promise<StoredSession>;
  /** Revoca el refresh token y cierra la sesión de Auth0 en el navegador. Mejor esfuerzo: nunca lanza. */
  endSession(session: StoredSession | null): Promise<void>;
}

export function createAuthService(config: AppConfig): AuthService {
  const issuer = `https://${config.auth0Domain}`;
  let discovery: Promise<DiscoveryDocument> | null = null;

  // El documento OIDC se pide una vez; si falla (sin red), se vuelve a intentar en la próxima acción.
  function getDiscovery(): Promise<DiscoveryDocument> {
    discovery ??= fetchDiscoveryAsync(issuer).catch((error: unknown) => {
      discovery = null;
      throw error;
    });
    return discovery;
  }

  return {
    async signIn() {
      let document: DiscoveryDocument;
      try {
        document = await getDiscovery();
      } catch {
        return { kind: 'failed' };
      }
      const request = new AuthRequest({
        clientId: config.auth0ClientId,
        redirectUri: REDIRECT_URI,
        scopes: SCOPES,
        // usePKCE y S256 son los valores por defecto; se declaran para que la decisión de seguridad sea visible.
        usePKCE: true,
        // audience: Auth0 emite un access token para la API de FlowTrim, no solo para su endpoint de userinfo.
        extraParams: { audience: config.auth0Audience },
      });
      // promptAsync abre Custom Tabs (navegador del sistema) y valida el parámetro state al volver.
      const result = await request.promptAsync(document);
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { kind: 'cancelled' };
      }
      if (result.type !== 'success' || !request.codeVerifier) {
        return { kind: 'failed' };
      }
      try {
        const tokens = await exchangeCodeAsync(
          {
            clientId: config.auth0ClientId,
            code: result.params.code ?? '',
            redirectUri: REDIRECT_URI,
            extraParams: { code_verifier: request.codeVerifier },
          },
          document,
        );
        return { kind: 'success', session: sessionFromTokenResponse(tokens, Date.now()) };
      } catch {
        return { kind: 'failed' };
      }
    },

    async refresh(session) {
      const document = await getDiscovery();
      try {
        const tokens = await refreshAsync(
          { clientId: config.auth0ClientId, refreshToken: session.refreshToken, scopes: SCOPES },
          document,
        );
        return sessionFromTokenResponse(tokens, Date.now(), session.refreshToken);
      } catch (error) {
        // Auth0 responde invalid_grant cuando el refresh token fue revocado, rotado o venció.
        if (error instanceof TokenError) {
          throw new SessionExpiredError(error.code);
        }
        throw error;
      }
    },

    async endSession(session) {
      try {
        const document = await getDiscovery();
        if (session?.refreshToken && document.revocationEndpoint) {
          await revokeAsync({ clientId: config.auth0ClientId, token: session.refreshToken }, document);
        }
      } catch {
        // Sin red: el token local ya se borró; Auth0 lo invalidará al vencer o en la próxima rotación.
      }
      const logoutUrl =
        `${issuer}/v2/logout?client_id=${encodeURIComponent(config.auth0ClientId)}` +
        `&returnTo=${encodeURIComponent(REDIRECT_URI)}`;
      try {
        // Sin esto, la cookie de Auth0 en el navegador volvería a entrar con la misma cuenta sin pedir datos.
        await WebBrowser.openAuthSessionAsync(logoutUrl, REDIRECT_URI);
      } catch {
        // Si el navegador no abre, la sesión local ya está cerrada; no se bloquea al usuario.
      }
    },
  };
}
