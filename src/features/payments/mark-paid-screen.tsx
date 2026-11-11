// "Marcar como pagado" (HU-87 FR-2), igual que el diálogo de la web (EP-14 D5): registrar el gasto en una cuenta de la
// misma moneda (importe, fecha y categoría editables: las facturas varían) o solo mover la próxima fecha.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

import { isApiError } from '@/core/api/api-error';
import { errorMessage } from '@/core/api/error-message';
import { formatDate, formatMoney } from '@/core/format/money';
import { productToday, shiftDays } from '@/core/format/product-calendar';
import { useI18n } from '@/core/i18n/i18n';
import { useOnline } from '@/core/network/network-status';
import { OfflineSaveNotice } from '@/shared/ui/offline-banner';
import { useTheme } from '@/core/theme/theme';
import { categoriesFor, type Account, type Category } from '@/features/movements/movements-view';
import { useAccounts, useCategories } from '@/features/movements/use-movements';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ChoiceGroup } from '@/shared/ui/choice-group';
import { ErrorState } from '@/shared/ui/error-state';
import { FieldError } from '@/shared/ui/field-error';
import { StatusScreen } from '@/shared/ui/status-screen';
import { TextField } from '@/shared/ui/text-field';

import {
  accountsForPayment,
  initialDraft,
  resultKey,
  toMarkPaidRequest,
  validateMarkPaid,
  type MarkPaidDraft,
  type MarkPaidErrors,
  type MarkPaidField,
  type MarkPaidResponse,
  type Subscription,
} from './payments-view';
import { useMarkPaid, useSubscription } from './use-payments';

function ResultView({ result }: { result: MarkPaidResponse }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const { subscription, transaction } = result;
  const message = t(resultKey(result), {
    name: subscription.name,
    amount: transaction ? formatMoney(transaction.amount, transaction.currency, language) : '',
    account: transaction?.accountName ?? '',
    date: formatDate(subscription.nextBillingDate, language),
  });
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <Card>
        <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.text }]}>
          {`✓ ${message}`}
        </Text>
      </Card>
      <Button label={t('markPaid.done')} onPress={() => router.back()} />
    </ScrollView>
  );
}

function MarkPaidForm({
  payment,
  accounts,
  categories,
  today,
}: {
  payment: Subscription;
  accounts: Account[];
  categories: Category[];
  today: string;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const markPaid = useMarkPaid(payment.id);
  // Sin red no se guarda ni se encola nada (HU-90 FR-2).
  const online = useOnline();
  const options = useMemo(() => accountsForPayment(payment, accounts), [payment, accounts]);
  const expenseCategories = useMemo(() => categoriesFor('Expense', categories, new Map()), [categories]);
  const [draft, setDraft] = useState<MarkPaidDraft>(() => initialDraft(payment, accounts, categories, today));
  const [clientErrors, setClientErrors] = useState<MarkPaidErrors>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});

  if (markPaid.data) {
    return <ResultView result={markPaid.data} />;
  }

  const update = (patch: Partial<MarkPaidDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const errorsFor = (field: MarkPaidField): string[] => {
    const local = clientErrors[field];
    return [...(local ? [t(local)] : []), ...(serverErrors[field] ?? [])];
  };
  const recording = draft.mode === 'record';

  function submit() {
    setServerErrors({});
    const errors = validateMarkPaid(draft, today);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      AccessibilityInfo.announceForAccessibility(t('errors.validation'));
      return;
    }
    markPaid.mutate(toMarkPaidRequest(draft), {
      onError: (error) => {
        if (isApiError(error) && error.kind === 'validation') {
          setServerErrors(error.fieldErrors ?? {});
        }
      },
    });
  }

  const generalError =
    markPaid.isError && !(isApiError(markPaid.error) && markPaid.error.kind === 'validation')
      ? errorMessage(markPaid.error)
      : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {payment.name}
        </Text>
        <Text style={[typography.body, { color: colors.muted }]}>
          {t('markPaid.due', {
            amount: formatMoney(payment.amount, payment.currency, language),
            date: formatDate(payment.nextBillingDate, language),
          })}
        </Text>
      </View>

      <ChoiceGroup<string>
        label={t('markPaid.mode')}
        choices={[
          ...(options.length > 0 ? [{ value: 'record', label: t('markPaid.record') }] : []),
          { value: 'dateOnly', label: t('markPaid.dateOnly') },
        ]}
        selected={draft.mode}
        onSelect={(mode) => update({ mode: mode === 'record' ? 'record' : 'dateOnly' })}
      />
      <Text style={[typography.caption, { color: colors.muted }]}>
        {options.length === 0
          ? t('markPaid.noAccount', { currency: payment.currency })
          : recording
            ? t('markPaid.recordHint')
            : t('markPaid.dateOnlyHint')}
      </Text>

      {recording ? (
        <>
          <View style={{ gap: spacing.xs }}>
            <ChoiceGroup<string>
              label={t('markPaid.account')}
              choices={options.map((account) => ({ value: account.id, label: account.name }))}
              selected={draft.accountId}
              onSelect={(accountId) => update({ accountId })}
            />
            <FieldError messages={errorsFor('accountId')} />
          </View>
          <TextField
            label={t('markPaid.amount', { currency: payment.currency })}
            hint={t('markPaid.amountHint')}
            value={draft.amount}
            onChangeText={(amount) => update({ amount })}
            keyboardType="decimal-pad"
            errors={errorsFor('amount')}
          />
          <View style={{ gap: spacing.sm }}>
            <ChoiceGroup
              label={t('markPaid.date')}
              choices={[
                { value: today, label: t('quickAdd.today') },
                { value: shiftDays(today, -1), label: t('quickAdd.yesterday') },
              ]}
              selected={draft.date}
              onSelect={(date) => update({ date })}
            />
            <TextField
              label={t('quickAdd.otherDate')}
              hint={t('quickAdd.dateHint')}
              value={draft.date}
              onChangeText={(date) => update({ date: date.trim() })}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              errors={errorsFor('date')}
            />
          </View>
          <View style={{ gap: spacing.xs }}>
            <ChoiceGroup<string>
              label={t('markPaid.category')}
              choices={expenseCategories.map((category) => ({ value: category.id, label: category.name }))}
              selected={draft.categoryId}
              onSelect={(categoryId) => update({ categoryId })}
            />
            <FieldError messages={errorsFor('categoryId')} />
          </View>
        </>
      ) : null}

      {generalError ? (
        <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
          <Text style={[typography.body, { color: colors.danger }]}>
            {`! ${t(generalError.key, generalError.params)}`}
          </Text>
          {generalError.reference ? (
            <Text selectable style={[typography.caption, { color: colors.muted }]}>
              {t('errors.reference', { id: generalError.reference })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {online ? null : <OfflineSaveNotice />}
      <Button
        label={recording ? t('markPaid.submitRecord') : t('markPaid.submitDateOnly')}
        onPress={submit}
        loading={markPaid.isPending}
        disabled={!online}
      />
    </ScrollView>
  );
}

export function MarkPaidScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  // "Hoy" del producto al abrir: no cambia mientras se llena el formulario.
  const [today] = useState(() => productToday());
  const payment = useSubscription(id);
  const accounts = useAccounts();
  const categories = useCategories();
  const online = useOnline();

  if (payment.isError) {
    return (
      <ErrorState
        title={t('markPaid.loadError')}
        error={payment.error}
        onRetry={() => void payment.refetch()}
      />
    );
  }
  if (payment.isPending || accounts.isPending || categories.isPending) {
    return online ? (
      <StatusScreen busy message={t('markPaid.loading')} />
    ) : (
      <StatusScreen title={t('offline.title')} message={t('offline.cannotSave')} />
    );
  }
  // Sin cuentas o categorías (fallo de carga) solo queda "mover la fecha", como en la web.
  return (
    <MarkPaidForm
      payment={payment.data}
      accounts={accounts.data ?? []}
      categories={categories.data ?? []}
      today={today}
    />
  );
}
