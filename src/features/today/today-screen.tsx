// Today (HU-85): "puedes gastar hoy" por moneda, con su fórmula, cobros hasta fin de mes y presupuestos a vigilar.
// Todas las cifras vienen de GET /api/dashboard/today; la pantalla solo las formatea y explica.
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatMoney } from '@/core/format/money';
import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';
import { Card } from '@/shared/ui/card';
import { ErrorState } from '@/shared/ui/error-state';
import { StatusScreen } from '@/shared/ui/status-screen';

import {
  budgetStateKey,
  hasMoneyData,
  monthEnd,
  type BudgetToWatch,
  type CurrencyToday,
  type MonthCharge,
} from './today-view';
import { useToday } from './use-today';

// Fila etiqueta / valor, legible por TalkBack como una sola frase.
function Row({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  const { colors, typography } = useTheme();
  const color = tone === 'income' ? colors.success : tone === 'expense' ? colors.danger : colors.text;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[typography.body, styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[typography.body, { color, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

function CurrencyCard({ currency, monthEndDate }: { currency: CurrencyToday; monthEndDate: string }) {
  const { colors, radius, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const [showFormula, setShowFormula] = useState(false);
  const money = (value: number) => formatMoney(value, currency.currency, language);

  return (
    <Card>
      <View style={styles.row}>
        <Text style={[typography.body, { color: colors.muted }]}>{t('today.safeToSpend')}</Text>
        <Text style={[typography.caption, { color: colors.muted, fontWeight: '700' }]}>
          {currency.currency}
        </Text>
      </View>
      <Text
        style={[typography.display, { color: colors.text }]}
        accessibilityLabel={`${t('today.safeToSpend')}: ${money(currency.safeToSpendToday)}`}
      >
        {money(currency.safeToSpendToday)}
      </Text>
      <Text style={[typography.caption, { color: colors.muted }]}>
        {t('today.perDay', { days: currency.daysLeft })}
      </Text>

      {currency.shortfall > 0 ? (
        // El faltante se dice con texto y un "!" visible, no solo con color.
        <Text
          accessibilityRole="alert"
          style={[
            typography.body,
            {
              color: colors.danger,
              borderColor: colors.danger,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: spacing.md,
            },
          ]}
        >
          {`! ${t('today.shortfall', { amount: money(currency.shortfall) })}`}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showFormula }}
        onPress={() => setShowFormula((open) => !open)}
        style={{ minHeight: minTouchTarget, justifyContent: 'center' }}
      >
        <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>
          {showFormula ? t('today.hideCalculation') : t('today.howCalculated')}
        </Text>
      </Pressable>

      {showFormula ? (
        <View style={{ gap: spacing.sm }}>
          <Row label={t('today.available')} value={money(currency.available)} />
          <Row
            label={t('today.committed', { date: formatDate(monthEndDate, language) })}
            value={`-${money(currency.committedUntilMonthEnd)}`}
          />
          <Row label={t('today.daysLeft')} value={String(currency.daysLeft)} />
          {/* La fórmula con los números reales, como en la web: transparencia (principio del producto). */}
          <Text style={[typography.body, { color: colors.text }]}>
            {`(${money(currency.available)} − ${money(currency.committedUntilMonthEnd)}) ÷ ${currency.daysLeft} = ${money(currency.safeToSpendToday)}`}
          </Text>
          <Text style={[typography.caption, { color: colors.muted }]}>{t('today.caveat')}</Text>
        </View>
      ) : null}

      <View
        style={{ gap: spacing.sm, borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.md }}
      >
        <Row label={t('today.todaySpending')} value={`-${money(currency.todayExpenses)}`} />
        <Row label={t('today.monthIncome')} value={`+${money(currency.monthIncome)}`} tone="income" />
        <Row label={t('today.monthExpenses')} value={`-${money(currency.monthExpenses)}`} tone="expense" />
        <Row
          label={t('today.monthNet')}
          value={money(currency.monthNet)}
          tone={currency.monthNet < 0 ? 'expense' : undefined}
        />
      </View>
    </Card>
  );
}

function ChargesCard({ charges }: { charges: MonthCharge[] }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  return (
    <Card title={t('today.charges')}>
      <Text style={[typography.caption, { color: colors.muted }]}>{t('today.chargesNote')}</Text>
      {charges.length === 0 ? (
        <Text style={[typography.body, { color: colors.muted }]}>{t('today.noCharges')}</Text>
      ) : (
        charges.map((charge) => (
          <View key={`${charge.subscriptionId}-${charge.nextBillingDate}`} style={{ gap: spacing.xs }}>
            <View style={styles.row}>
              <Text style={[typography.body, styles.rowLabel, { color: colors.text }]}>{charge.name}</Text>
              <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                {formatMoney(charge.amount, charge.currency, language)}
              </Text>
            </View>
            <Text style={[typography.caption, { color: charge.isOverdue ? colors.danger : colors.muted }]}>
              {charge.isOverdue
                ? `${t('today.overdue')} · ${formatDate(charge.nextBillingDate, language)}`
                : formatDate(charge.nextBillingDate, language)}
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

function BudgetsCard({ budgets }: { budgets: BudgetToWatch[] }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  return (
    <Card title={t('today.budgets')}>
      {budgets.map((budget) => {
        const exceeded = budget.state === 'Exceeded';
        return (
          <View key={budget.id} style={{ gap: spacing.xs }}>
            <View style={styles.row}>
              <Text style={[typography.body, styles.rowLabel, { color: colors.text }]}>
                {budget.categoryName}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: exceeded ? colors.danger : colors.warning, fontWeight: '700' },
                ]}
              >
                {t(budgetStateKey(budget.state))}
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.muted }]}>
              {t('today.budgetUsage', {
                spent: formatMoney(budget.spent, budget.currency, language),
                limit: formatMoney(budget.limit, budget.currency, language),
                percent: budget.percent,
              })}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

export function TodayScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t } = useI18n();
  const today = useToday();

  if (today.isPending) {
    return <StatusScreen busy message={t('session.restoring')} />;
  }
  if (today.isError && !today.data) {
    return (
      <ErrorState title={t('today.loadError')} error={today.error} onRetry={() => void today.refetch()} />
    );
  }

  const data = today.data;
  const monthEndDate = monthEnd(data.referenceDate);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      refreshControl={
        // Deslizar hacia abajo vuelve a pedir los datos (spec FR-2).
        <RefreshControl
          refreshing={today.isRefetching}
          onRefresh={() => void today.refetch()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {hasMoneyData(data) ? (
        data.currencies.map((currency) => (
          <CurrencyCard key={currency.currency} currency={currency} monthEndDate={monthEndDate} />
        ))
      ) : (
        <Card title={t('today.empty.title')}>
          <Text style={[typography.body, { color: colors.muted }]}>{t('today.empty.text')}</Text>
        </Card>
      )}
      <ChargesCard charges={data.chargesUntilMonthEnd} />
      {data.budgetsToWatch.length > 0 ? <BudgetsCard budgets={data.budgetsToWatch} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1 },
});
