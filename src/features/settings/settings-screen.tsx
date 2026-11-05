// Ajustes (versión mínima de HU-83: cerrar sesión). HU-84 agrega idioma, tema, bloqueo y recordatorios.
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Button } from '@/shared/ui/button';

export function SettingsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useI18n();
  const { signOut } = useAuth();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }]}
    >
      <Button
        label={t('settings.signOut')}
        variant="secondary"
        accessibilityHint={t('settings.signOutHint')}
        onPress={signOut}
      />
      <Text style={[typography.caption, { color: colors.muted }]}>{t('settings.signOutHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
