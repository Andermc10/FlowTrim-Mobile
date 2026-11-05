// Barra de pestañas inferior: Today · Movements · Payments · Plan (spec EP-17 §4).
import { Tabs } from 'expo-router';

import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';

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
      <Tabs.Screen name="index" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="movements" options={{ title: t('tabs.movements') }} />
      <Tabs.Screen name="payments" options={{ title: t('tabs.payments') }} />
      <Tabs.Screen name="plan" options={{ title: t('tabs.plan') }} />
    </Tabs>
  );
}
