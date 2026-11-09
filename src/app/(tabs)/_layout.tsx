// Barra de pestañas inferior: Today · Movements · Payments · Plan (spec EP-17 §4).
import { Link, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';
import { ReminderSync } from '@/features/payments/reminder-sync';

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

// Botón "+" flotante sobre la barra de pestañas (spec §4): abre el registro rápido desde cualquier pestaña.
function QuickAddButton() {
  const { colors, radius, spacing } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <Link href="/quick-add" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('quickAdd.open')}
        style={({ pressed }) => [
          styles.fab,
          {
            // Altura de la barra de pestañas + margen: nunca tapa las etiquetas de las pestañas.
            bottom: insets.bottom + minTouchTarget + 12 + spacing.md,
            right: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.fabText, { color: colors.onPrimary }]}>+</Text>
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <TabsNavigator />
      <QuickAddButton />
      {/* Recordatorios locales (HU-89): se reprograman con cada carga de los próximos cobros. */}
      <ReminderSync />
    </View>
  );
}

function TabsNavigator() {
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { fontSize: 30, lineHeight: 34, fontWeight: '600' },
});
