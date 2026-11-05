// Bienvenida sin sesión: explica la app, abre el inicio de sesión y muestra por qué se volvió aquí.
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth, type AuthNotice } from '@/core/auth/auth-provider';
import { useI18n } from '@/core/i18n/i18n';
import type { TranslationKey } from '@/core/i18n/translations';
import { useTheme } from '@/core/theme/theme';
import { Button } from '@/shared/ui/button';

const noticeKeys: Record<Exclude<AuthNotice, null>, TranslationKey> = {
  expired: 'welcome.notice.expired',
  cancelled: 'welcome.notice.cancelled',
  failed: 'welcome.notice.failed',
};

export function WelcomeScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const { t } = useI18n();
  const { signIn, signingIn, notice } = useAuth();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { padding: spacing.xl, gap: spacing.lg }]}>
        <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
          {t('welcome.title')}
        </Text>
        <Text style={[typography.body, { color: colors.muted }]}>{t('welcome.subtitle')}</Text>

        {notice ? (
          // accessibilityLiveRegion: TalkBack lee el aviso apenas aparece.
          <Text
            accessibilityLiveRegion="polite"
            style={[
              typography.body,
              {
                color: notice === 'cancelled' ? colors.text : colors.danger,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
              },
            ]}
          >
            {t(noticeKeys[notice])}
          </Text>
        ) : null}

        <Button
          label={signingIn ? t('welcome.signingIn') : t('welcome.signIn')}
          loading={signingIn}
          onPress={() => void signIn()}
        />
        <Text style={[typography.caption, { color: colors.muted }]}>{t('welcome.privacy')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
});
