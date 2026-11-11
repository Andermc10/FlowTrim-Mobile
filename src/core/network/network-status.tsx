// Estado de la red (HU-90): una sola fuente para la app y para TanStack Query.
// Conectar NetInfo al onlineManager hace que, sin red, las consultas se pausen (sin errores ni reintentos) y que al
// volver la conexión se recarguen solas (FR-3). Es el patrón documentado de TanStack Query para React Native.
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// "Sin conexión" solo cuando el sistema lo afirma: null (aún no se sabe) cuenta como conectado para no bloquear nada.
export function isOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

const NetworkContext = createContext<boolean>(true);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // setEventListener reemplaza el detector por defecto (eventos del navegador, que no existen en Android); TanStack
    // guarda la función que devuelve NetInfo y la usa para dejar de escuchar cuando cambia de detector.
    onlineManager.setEventListener((setQueriesOnline) =>
      NetInfo.addEventListener((state) => setQueriesOnline(isOnline(state))),
    );
    return NetInfo.addEventListener((state) => setOnline(isOnline(state)));
  }, []);

  return <NetworkContext.Provider value={online}>{children}</NetworkContext.Provider>;
}

/** true con red (o mientras no se sabe); false cuando el teléfono está sin conexión. */
export function useOnline(): boolean {
  return useContext(NetworkContext);
}
