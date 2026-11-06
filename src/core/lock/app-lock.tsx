// Bloqueo de la app (HU-84, spec D9): pide huella o PIN al abrir y al volver tras más de 60 s fuera.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { useI18n } from '@/core/i18n/i18n';

import type { LockDevice } from './lock-device';
import { lockAvailability, shouldLockOnResume, type LockAvailability } from './lock-rules';

interface AppLock {
  /** null mientras se lee el ajuste guardado. */
  enabled: boolean | null;
  locked: boolean;
  availability: LockAvailability | null;
  unlock: () => Promise<void>;
  /** Activar exige autenticarse antes: así nadie activa un bloqueo que luego no puede abrir. */
  setEnabled: (enabled: boolean) => Promise<boolean>;
  /** Ofrecer el bloqueo una sola vez tras el primer inicio de sesión. */
  offerPending: boolean;
  dismissOffer: () => void;
}

const AppLockContext = createContext<AppLock | null>(null);

export function AppLockProvider({ children, device }: { children: ReactNode; device: LockDevice }) {
  const { status } = useAuth();
  const { t } = useI18n();
  const signedIn = status === 'signedIn';
  // Mientras se restaura la sesión no se sabe si hay usuario: no se toca el ajuste (borrarlo aquí lo perdería).
  const restoring = status === 'restoring';

  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [availability, setAvailability] = useState<LockAvailability | null>(null);
  const [offerPending, setOfferPending] = useState(false);

  // Arranque y cambio de sesión: con sesión se lee el ajuste (y se bloquea si está activo); sin sesión se borra.
  useEffect(() => {
    if (restoring) {
      return;
    }
    let active = true;
    void (async () => {
      const level = await device.enrolledLevel().catch(() => 0);
      if (!active) return;
      setAvailability(lockAvailability(level));
      if (!signedIn) {
        // Cerrar sesión borra el ajuste: la próxima cuenta empieza sin bloqueo.
        await device.saveEnabled(false).catch(() => undefined);
        if (!active) return;
        setEnabledState(false);
        setLocked(false);
        return;
      }
      const stored = await device.loadEnabled().catch(() => false);
      const offered = await device.loadOffered().catch(() => true);
      if (!active) return;
      setEnabledState(stored);
      // Arranque en frío con bloqueo activo: se pide autenticación antes de mostrar datos.
      setLocked(stored);
      setOfferPending(!stored && !offered && lockAvailability(level) === 'available');
    })();
    return () => {
      active = false;
    };
  }, [device, signedIn, restoring]);

  // La protección de pantalla acompaña al ajuste: activa solo con sesión y bloqueo encendido.
  useEffect(() => {
    void device.protectScreen(signedIn && enabled === true).catch(() => undefined);
  }, [device, signedIn, enabled]);

  // Segundo plano → se anota la hora; al volver se decide con la regla pura de 60 s.
  useEffect(() => {
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
      } else if (state === 'active') {
        if (shouldLockOnResume(signedIn && enabled === true, backgroundedAt, Date.now())) {
          setLocked(true);
        }
        backgroundedAt = null;
      }
    });
    return () => subscription.remove();
  }, [signedIn, enabled]);

  const unlock = useCallback(async () => {
    const ok = await device.authenticate(t('lock.prompt'), t('lock.cancel')).catch(() => false);
    if (ok) {
      setLocked(false);
    }
  }, [device, t]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      if (next) {
        const ok = await device.authenticate(t('lock.enablePrompt'), t('lock.cancel')).catch(() => false);
        if (!ok) {
          return false;
        }
      }
      await device.saveEnabled(next);
      setEnabledState(next);
      return true;
    },
    [device, t],
  );

  const dismissOffer = useCallback(() => {
    setOfferPending(false);
    void device.saveOffered().catch(() => undefined);
  }, [device]);

  const value = useMemo<AppLock>(
    () => ({ enabled, locked, availability, unlock, setEnabled, offerPending, dismissOffer }),
    [enabled, locked, availability, unlock, setEnabled, offerPending, dismissOffer],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLock {
  const value = useContext(AppLockContext);
  if (!value) {
    throw new Error('useAppLock must be used inside AppLockProvider');
  }
  return value;
}
