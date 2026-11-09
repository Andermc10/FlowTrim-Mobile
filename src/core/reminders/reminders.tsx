// Recordatorios locales de pagos (HU-89): ajuste opt-in, permiso, reprogramación y limpieza al cerrar sesión.
// Nunca se envía nada fuera del teléfono: son alarmas locales programadas por la app (spec D3).
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { components } from '@/core/api/schema';
import { useAuth } from '@/core/auth/auth-provider';
import { useI18n } from '@/core/i18n/i18n';

import { planReminders } from './plan-reminders';
import type { ReminderDevice } from './reminder-device';

type UpcomingCharge = components['schemas']['UpcomingChargeItem'];

interface Reminders {
  /** null mientras se lee el ajuste guardado. */
  enabled: boolean | null;
  /** El permiso del sistema está negado: el interruptor queda apagado y se explica cómo cambiarlo. */
  denied: boolean;
  /** Activar pide el permiso; devuelve false si el sistema lo niega. */
  setEnabled: (enabled: boolean) => Promise<boolean>;
  /** Reemplaza los recordatorios programados con los de estos próximos cobros (solo si están activos). */
  schedule: (upcoming: readonly UpcomingCharge[]) => Promise<void>;
  /** Ofrecerlos una sola vez, tras la primera carga de pagos. */
  offerPending: boolean;
  dismissOffer: () => void;
}

const RemindersContext = createContext<Reminders | null>(null);

// Zona del teléfono: los recordatorios siguen el reloj local (spec §9).
function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

export function RemindersProvider({ children, device }: { children: ReactNode; device: ReminderDevice }) {
  const { status } = useAuth();
  const { t, language } = useI18n();
  const signedIn = status === 'signedIn';
  const restoring = status === 'restoring';
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [offered, setOffered] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    device.prepare();
    // Tocar un recordatorio abre la pestaña Pagos (FR-3).
    return device.onOpen(() => router.navigate('/payments'));
  }, [device]);

  useEffect(() => {
    if (restoring) return;
    let active = true;
    void (async () => {
      if (!signedIn) {
        // FR-4: cerrar sesión cancela todo y la próxima cuenta empieza sin recordatorios (y se le ofrecen de nuevo).
        await device.cancelAll().catch(() => undefined);
        await device.saveEnabled(false).catch(() => undefined);
        await device.saveOffered(false).catch(() => undefined);
        if (!active) return;
        setEnabledState(false);
        setOffered(null);
        return;
      }
      let stored = await device.loadEnabled().catch(() => false);
      // Si el permiso se quitó en los ajustes del sistema, el interruptor lo refleja.
      if (stored && (await device.permission().catch(() => 'denied' as const)) === 'denied') {
        stored = false;
        await device.saveEnabled(false).catch(() => undefined);
        await device.cancelAll().catch(() => undefined);
      }
      const wasOffered = await device.loadOffered().catch(() => true);
      if (!active) return;
      setEnabledState(stored);
      setOffered(wasOffered);
    })();
    return () => {
      active = false;
    };
  }, [device, signedIn, restoring]);

  const setEnabled = useCallback(
    async (next: boolean) => {
      setDenied(false);
      if (!next) {
        await device.cancelAll().catch(() => undefined);
        await device.saveEnabled(false).catch(() => undefined);
        setEnabledState(false);
        return true;
      }
      let permission = await device.permission().catch(() => 'denied' as const);
      if (permission === 'denied') {
        permission = await device.requestPermission().catch(() => 'denied' as const);
      }
      if (permission === 'denied') {
        setDenied(true);
        return false;
      }
      await device.saveEnabled(true);
      setEnabledState(true);
      return true;
    },
    [device],
  );

  const schedule = useCallback(
    async (upcoming: readonly UpcomingCharge[]) => {
      if (enabled !== true) return;
      const reminders = planReminders(upcoming, new Date(), deviceTimeZone(), language);
      await device.replaceAll(reminders, t('reminders.channel')).catch(() => undefined);
    },
    [device, enabled, language, t],
  );

  const dismissOffer = useCallback(() => {
    setOffered(true);
    void device.saveOffered(true).catch(() => undefined);
  }, [device]);

  const value = useMemo<Reminders>(
    () => ({
      enabled,
      denied,
      setEnabled,
      schedule,
      offerPending: signedIn && enabled === false && offered === false,
      dismissOffer,
    }),
    [enabled, denied, setEnabled, schedule, signedIn, offered, dismissOffer],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): Reminders {
  const value = useContext(RemindersContext);
  if (!value) {
    throw new Error('useReminders must be used inside RemindersProvider');
  }
  return value;
}
