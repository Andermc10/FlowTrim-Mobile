// Pagos recurrentes (HU-87 FR-1): pagos activos por próxima fecha, con cuenta regresiva, ventana de alerta y tipo en
// texto, progreso de cuotas, "Marcar como pagado" y "Pagar en el proveedor ↗". Crear y editar pagos sigue en la web.
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatMoney } from '@/core/format/money';
import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ErrorState } from '@/shared/ui/error-state';
import { StatusScreen } from '@/shared/ui/status-screen';

import {
  alertKey,
  alertTone,
  countdown,
  joinPayments,
  kindKey,
  safePaymentUrl,
  type Payment,
} from './payments-view';
import { useSubscriptions, useUpcomingCharges } from './use-payments';

function PaymentCard({ payment }: { payment: Payment }) {
  const { colors, radius, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const { charge, subscription } = payment;
  const tone = alertTone(charge.alertWindow);
  const toneColor = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.muted;
  const due = countdown(charge.daysUntilCharge);
  const payUrl = safePaymentUrl(subscription?.paymentUrl);
  const total = subscription?.kind === 'Instalment' ? subscription.totalInstalments : null;

  return (
    <Card>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={[typography.title, styles.grow, { color: colors.text }]}>
          {charge.name}
        </Text>
        <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
          {formatMoney(charge.amount, charge.currency, language)}
        </Text>
      </View>

      <View style={[styles.row, styles.wrap, { gap: spacing.sm }]}>
        {/* Insignias con texto (no solo color): ventana de alerta y tipo de pago. */}
        <Text
          style={[
            typography.caption,
            styles.badge,
            { color: toneColor, borderColor: toneColor, borderRadius: radius.pill, fontWeight: '700' },
          ]}
        >
          {tone === 'danger' ? `! ${t(alertKey(charge.alertWindow))}` : t(alertKey(charge.alertWindow))}
        </Text>
        {subscription ? (
          <Text
            style={[
              typography.caption,
              styles.badge,
              { color: colors.muted, borderColor: colors.border, borderRadius: radius.pill },
            ]}
          >
            {t(kindKey(subscription.kind))}
          </Text>
        ) : null}
      </View>

      <Text style={[typography.body, { color: tone === 'muted' ? colors.muted : toneColor }]}>
        {`${t(due.key, { count: due.count })} · ${formatDate(charge.nextBillingDate, language)}`}
      </Text>

      {total ? (
        <Text style={[typography.caption, { color: colors.muted }]}>
          {t('payments.instalments', { paid: subscription?.paidInstalments ?? 0, total })}
        </Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Button
          label={t('payments.markPaid')}
          accessibilityHint={t('payments.markPaidHint', { name: charge.name })}
          onPress={() => router.push({ pathname: '/mark-paid/[id]', params: { id: charge.id } })}
        />
        {payUrl ? (
          // Navegador del sistema (Linking), nunca un WebView dentro de la app que pudiera capturar lo que se escribe.
          <Button
            label={t('payments.payAtProvider')}
            variant="secondary"
            accessibilityHint={t('payments.payAtProviderHint')}
            onPress={() => void Linking.openURL(payUrl)}
          />
        ) : null}
      </View>
    </Card>
  );
}

export function PaymentsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useI18n();
  const upcoming = useUpcomingCharges();
  const subscriptions = useSubscriptions();

  // Si el detalle falla, la lista igual se muestra (sin tipo, cuotas ni enlace): lo esencial es la fecha y el importe.
  const payments = useMemo(
    () => (upcoming.data ? joinPayments(upcoming.data, subscriptions.data ?? []) : []),
    [upcoming.data, subscriptions.data],
  );

  if (upcoming.isPending || (subscriptions.isPending && !subscriptions.isError)) {
    return <StatusScreen busy message={t('payments.loading')} />;
  }
  if (upcoming.isError && !upcoming.data) {
    return (
      <ErrorState
        title={t('payments.loadError')}
        error={upcoming.error}
        onRetry={() => void upcoming.refetch()}
      />
    );
  }

  const refresh = () => {
    void upcoming.refetch();
    void subscriptions.refetch();
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      // Espacio abajo para que el botón "+" no tape la última tarjeta.
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 96, flexGrow: 1 }}
      data={payments}
      keyExtractor={(payment) => payment.charge.id}
      renderItem={({ item }) => <PaymentCard payment={item} />}
      ListHeaderComponent={
        <Text style={[typography.caption, { color: colors.muted }]}>{t('payments.note')}</Text>
      }
      ListEmptyComponent={
        <Card title={t('payments.empty.title')}>
          <Text style={[typography.body, { color: colors.muted }]}>{t('payments.empty.text')}</Text>
        </Card>
      }
      ListFooterComponent={
        // HU-87 FR-4: crear y editar pagos sigue en la web (aún sin URL pública: HU-40).
        <Text style={[typography.caption, { color: colors.muted }]}>{t('payments.manageOnWeb')}</Text>
      }
      refreshControl={
        <RefreshControl
          refreshing={upcoming.isRefetching}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  wrap: { flexWrap: 'wrap', justifyContent: 'flex-start' },
  grow: { flex: 1 },
  badge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
});
