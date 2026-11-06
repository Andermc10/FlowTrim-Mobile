// Preferencias del dispositivo (idioma y tema). No son datos sensibles: viven en AsyncStorage, sin cifrar.
// Nunca se guarda aquí nada financiero ni de la sesión (eso va en SecureStore o en el caché de HU-90).
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '@/core/i18n/translations';
import type { ThemePreference } from '@/core/theme/theme';

export interface Preferences {
  /** Sin valor: se usa el idioma del teléfono. */
  language?: Language;
  theme: ThemePreference;
}

const KEY = 'flowtrim.preferences';
export const DEFAULT_PREFERENCES: Preferences = { theme: 'system' };

// Regla pura: cualquier valor desconocido o dañado vuelve al predeterminado, campo por campo.
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const language = value.language === 'en' || value.language === 'es' ? value.language : undefined;
    const theme =
      value.theme === 'light' || value.theme === 'dark' || value.theme === 'system' ? value.theme : 'system';
    return { language, theme };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    return parsePreferences(await AsyncStorage.getItem(KEY));
  } catch {
    // Almacenamiento no disponible: la app arranca con los valores por defecto.
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // No guardar una preferencia no debe interrumpir al usuario: se reintenta en el próximo cambio.
  }
}
