// Proveedor de sesión: restaura la sesión al abrir la app, inicia y cierra sesión y entrega tokens vigentes.
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { AuthService } from './auth-service';
import { createTokenManager, type TokenManager, type TokenStorage } from './token-manager';

export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

/** Motivo a mostrar en la bienvenida tras volver a ella. */
export type AuthNotice = 'expired' | 'cancelled' | 'failed' | null;

interface Auth {
  status: AuthStatus;
  notice: AuthNotice;
  /** Correo de la cuenta (del id_token), solo para mostrarlo. */
  email: string | undefined;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  getAccessToken: () => Promise<string | null>;
  /** Para el cliente API ante un 401: la sesión ya no vale. */
  expireSession: () => void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({
  children,
  service,
  storage,
}: {
  children: ReactNode;
  service: AuthService;
  storage: TokenStorage;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<AuthNotice>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Al cerrar o perder la sesión no debe quedar nada del usuario anterior en memoria (aislamiento, AC-1).
  const resetLocalData = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  // Un único gestor de tokens durante toda la vida de la app: useState con inicializador corre una sola vez.
  // Su callback de vencimiento solo usa valores estables (queryClient y los setters de estado).
  const [manager] = useState<TokenManager>(() =>
    createTokenManager({
      storage,
      refresh: (session) => service.refresh(session),
      now: () => Date.now(),
      onExpired: () => {
        queryClient.clear();
        setEmail(undefined);
        setNotice('expired');
        setStatus('signedOut');
      },
    }),
  );

  useEffect(() => {
    let active = true;
    manager
      .restore()
      .catch(() => null)
      .then((session) => {
        if (active) {
          setEmail(session?.email);
          setStatus(session ? 'signedIn' : 'signedOut');
        }
      });
    return () => {
      active = false;
    };
  }, [manager]);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setNotice(null);
    try {
      const result = await service.signIn();
      if (result.kind === 'success') {
        // Por si quedaron datos de otra cuenta en memoria antes de entrar.
        resetLocalData();
        await manager.setSession(result.session);
        setEmail(result.session.email);
        setStatus('signedIn');
      } else {
        setNotice(result.kind);
      }
    } catch {
      setNotice('failed');
    } finally {
      setSigningIn(false);
    }
  }, [manager, resetLocalData, service]);

  // Spec FR-3: se borra todo y se muestra la bienvenida de inmediato; Auth0 se avisa después, sin esperar la red.
  const signOut = useCallback(() => {
    void (async () => {
      const session = manager.getSession();
      await manager.clear();
      resetLocalData();
      setEmail(undefined);
      setNotice(null);
      setStatus('signedOut');
      await service.endSession(session);
    })();
  }, [manager, resetLocalData, service]);

  // Ante un 401 de la API: se borra la sesión y se avisa "expiró" en la bienvenida.
  const expireSession = useCallback(() => {
    void manager.clear().then(() => {
      resetLocalData();
      setEmail(undefined);
      setNotice('expired');
      setStatus('signedOut');
    });
  }, [manager, resetLocalData]);

  // Estable: el cliente API la guarda una vez y siempre pide el token al mismo gestor.
  const getAccessToken = useCallback(() => manager.getAccessToken(), [manager]);

  const value = useMemo<Auth>(
    () => ({
      status,
      email,
      notice,
      signingIn,
      signIn,
      signOut,
      getAccessToken,
      expireSession,
    }),
    [status, email, notice, signingIn, signIn, signOut, getAccessToken, expireSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
