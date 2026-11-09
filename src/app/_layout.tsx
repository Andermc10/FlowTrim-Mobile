// Layout raíz: proveedores de toda la app y navegación protegida por sesión.
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiProvider } from '@/core/api/api-provider';
import { createQueryClient } from '@/core/api/query-client';
import { useRefetchOnAppFocus } from '@/core/api/query-focus';
import { AuthProvider, useAuth } from '@/core/auth/auth-provider';
import { createAuthService } from '@/core/auth/auth-service';
import { secureTokenStorage } from '@/core/auth/token-store';
import { AppConfigError, getAppConfig, type AppConfig } from '@/core/config/app-config';
import { I18nProvider, useI18n } from '@/core/i18n/i18n';
import type { Language } from '@/core/i18n/translations';
import { AppLockProvider, useAppLock } from '@/core/lock/app-lock';
import { nativeLockDevice } from '@/core/lock/lock-device';
import { loadPreferences, savePreferences, type Preferences } from '@/core/preferences/preferences';
import { nativeReminderDevice } from '@/core/reminders/reminder-device';
import { RemindersProvider } from '@/core/reminders/reminders';
import { ThemeProvider, useTheme, type ThemePreference } from '@/core/theme/theme';
import { LockScreen } from '@/features/lock/lock-screen';
import { StatusScreen } from '@/shared/ui/status-screen';

// Ofrece el bloqueo una sola vez tras iniciar sesión (spec D9), con el diálogo nativo del sistema.
function useLockOffer() {
  const { t } = useI18n();
  const { offerPending, dismissOffer, setEnabled } = useAppLock();
  useEffect(() => {
    if (!offerPending) {
      return;
    }
    dismissOffer();
    Alert.alert(t('lock.offer.title'), t('lock.offer.message'), [
      { text: t('lock.offer.later'), style: 'cancel' },
      { text: t('lock.offer.enable'), onPress: () => void setEnabled(true) },
    ]);
  }, [offerPending, dismissOffer, setEnabled, t]);
}

function ProtectedStack() {
  const { scheme, colors } = useTheme();
  const { t } = useI18n();
  const { status } = useAuth();
  const { locked, enabled } = useAppLock();
  useLockOffer();

  if (status === 'restoring') {
    return <StatusScreen busy message={t('session.restoring')} />;
  }
  const signedIn = status === 'signedIn';

  return (
    <>
      {/* Iconos de la barra del sistema claros sobre fondo oscuro y viceversa. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      >
        {/* Con sesión: pestañas y ajustes. Sin sesión estas rutas no existen (ni siquiera por deep link). */}
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" options={{ headerShown: true, title: t('settings.title') }} />
          {/* Registro rápido: hoja modal que sube sobre las pestañas y se cierra al guardar (HU-86). */}
          <Stack.Screen
            name="quick-add"
            options={{ headerShown: true, presentation: 'modal', title: t('quickAdd.title') }}
          />
          {/* Marcar como pagado (HU-87): misma hoja modal, sobre la pestaña Pagos. */}
          <Stack.Screen
            name="mark-paid/[id]"
            options={{ headerShown: true, presentation: 'modal', title: t('markPaid.title') }}
          />
          {/* Aportar o retirar de una meta (HU-88). */}
          <Stack.Screen
            name="goal-contribution/[id]"
            options={{ headerShown: true, presentation: 'modal', title: t('plan.contribution.title') }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Screen name="callback" />
      </Stack>
      {/* Con sesión nada de lo de atrás se ve: mientras se lee el ajuste, una cubierta neutra (sin pedir huella,
          porque el ajuste aún podría decir "bloqueado" y anular un desbloqueo temprano); si está bloqueada, el bloqueo. */}
      {signedIn && enabled === null ? <StatusScreen cover busy message={t('session.restoring')} /> : null}
      {signedIn && enabled !== null && locked ? <LockScreen /> : null}
    </>
  );
}

type ConfigResult = { config: AppConfig } | { error: string };

// Configuración inválida = build mal hecho: se muestra qué variable falta (nunca su valor) en lugar de cerrarse.
function readConfig(): ConfigResult {
  try {
    return { config: getAppConfig() };
  } catch (error) {
    if (error instanceof AppConfigError) {
      return { error: error.message };
    }
    throw error;
  }
}

function SessionRoot({ config }: { config: AppConfig }) {
  // El servicio de Auth0 se crea una sola vez con la configuración ya validada.
  const [service] = useState(() => createAuthService(config));
  return (
    <AuthProvider service={service} storage={secureTokenStorage}>
      <AppLockProvider device={nativeLockDevice}>
        <ApiProvider baseUrl={config.apiUrl}>
          <RemindersProvider device={nativeReminderDevice}>
            <ProtectedStack />
          </RemindersProvider>
        </ApiProvider>
      </AppLockProvider>
    </AuthProvider>
  );
}

function ConfiguredApp() {
  const { t } = useI18n();
  const [result] = useState(readConfig);
  if ('error' in result) {
    return <StatusScreen title={t('config.title')} message={`${result.error}\n${t('config.hint')}`} />;
  }
  return <SessionRoot config={result.config} />;
}

// Lee idioma y tema guardados ANTES de pintar (evita un parpadeo de tema) y guarda cada cambio.
function PreferencesGate({
  children,
}: {
  children: (preferences: Preferences, update: (patch: Partial<Preferences>) => void) => ReactNode;
}) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  useEffect(() => {
    let active = true;
    void loadPreferences().then((loaded) => {
      if (active) setPreferences(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  // Guardar en un efecto (no dentro del setState) mantiene las actualizaciones de estado puras.
  useEffect(() => {
    if (preferences) {
      void savePreferences(preferences);
    }
  }, [preferences]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => (current ? { ...current, ...patch } : current));
  }, []);

  // Lectura local de milisegundos: mientras tanto, nada (no hay datos que mostrar todavía).
  return preferences ? children(preferences, update) : null;
}

export default function RootLayout() {
  // Un solo caché para toda la app; useState garantiza que no se recree en cada render.
  const [queryClient] = useState(createQueryClient);
  // Al volver al primer plano se recargan los datos vencidos (Today, movimientos…).
  useRefetchOnAppFocus();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PreferencesGate>
          {(preferences, update) => (
            <ThemeProvider
              initialPreference={preferences.theme}
              onPreferenceChange={(theme: ThemePreference) => update({ theme })}
            >
              <I18nProvider
                initialLanguage={preferences.language}
                onLanguageChange={(language: Language) => update({ language })}
              >
                <ConfiguredApp />
              </I18nProvider>
            </ThemeProvider>
          )}
        </PreferencesGate>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
