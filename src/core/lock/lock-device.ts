// Acceso a lo nativo del bloqueo: huella/PIN, ajuste guardado y protección de pantalla.
// Se agrupa aquí para que el proveedor dependa de una interfaz y las pruebas lo reemplacen sin teléfono.
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import * as SecureStore from 'expo-secure-store';

const ENABLED_KEY = 'flowtrim.lock-enabled';
const OFFERED_KEY = 'flowtrim.lock-offered';
const SCREEN_CAPTURE_KEY = 'app-lock';

export interface LockDevice {
  /** Nivel de seguridad configurado en el teléfono (0 = nada, 1 = PIN/patrón, 2-3 = biometría). */
  enrolledLevel(): Promise<number>;
  /** Muestra el diálogo del sistema; true solo si el usuario se autenticó. */
  authenticate(promptMessage: string, cancelLabel: string): Promise<boolean>;
  loadEnabled(): Promise<boolean>;
  saveEnabled(enabled: boolean): Promise<void>;
  /** Si ya se ofreció activar el bloqueo tras el primer inicio de sesión. */
  loadOffered(): Promise<boolean>;
  saveOffered(): Promise<void>;
  /** Android FLAG_SECURE: vista en blanco en "apps recientes" y sin capturas mientras el bloqueo está activo. */
  protectScreen(protect: boolean): Promise<void>;
}

export const nativeLockDevice: LockDevice = {
  enrolledLevel: () => LocalAuthentication.getEnrolledLevelAsync(),
  async authenticate(promptMessage, cancelLabel) {
    // disableDeviceFallback: false → si la huella falla, el sistema ofrece el PIN del teléfono.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: false,
    });
    return result.success;
  },
  async loadEnabled() {
    return (await SecureStore.getItemAsync(ENABLED_KEY)) === 'true';
  },
  async saveEnabled(enabled) {
    if (enabled) {
      await SecureStore.setItemAsync(ENABLED_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(ENABLED_KEY);
    }
  },
  async loadOffered() {
    return (await SecureStore.getItemAsync(OFFERED_KEY)) === 'true';
  },
  async saveOffered() {
    await SecureStore.setItemAsync(OFFERED_KEY, 'true');
  },
  async protectScreen(protect) {
    if (protect) {
      await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY);
    } else {
      await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY);
    }
  },
};
