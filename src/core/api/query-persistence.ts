// Copia local de solo lectura (HU-90, spec D10): lo último cargado de Today, pagos, movimientos, presupuestos y metas
// se guarda en AsyncStorage (dentro del sandbox de la app) para verse sin red. Nada se escribe sin conexión.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';

export const PERSISTED_CACHE_KEY = 'flowtrim.query-cache';
/** La copia vale 7 días (FR-1): después se descarta en lugar de mostrar datos viejos como actuales. */
export const PERSISTED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Cambiarlo invalida las copias guardadas por versiones anteriores (forma distinta de los datos). */
export const PERSISTED_CACHE_BUSTER = 'mobile-v1';

// Prefijos de las consultas que D10 permite guardar. Cuentas y categorías no: solo sirven para escribir.
const PERSISTED_PREFIXES: readonly (readonly string[])[] = [
  ['dashboard', 'today'],
  ['subscriptions', 'upcoming'],
  ['subscriptions', 'all'],
  ['transactions', 'list'],
  ['budgets'],
  ['goals', 'list'],
];

/**
 * Regla pura: solo consultas de la lista, con datos correctos (nunca errores ni cargas a medias) y, de los movimientos,
 * solo el mes actual (D10). `currentMonth` es `yyyy-MM` en el calendario del producto.
 */
export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>, currentMonth: string): boolean {
  if (query.state.status !== 'success') {
    return false;
  }
  const key = query.queryKey;
  if (!PERSISTED_PREFIXES.some((prefix) => prefix.every((part, index) => key[index] === part))) {
    return false;
  }
  if (key[0] === 'transactions') {
    const filter = key[2] as { month?: unknown } | undefined;
    return filter?.month === currentMonth;
  }
  return true;
}

// Uno por caché (no global): el agrupado de escrituras guarda estado propio y no debe compartirse.
export function createQueryPersister() {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key: PERSISTED_CACHE_KEY,
    // Agrupa escrituras: una por segundo como máximo aunque lleguen muchas respuestas seguidas.
    throttleTime: 1000,
  });
}

/** Cerrar sesión o perderla borra la copia local (D10): la siguiente cuenta no ve nada de la anterior. */
export async function clearPersistedQueries(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PERSISTED_CACHE_KEY);
  } catch {
    // Sin efecto: la copia caduca sola a los 7 días y el caché en memoria ya se vació.
  }
}
