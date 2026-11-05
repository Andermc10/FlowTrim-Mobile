// Barra de pestañas inferior: Today · Movements · Payments · Plan (spec EP-17 §4).
import { Link, Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';

// Acceso a Ajustes desde el encabezado de Today (spec §4); zona táctil mínima y nombre accesible.
function SettingsLink() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useI18n();
  return (
    <Link href="/settings" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.open')}
        style={{ minHeight: minTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.lg }}
      >
        <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>
          {t('settings.title')}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: minTouchTarget + 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.today'), headerRight: () => <SettingsLink /> }} />
      <Tabs.Screen name="movements" options={{ title: t('tabs.movements') }} />
      <Tabs.Screen name="payments" options={{ title: t('tabs.payments') }} />
      <Tabs.Screen name="plan" options={{ title: t('tabs.plan') }} />
    </Tabs>
  );
}
