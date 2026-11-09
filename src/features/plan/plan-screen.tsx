// Plan (HU-88 FR-1): presupuestos de este mes y metas de ahorro, con las cifras de la API. El estado del presupuesto
// y de la meta se dice con texto (no solo color); las estimaciones se marcan como estimaciones.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatMoney } from '@/core/format/money';
import { monthOf, monthTitle, productToday } from '@/core/format/product-calendar';
import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { budgetStateKey } from '@/features/today/today-view';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ErrorState } from '@/shared/ui/error-state';
import { StatusScreen } from '@/shared/ui/status-screen';

import { estimatedMonth, goalStatusKey, meterWidth, type Budget, type Goal } from './plan-view';
import { useBudgets, useGoals } from './use-plan';

// Barra de avance: decorativa (oculta a TalkBack); el porcentaje siempre está también en texto.
function Meter({ percent, color }: { percent: number; color: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.track, { backgroundColor: colors.surfaceSoft, borderRadius: radius.pill }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${meterWidth(percent)}%`, backgroundColor: color, borderRadius: radius.pill },
        ]}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[typography.body, styles.grow, { color: colors.muted }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

function BudgetItem({ budget }: { budget: Budget }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const money = (value: number) => formatMoney(value, budget.currency, language);
  const color =
    budget.state === 'Exceeded'
      ? colors.danger
      : budget.state === 'Warning'
        ? colors.warning
        : colors.success;
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={styles.row}>
        <Text style={[typography.body, styles.grow, { color: colors.text, fontWeight: '600' }]}>
          {budget.categoryName}
        </Text>
        <Text style={[typography.caption, { color, fontWeight: '700' }]}>
          {budget.state === 'Exceeded'
            ? `! ${t(budgetStateKey(budget.state))}`
            : t(budgetStateKey(budget.state))}
        </Text>
      </View>
      <Meter percent={budget.percent} color={color} />
      <Text style={[typography.caption, { color: colors.muted }]}>
        {t('today.budgetUsage', {
          spent: money(budget.spent),
          limit: money(budget.limit),
          percent: budget.percent,
        })}
      </Text>
      <Text style={[typography.caption, { color: budget.over > 0 ? colors.danger : colors.muted }]}>
        {budget.over > 0
          ? t('plan.budget.over', { amount: money(budget.over) })
          : t('plan.budget.remaining', { amount: money(budget.remaining) })}
      </Text>
    </View>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const money = (value: number) => formatMoney(value, goal.currency, language);
  const status = goalStatusKey(goal);
  const estimate = estimatedMonth(goal, language);
  return (
    <Card>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={[typography.title, styles.grow, { color: colors.text }]}>
          {goal.name}
        </Text>
        {status ? (
          <Text
            style={[
              typography.caption,
              { color: goal.completed ? colors.success : colors.danger, fontWeight: '700' },
            ]}
          >
            {goal.completed ? `✓ ${t(status)}` : `! ${t(status)}`}
          </Text>
        ) : null}
      </View>
      <Meter percent={goal.percent} color={goal.completed ? colors.success : colors.primary} />
      <Text style={[typography.body, { color: colors.text }]}>
        {t('plan.goal.saved', {
          saved: money(goal.saved),
          target: money(goal.target),
          percent: goal.percent,
        })}
      </Text>
      <View style={{ gap: spacing.xs }}>
        <Row label={t('plan.goal.remaining')} value={money(goal.remaining)} />
        {goal.targetDate ? (
          <Row label={t('plan.goal.targetDate')} value={formatDate(goal.targetDate, language)} />
        ) : null}
        {goal.requiredPerMonth !== null && !goal.completed ? (
          <Row label={t('plan.goal.requiredPerMonth')} value={money(goal.requiredPerMonth)} />
        ) : null}
        {goal.completed ? null : (
          <Row label={t('plan.goal.estimate')} value={estimate ?? t('plan.goal.notEnoughData')} />
        )}
      </View>
      <Button
        label={t('plan.goal.contribute')}
        variant="secondary"
        accessibilityHint={t('plan.goal.contributeHint', { name: goal.name })}
        onPress={() => router.push({ pathname: '/goal-contribution/[id]', params: { id: goal.id } })}
      />
    </Card>
  );
}

export function PlanScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const [month] = useState(() => monthOf(productToday()));
  const budgets = useBudgets(month);
  const goals = useGoals();

  if (budgets.isPending || goals.isPending) {
    return <StatusScreen busy message={t('plan.loading')} />;
  }
  // Sin datos tras cargar = falló una de las dos consultas: se muestra el error y se reintenta esa.
  const budgetList = budgets.data;
  const goalList = goals.data;
  if (!budgetList || !goalList) {
    const failed = budgets.isError ? budgets : goals;
    return (
      <ErrorState title={t('plan.loadError')} error={failed.error} onRetry={() => void failed.refetch()} />
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      // Espacio abajo para que el botón "+" no tape la última tarjeta.
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 96 }}
      refreshControl={
        <RefreshControl
          refreshing={budgets.isRefetching || goals.isRefetching}
          onRefresh={() => {
            void budgets.refetch();
            void goals.refetch();
          }}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <Card title={t('plan.budgets', { month: monthTitle(month, language) })}>
        {budgetList.items.length === 0 ? (
          <Text style={[typography.body, { color: colors.muted }]}>{t('plan.budgets.empty')}</Text>
        ) : (
          budgetList.items.map((budget) => <BudgetItem key={budget.id} budget={budget} />)
        )}
        <Text style={[typography.caption, { color: colors.muted }]}>{t('plan.budgets.note')}</Text>
      </Card>

      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {t('plan.goals')}
      </Text>
      {goalList.length === 0 ? (
        <Card>
          <Text style={[typography.body, { color: colors.muted }]}>{t('plan.goals.empty')}</Text>
        </Card>
      ) : (
        goalList.map((goal) => <GoalCard key={goal.id} goal={goal} />)
      )}
      <Text style={[typography.caption, { color: colors.muted }]}>{t('plan.goals.note')}</Text>
      <Text style={[typography.caption, { color: colors.muted }]}>{t('plan.manageOnWeb')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  grow: { flex: 1 },
  track: { height: 8, overflow: 'hidden' },
  fill: { height: 8 },
});
