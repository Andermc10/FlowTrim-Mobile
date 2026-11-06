// Pantalla de estado a pantalla completa: carga de sesión o error de configuración.
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/theme';

export function StatusScreen({
  title,
  message,
  busy,
  cover,
}: {
  title?: string;
  message: string;
  busy?: boolean;
  /** Se dibuja encima de todo (oculta el contenido de atrás), como la pantalla de bloqueo. */
  cover?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={[
        cover ? StyleSheet.absoluteFill : null,
        styles.container,
        { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md },
      ]}
      accessibilityLiveRegion="polite"
    >
      {busy ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      {title ? (
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {title}
        </Text>
      ) : null}
      <Text style={[typography.body, styles.center, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
