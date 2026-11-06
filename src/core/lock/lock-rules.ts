// Reglas puras del bloqueo de la app (spec EP-17 D9). Sin módulos nativos: se prueban con números.

/** Tiempo en segundo plano tras el cual se vuelve a pedir huella o PIN (fijo, decisión del 2026-11-03). */
export const LOCK_AFTER_MS = 60_000;

// Al volver al primer plano: bloquear solo si está activo y la app estuvo fuera MÁS de 60 s.
export function shouldLockOnResume(enabled: boolean, backgroundedAt: number | null, now: number): boolean {
  if (!enabled || backgroundedAt === null) {
    return false;
  }
  return now - backgroundedAt > LOCK_AFTER_MS;
}

// Nivel que informa expo-local-authentication (SecurityLevel): 0 = nada configurado, 1 = PIN/patrón, 2-3 = biometría.
export type LockAvailability = 'available' | 'notEnrolled';

export function lockAvailability(enrolledLevel: number): LockAvailability {
  // Con PIN o patrón ya alcanza: si la huella falla, el sistema ofrece el PIN (nadie queda fuera de su app).
  return enrolledLevel > 0 ? 'available' : 'notEnrolled';
}
