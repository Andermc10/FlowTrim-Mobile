// Acceso a lo nativo de los recordatorios: permiso, programación local y ajuste guardado (HU-89).
// Como el bloqueo (lock-device), el proveedor depende de esta interfaz y las pruebas la reemplazan sin teléfono.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
// Enums con nombre: el lint de imports no sigue los `export *` del paquete en el espacio de nombres.
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder } from './plan-reminders';

const ENABLED_KEY = 'flowtrim.reminders.enabled';
const OFFERED_KEY = 'flowtrim.reminders.offered';
const CHANNEL_ID = 'payment-reminders';

export type ReminderPermission = 'granted' | 'denied';

export interface ReminderDevice {
  /** Con la app abierta a las 09:00 el aviso también se muestra (por defecto Android lo descartaría). */
  prepare(): void;
  permission(): Promise<ReminderPermission>;
  /** Pide el permiso (Android 13+ POST_NOTIFICATIONS); solo se llama cuando el usuario activa los recordatorios. */
  requestPermission(): Promise<ReminderPermission>;
  /** Cancela todo lo programado y programa estos (spec FR-2: reemplazar, nunca acumular). */
  replaceAll(reminders: readonly Reminder[], channelName: string): Promise<void>;
  cancelAll(): Promise<void>;
  loadEnabled(): Promise<boolean>;
  saveEnabled(enabled: boolean): Promise<void>;
  loadOffered(): Promise<boolean>;
  saveOffered(offered: boolean): Promise<void>;
  /** Avisa cuando el usuario toca un recordatorio; devuelve la función para dejar de escuchar. */
  onOpen(listener: (subscriptionId: string | null) => void): () => void;
}

function toPermission(status: Notifications.NotificationPermissionsStatus): ReminderPermission {
  return status.granted ? 'granted' : 'denied';
}

// Canal PRIVADO: Android muestra en la pantalla de bloqueo solo que hay una notificación, nunca el importe (FR-3).
async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
}

export const nativeReminderDevice: ReminderDevice = {
  prepare() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  },
  permission: async () => toPermission(await Notifications.getPermissionsAsync()),
  requestPermission: async () => toPermission(await Notifications.requestPermissionsAsync()),
  async replaceAll(reminders, channelName) {
    await ensureChannel(channelName);
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          // Solo el id del pago (no sensible) para abrir la pestaña Pagos al tocar.
          data: { subscriptionId: reminder.subscriptionId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.at,
          channelId: CHANNEL_ID,
        },
      });
    }
  },
  cancelAll: () => Notifications.cancelAllScheduledNotificationsAsync(),
  async loadEnabled() {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  },
  async saveEnabled(enabled) {
    await (enabled ? AsyncStorage.setItem(ENABLED_KEY, 'true') : AsyncStorage.removeItem(ENABLED_KEY));
  },
  async loadOffered() {
    return (await AsyncStorage.getItem(OFFERED_KEY)) === 'true';
  },
  async saveOffered(offered) {
    await (offered ? AsyncStorage.setItem(OFFERED_KEY, 'true') : AsyncStorage.removeItem(OFFERED_KEY));
  },
  onOpen(listener) {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.content.data?.subscriptionId;
      listener(typeof id === 'string' ? id : null);
    });
    return () => subscription.remove();
  },
};
