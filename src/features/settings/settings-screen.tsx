// Ajustes (HU-84): cuenta, idioma, tema, bloqueo, versión, privacidad y cerrar sesión.
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { useI18n } from '@/core/i18n/i18n';
import type { Language } from '@/core/i18n/translations';
import { useAppLock } from '@/core/lock/app-lock';
import { useTheme, type ThemePreference } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';
import { Button } from '@/shared/ui/button';
import { ChoiceGroup } from '@/shared/ui/choice-group';

export const PRIVACY_URL = 'https://github.com/Andermc10/FlowTrim-Mobile#security-and-privacy';

// Cada idioma se nombra en su propio idioma: quien no entiende el actual reconoce el suyo.
const languageChoices = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const satisfies readonly { value: Language; label: string }[];

function Section({ title, children }: { title: string; children: ReactNode }) {
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
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const { colors, spacing, typography } = theme;
  const { t, language, setLanguage } = useI18n();
  const { signOut, email } = useAuth();
  const lock = useAppLock();
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const lockUnavailable = lock.availability === 'notEnrolled';
  const version = Constants.expoConfig?.version ?? '—';

  const themeChoices: readonly { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];

  async function toggleLock(next: boolean) {
    setLockMessage(null);
    const changed = await lock.setEnabled(next);
    if (!changed) {
      setLockMessage(t('settings.lockNotEnabled'));
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Section title={t('settings.account')}>
        <Text style={[typography.body, { color: colors.text }]}>
          {email ? t('settings.signedInAs', { email }) : t('settings.signedIn')}
        </Text>
        <Button
          label={t('settings.signOut')}
          variant="secondary"
          accessibilityHint={t('settings.signOutHint')}
          onPress={signOut}
        />
        <Text style={[typography.caption, { color: colors.muted }]}>{t('settings.signOutHint')}</Text>
      </Section>

      <Section title={t('settings.preferences')}>
        <ChoiceGroup
          label={t('settings.language')}
          choices={languageChoices}
          selected={language}
          onSelect={setLanguage}
        />
        <ChoiceGroup
          label={t('settings.theme')}
          choices={themeChoices}
          selected={theme.preference}
          onSelect={theme.setPreference}
        />
      </Section>

      <Section title={t('settings.security')}>
        <View style={[styles.switchRow, { gap: spacing.md }]}>
          <Text style={[typography.body, styles.switchLabel, { color: colors.text }]}>
            {t('settings.lock')}
          </Text>
          <Switch
            accessibilityLabel={t('settings.lock')}
            accessibilityHint={lockUnavailable ? t('settings.lockUnavailable') : t('settings.lockHint')}
            value={lock.enabled === true}
            disabled={lockUnavailable || lock.enabled === null}
            // El estado accesible debe decirlo también: TalkBack anuncia "deshabilitado".
            accessibilityState={{ disabled: lockUnavailable || lock.enabled === null }}
            onValueChange={(next) => void toggleLock(next)}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>
        <Text style={[typography.caption, { color: colors.muted }]}>
          {lockUnavailable ? t('settings.lockUnavailable') : t('settings.lockHint')}
        </Text>
        {lock.enabled ? (
          <Text style={[typography.caption, { color: colors.muted }]}>{t('settings.lockScreenHint')}</Text>
        ) : null}
        {lockMessage ? (
          <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.danger }]}>
            {lockMessage}
          </Text>
        ) : null}
      </Section>

      <Section title={t('settings.about')}>
        <Text style={[typography.body, { color: colors.text }]}>{t('settings.version', { version })}</Text>
        <Button
          label={t('settings.privacy')}
          variant="secondary"
          accessibilityHint={t('settings.privacyHint')}
          // Navegador del sistema (Custom Tabs), nunca un WebView dentro de la app (spec §13, MASVS-PLATFORM).
          onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget },
  switchLabel: { flex: 1 },
});
