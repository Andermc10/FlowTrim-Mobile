// Movimientos (HU-86 FR-2): el mes elegido agrupado por día, con totales por moneda de la API, filtros por cuenta y
// tipo, y carga por páginas al llegar al final. La app no suma importes: los totales los calcula el backend.
import { useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { formatDate, formatMoney } from '@/core/format/money';
import { monthOf, monthTitle, productToday, shiftMonth } from '@/core/format/product-calendar';
import { useI18n } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { minTouchTarget } from '@/core/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ChoiceGroup } from '@/shared/ui/choice-group';
import { ErrorState } from '@/shared/ui/error-state';
import { StatusScreen } from '@/shared/ui/status-screen';

import {
  amountSign,
  groupByDay,
  transactionTypes,
  type Account,
  type Transaction,
  type TransactionList,
  type TransactionType,
} from './movements-view';
import { useAccounts, useMovements, type MovementsFilter } from './use-movements';

const ALL = 'all';

function MonthSelector({
  month,
  onChange,
  current,
}: {
  month: string;
  onChange: (month: string) => void;
  current: string;
}) {
  const { colors, typography } = useTheme();
  const { t, language } = useI18n();
  const atCurrent = month >= current;
  const arrow = (label: string, text: string, delta: number, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(shiftMonth(month, delta))}
      style={[styles.arrow, { opacity: disabled ? 0.35 : 1 }]}
    >
      <Text style={[typography.title, { color: colors.primary }]}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {arrow(t('movements.previousMonth'), '‹', -1)}
      <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
        {monthTitle(month, language)}
      </Text>
      {/* No hay movimientos futuros (fecha ≤ hoy): no se avanza más allá del mes actual. */}
      {arrow(t('movements.nextMonth'), '›', 1, atCurrent)}
    </View>
  );
}

function TotalsCard({ totals }: { totals: TransactionList['totals'] }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  if (totals.length === 0) {
    return null;
  }
  return (
    <Card>
      {totals.map((total) => {
        const money = (value: number) => formatMoney(value, total.currency, language);
        return (
          <View key={total.currency} style={{ gap: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.muted, fontWeight: '700' }]}>
              {total.currency}
            </Text>
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`${t('movements.income')}: ${money(total.income)}`}
            >
              <Text style={[typography.body, { color: colors.muted }]}>{t('movements.income')}</Text>
              <Text
                style={[typography.body, { color: colors.success, fontWeight: '600' }]}
              >{`+${money(total.income)}`}</Text>
            </View>
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`${t('movements.expenses')}: ${money(total.expense)}`}
            >
              <Text style={[typography.body, { color: colors.muted }]}>{t('movements.expenses')}</Text>
              <Text
                style={[typography.body, { color: colors.danger, fontWeight: '600' }]}
              >{`-${money(total.expense)}`}</Text>
            </View>
            <View
              style={styles.row}
              accessible
              accessibilityLabel={`${t('movements.net')}: ${money(total.net)}`}
            >
              <Text style={[typography.body, { color: colors.muted }]}>{t('movements.net')}</Text>
              <Text
                style={[
                  typography.body,
                  { color: total.net < 0 ? colors.danger : colors.text, fontWeight: '700' },
                ]}
              >
                {money(total.net)}
              </Text>
            </View>
          </View>
        );
      })}
      <Text style={[typography.caption, { color: colors.muted }]}>{t('movements.totalsNote')}</Text>
    </Card>
  );
}

function Filters({
  accounts,
  filter,
  onChange,
}: {
  accounts: Account[];
  filter: MovementsFilter;
  onChange: (patch: Partial<MovementsFilter>) => void;
}) {
  const { spacing } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: spacing.md }}>
      <ChoiceGroup<string>
        label={t('movements.filter.type')}
        choices={[
          { value: ALL, label: t('movements.filter.allTypes') },
          ...transactionTypes.map((value) => ({ value, label: t(`movements.type.${value}`) })),
        ]}
        selected={filter.type ?? ALL}
        onSelect={(value) => onChange({ type: value === ALL ? null : (value as TransactionType) })}
      />
      <ChoiceGroup<string>
        label={t('movements.filter.account')}
        choices={[
          { value: ALL, label: t('movements.filter.allAccounts') },
          ...accounts.map((account) => ({
            value: account.id,
            label: account.isArchived ? `${account.name} (${t('movements.archived')})` : account.name,
          })),
        ]}
        selected={filter.accountId ?? ALL}
        onSelect={(value) => onChange({ accountId: value === ALL ? null : value })}
      />
    </View>
  );
}

function MovementRow({ item }: { item: Transaction }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const transfer = item.type === 'Transfer';
  const route = `${item.accountName} → ${item.toAccountName ?? ''}`;
  const title = item.description ?? (transfer ? route : (item.categoryName ?? ''));
  const detail = transfer ? route : `${item.categoryName ?? ''} · ${item.accountName}`;
  const amount = `${amountSign(item.type)}${formatMoney(item.amount, item.currency, language)}`;
  const typeLabel = t(
    transfer
      ? 'movements.type.Transfer'
      : item.type === 'Income'
        ? 'movements.type.Income'
        : 'movements.type.Expense',
  );
  const color =
    item.type === 'Income' ? colors.success : item.type === 'Expense' ? colors.text : colors.muted;
  return (
    // Una sola frase para TalkBack: tipo (en palabras, no solo color), concepto, detalle e importe.
    <View
      accessible
      accessibilityLabel={`${typeLabel}, ${title}, ${detail}, ${amount}`}
      style={[styles.row, { paddingVertical: spacing.sm, minHeight: minTouchTarget }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.muted }]} numberOfLines={1}>
          {transfer ? `${typeLabel} · ${detail}` : detail}
        </Text>
      </View>
      <Text style={[typography.body, { color, fontWeight: '600' }]}>{amount}</Text>
    </View>
  );
}

export function MovementsScreen() {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const [currentMonth] = useState(() => monthOf(productToday()));
  const [filter, setFilter] = useState<MovementsFilter>({ month: currentMonth, accountId: null, type: null });
  const [showFilters, setShowFilters] = useState(false);
  const movements = useMovements(filter);
  const accounts = useAccounts();

  const pages = movements.data?.pages;
  const sections = useMemo(() => groupByDay(pages?.flatMap((page) => page.items) ?? []), [pages]);
  const totals = pages?.[0]?.totals ?? [];
  const activeFilters = (filter.accountId ? 1 : 0) + (filter.type ? 1 : 0);
  const change = (patch: Partial<MovementsFilter>) => setFilter((current) => ({ ...current, ...patch }));

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <MonthSelector month={filter.month} current={currentMonth} onChange={(month) => change({ month })} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showFilters }}
        onPress={() => setShowFilters((open) => !open)}
        style={{ minHeight: minTouchTarget, justifyContent: 'center' }}
      >
        <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>
          {activeFilters > 0
            ? t('movements.filtersActive', { count: activeFilters })
            : t('movements.filters')}
        </Text>
      </Pressable>
      {showFilters ? <Filters accounts={accounts.data ?? []} filter={filter} onChange={change} /> : null}
      <TotalsCard totals={totals} />
    </View>
  );

  let body: ReactElement | null = null;
  if (movements.isPending) {
    body = <StatusScreen busy message={t('movements.loading')} />;
  } else if (movements.isError && !movements.data) {
    body = (
      <ErrorState
        title={t('movements.loadError')}
        error={movements.error}
        onRetry={() => void movements.refetch()}
      />
    );
  }

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      // Espacio abajo para que el botón "+" no tape la última fila.
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96, flexGrow: 1 }}
      sections={body ? [] : sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <MovementRow item={item} />}
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          style={[
            typography.caption,
            {
              color: colors.muted,
              fontWeight: '700',
              paddingTop: spacing.md,
              backgroundColor: colors.background,
            },
          ]}
        >
          {formatDate(section.date, language)}
        </Text>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        body ?? (
          <Card title={t('movements.empty.title')}>
            <Text style={[typography.body, { color: colors.muted }]}>
              {activeFilters > 0 ? t('movements.empty.filtered') : t('movements.empty.text')}
            </Text>
          </Card>
        )
      }
      ListFooterComponent={
        movements.isFetchingNextPage ? (
          <ActivityIndicator color={colors.primary} style={{ padding: spacing.lg }} />
        ) : movements.hasNextPage ? (
          // Botón además del scroll infinito: TalkBack y teclados externos no siempre disparan onEndReached.
          <View style={{ paddingTop: spacing.md }}>
            <Button
              label={t('movements.loadMore')}
              variant="secondary"
              onPress={() => void movements.fetchNextPage()}
            />
          </View>
        ) : undefined
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (movements.hasNextPage && !movements.isFetchingNextPage) {
          void movements.fetchNextPage();
        }
      }}
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl
          refreshing={movements.isRefetching && !movements.isFetchingNextPage}
          onRefresh={() => void movements.refetch()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  arrow: {
    minWidth: minTouchTarget,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
