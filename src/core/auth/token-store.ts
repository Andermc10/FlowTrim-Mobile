// Almacenamiento de la sesión en expo-secure-store: en Android cifra con una llave del Android Keystore.
// Los tokens viven SOLO aquí: nunca en AsyncStorage, logs, URLs ni el caché de datos (spec §13, MASVS-STORAGE).
import * as SecureStore from 'expo-secure-store';

import type { TokenStorage } from './token-manager';

const SESSION_KEY = 'flowtrim.session';

const options: SecureStore.SecureStoreOptions = {
  // iOS: solo con el teléfono desbloqueado y sin pasar a copias de seguridad de otro dispositivo.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureTokenStorage: TokenStorage = {
  load: () => SecureStore.getItemAsync(SESSION_KEY, options),
  save: (value) => SecureStore.setItemAsync(SESSION_KEY, value, options),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY, options),
};
