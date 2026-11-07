// Error de carga de una pantalla: mensaje traducido, referencia para soporte (si la hay) y reintentar.
import { StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/core/api/error-message';
import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';

import { Button } from './button';

export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t } = useI18n();
  const message = errorMessage(error);

  return (
    // accessibilityLiveRegion: TalkBack lee el error en cuanto aparece.
    <View
      style={[styles.container, { padding: spacing.xl, gap: spacing.md }]}
      accessibilityLiveRegion="polite"
    >
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[typography.body, styles.center, { color: colors.muted }]}>
        {t(message.key, message.params)}
      </Text>
      {message.reference ? (
        <Text selectable style={[typography.caption, { color: colors.muted }]}>
          {t('errors.reference', { id: message.reference })}
        </Text>
      ) : null}
      <Button label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
