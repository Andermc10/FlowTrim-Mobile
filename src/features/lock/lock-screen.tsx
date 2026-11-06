// Pantalla de bloqueo: cubre todo el contenido y pide huella/PIN apenas aparece.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/core/i18n/i18n';
import { useAppLock } from '@/core/lock/app-lock';
import { useTheme } from '@/core/theme/theme';
import { Button } from '@/shared/ui/button';

export function LockScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useI18n();
  const { unlock } = useAppLock();

  // Se abre el diálogo del sistema solo al aparecer; si el usuario lo cancela, queda el botón para reintentar.
  useEffect(() => {
    void unlock();
  }, [unlock]);

  return (
    <View
      // Ocupa toda la pantalla por encima de la navegación: no deja ver ni tocar nada detrás.
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: colors.background, padding: spacing.xl, gap: spacing.lg },
      ]}
      accessibilityViewIsModal
    >
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {t('lock.title')}
      </Text>
      <Text style={[typography.body, styles.text, { color: colors.muted }]}>{t('lock.message')}</Text>
      <Button label={t('lock.unlock')} onPress={() => void unlock()} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center' },
});
