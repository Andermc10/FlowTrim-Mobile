// Layout raíz: envuelve toda la app con los proveedores y define la navegación principal.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <ThemedStack />
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
