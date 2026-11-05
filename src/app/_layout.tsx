// Layout raíz: proveedores de toda la app y navegación protegida por sesión.
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiProvider } from '@/core/api/api-provider';
import { createQueryClient } from '@/core/api/query-client';
import { AuthProvider, useAuth } from '@/core/auth/auth-provider';
import { createAuthService } from '@/core/auth/auth-service';
import { secureTokenStorage } from '@/core/auth/token-store';
import { AppConfigError, getAppConfig, type AppConfig } from '@/core/config/app-config';
import { I18nProvider, useI18n } from '@/core/i18n/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/theme';
import { StatusScreen } from '@/shared/ui/status-screen';

function ProtectedStack() {
  const { scheme, colors } = useTheme();
  const { t } = useI18n();
  const { status } = useAuth();

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
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Screen name="callback" />
      </Stack>
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
      <ApiProvider baseUrl={config.apiUrl}>
        <ProtectedStack />
      </ApiProvider>
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

export default function RootLayout() {
  // Un solo caché para toda la app; useState garantiza que no se recree en cada render.
  const [queryClient] = useState(createQueryClient);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <ConfiguredApp />
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
