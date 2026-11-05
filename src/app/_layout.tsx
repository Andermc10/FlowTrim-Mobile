// Layout raíz: envuelve toda la app con los proveedores y define la navegación principal.
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@/core/api/query-client';
import { I18nProvider } from '@/core/i18n/i18n';
import { ThemeProvider, useTheme } from '@/core/theme/theme';

function ThemedStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      {/* Iconos de la barra del sistema claros sobre fondo oscuro y viceversa. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Un solo caché para toda la app; useState garantiza que no se recree en cada render.
  const [queryClient] = useState(createQueryClient);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <ThemedStack />
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
