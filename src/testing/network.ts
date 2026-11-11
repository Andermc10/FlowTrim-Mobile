// Red simulada para las pruebas (HU-90): reemplaza NetInfo y permite cortar o devolver la conexión.
type Listener = (state: { isConnected: boolean; isInternetReachable: boolean }) => void;

const listeners = new Set<Listener>();
let state = { isConnected: true, isInternetReachable: true };

export const fakeNetInfoModule = {
  __esModule: true,
  default: {
    // Como NetInfo real: avisa el estado actual al suscribirse y devuelve la función para dejar de escuchar.
    addEventListener(listener: Listener) {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    fetch: async () => state,
  },
};

export function setNetworkConnected(connected: boolean) {
  state = { isConnected: connected, isInternetReachable: connected };
  listeners.forEach((listener) => listener(state));
}
