// Tarjeta base (superficie con borde) con título opcional; la usan Today, Ajustes y las demás pantallas.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/core/theme/theme';

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      {title ? (
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
