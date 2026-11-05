// Pantalla provisional de cada pestaña hasta que llegue su historia (HU-85..HU-88).
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/core/theme/theme';

export function PlaceholderScreen({ title, message }: { title: string; message: string }) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl }]}>
      {/* accessibilityRole="header": TalkBack lo anuncia como título y permite saltar entre títulos. */}
      <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: colors.muted, marginTop: spacing.sm }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
