// Registro rápido (HU-86 FR-1): gasto, ingreso o transferencia en segundos desde el botón "+".
// La API valida y guarda; el teléfono solo adelanta los errores obvios y muestra los de la API en cada campo.
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { isApiError } from '@/core/api/api-error';
import { errorMessage } from '@/core/api/error-message';
import { formatMoney } from '@/core/format/money';
import { productToday, shiftDays } from '@/core/format/product-calendar';
import { useI18n } from '@/core/i18n/i18n';
import { useOnline } from '@/core/network/network-status';
import { OfflineSaveNotice } from '@/shared/ui/offline-banner';
import { useTheme } from '@/core/theme/theme';
import { Button } from '@/shared/ui/button';
import { ChoiceGroup } from '@/shared/ui/choice-group';
import { ErrorState } from '@/shared/ui/error-state';
import { FieldError } from '@/shared/ui/field-error';
import { StatusScreen } from '@/shared/ui/status-screen';
import { TextField } from '@/shared/ui/text-field';

import {
  DESCRIPTION_MAX_LENGTH,
  categoriesFor,
  destinationAccounts,
  toRequest,
  transactionTypes,
  validateDraft,
  type Account,
  type Category,
  type DraftErrors,
  type DraftField,
  type QuickAddDraft,
  type Transaction,
} from './movements-view';
import {
  loadLastAccountId,
  saveLastAccountId,
  useAccounts,
  useCategories,
  useCategoryUsage,
  useCreateTransaction,
} from './use-movements';

function QuickAddForm({
  accounts,
  categories,
  usage,
  initialAccountId,
  today,
}: {
  accounts: Account[];
  categories: Category[];
  usage: ReadonlyMap<string, number>;
  initialAccountId: string;
  today: string;
}) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const create = useCreateTransaction();
  // Sin red no se guarda ni se encola nada (HU-90 FR-2).
  const online = useOnline();

  const [draft, setDraft] = useState<QuickAddDraft>({
    type: 'Expense',
    accountId: initialAccountId,
    toAccountId: '',
    categoryId: '',
    amount: '',
    date: today,
    description: '',
  });
  const [clientErrors, setClientErrors] = useState<DraftErrors>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const kindCategories = useMemo(
    () => categoriesFor(draft.type, categories, usage),
    [draft.type, categories, usage],
  );
  const destinations = useMemo(
    () => destinationAccounts(draft.accountId, accounts),
    [draft.accountId, accounts],
  );
  const transfer = draft.type === 'Transfer';
  const currency = accounts.find((account) => account.id === draft.accountId)?.currency;

  // Cambiar tipo o cuenta limpia lo que dejó de ser válido (categoría de otra clase, destino de otra moneda).
  function update(patch: Partial<QuickAddDraft>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (
        next.categoryId &&
        !categoriesFor(next.type, categories, usage).some((c) => c.id === next.categoryId)
      ) {
        next.categoryId = '';
      }
      if (
        next.toAccountId &&
        !destinationAccounts(next.accountId, accounts).some((a) => a.id === next.toAccountId)
      ) {
        next.toAccountId = '';
      }
      return next;
    });
    setSavedMessage(null);
  }

  const errorsFor = (field: DraftField): string[] => {
    const local = clientErrors[field];
    return [...(local ? [t(local)] : []), ...(serverErrors[field] ?? [])];
  };

  function savedText(saved: Transaction): string {
    const detail =
      saved.type === 'Transfer'
        ? `${saved.accountName} → ${saved.toAccountName ?? ''}`
        : (saved.categoryName ?? '');
    const type = saved.type === 'Income' || saved.type === 'Transfer' ? saved.type : 'Expense';
    return t(`quickAdd.saved.${type}`, {
      detail,
      amount: formatMoney(saved.amount, saved.currency, language),
    });
  }

  function submit(addAnother: boolean) {
    setServerErrors({});
    setSavedMessage(null);
    const errors = validateDraft(draft, today);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      AccessibilityInfo.announceForAccessibility(t('errors.validation'));
      return;
    }
    create.mutate(toRequest(draft), {
      onSuccess: (saved) => {
        void saveLastAccountId(saved.accountId);
        const message = savedText(saved);
        AccessibilityInfo.announceForAccessibility(message);
        if (!addAnother) {
          router.back();
          return;
        }
        // Mismo tipo, cuenta y fecha; importe, categoría y descripción vacíos para el siguiente.
        setDraft((current) => ({ ...current, categoryId: '', amount: '', description: '' }));
        setSavedMessage(message);
      },
      onError: (error) => {
        if (isApiError(error) && error.kind === 'validation') {
          setServerErrors(error.fieldErrors ?? {});
        }
      },
    });
  }

  // Error general (no de campos): mensaje traducido con referencia para soporte, nunca el cuerpo crudo.
  const generalError =
    create.isError && !(isApiError(create.error) && create.error.kind === 'validation')
      ? errorMessage(create.error)
      : null;

  const typeLabels = {
    Expense: t('movements.type.Expense'),
    Income: t('movements.type.Income'),
    Transfer: t('movements.type.Transfer'),
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <ChoiceGroup
          label={t('quickAdd.type')}
          choices={transactionTypes.map((value) => ({ value, label: typeLabels[value] }))}
          selected={draft.type}
          onSelect={(type) => update({ type })}
        />

        <TextField
          label={currency ? t('quickAdd.amountIn', { currency }) : t('quickAdd.amount')}
          value={draft.amount}
          onChangeText={(amount) => update({ amount })}
          keyboardType="decimal-pad"
          placeholder="0"
          autoFocus
          errors={errorsFor('amount')}
        />

        {transfer ? null : (
          <View style={{ gap: spacing.xs }}>
            {kindCategories.length > 0 ? (
              <ChoiceGroup
                label={t('quickAdd.category')}
                choices={kindCategories.map((category) => ({ value: category.id, label: category.name }))}
                selected={draft.categoryId}
                onSelect={(categoryId) => update({ categoryId })}
              />
            ) : (
              <Text style={[typography.body, { color: colors.muted }]}>{t('quickAdd.noCategories')}</Text>
            )}
            <FieldError messages={errorsFor('categoryId')} />
          </View>
        )}

        <View style={{ gap: spacing.xs }}>
          <ChoiceGroup
            label={transfer ? t('quickAdd.fromAccount') : t('quickAdd.account')}
            choices={accounts.map((account) => ({
              value: account.id,
              label: `${account.name} · ${account.currency}`,
            }))}
            selected={draft.accountId}
            onSelect={(accountId) => update({ accountId })}
          />
          <FieldError messages={errorsFor('accountId')} />
        </View>

        {transfer ? (
          <View style={{ gap: spacing.xs }}>
            {destinations.length > 0 ? (
              <ChoiceGroup
                label={t('quickAdd.toAccount')}
                choices={destinations.map((account) => ({ value: account.id, label: account.name }))}
                selected={draft.toAccountId}
                onSelect={(toAccountId) => update({ toAccountId })}
              />
            ) : (
              <Text style={[typography.body, { color: colors.muted }]}>{t('quickAdd.noDestination')}</Text>
            )}
            <FieldError messages={errorsFor('toAccountId')} />
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <ChoiceGroup
            label={t('quickAdd.date')}
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

        <TextField
          label={t('quickAdd.description')}
          value={draft.description}
          onChangeText={(description) => update({ description })}
          maxLength={DESCRIPTION_MAX_LENGTH}
          errors={errorsFor('description')}
        />

        {savedMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.body, { color: colors.success, fontWeight: '600' }]}
          >
            {`✓ ${savedMessage}`}
          </Text>
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
          label={t('quickAdd.save')}
          onPress={() => submit(false)}
          loading={create.isPending}
          disabled={!online}
        />
        <Button
          label={t('quickAdd.saveAndAdd')}
          variant="secondary"
          onPress={() => submit(true)}
          disabled={create.isPending || !online}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function QuickAddScreen() {
  const { t } = useI18n();
  // Fecha del producto al abrir el formulario: "hoy" no cambia mientras se escribe.
  const [today] = useState(() => productToday());
  const accounts = useAccounts();
  const categories = useCategories();
  const usage = useCategoryUsage(today);
  const online = useOnline();
  const [lastAccountId, setLastAccountId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void loadLastAccountId().then((id) => {
      if (active) setLastAccountId(id);
    });
    return () => {
      active = false;
    };
  }, []);

  const activeAccounts = useMemo(
    () => (accounts.data ?? []).filter((account) => !account.isArchived),
    [accounts.data],
  );

  const failed = accounts.isError ? accounts : categories.isError ? categories : null;
  if (failed) {
    return (
      <ErrorState
        title={t('quickAdd.loadError')}
        error={failed.error}
        onRetry={() => void failed.refetch()}
      />
    );
  }
  // El uso reciente solo ordena chips: si falla, el formulario funciona igual con el orden por nombre.
  if (accounts.isPending || categories.isPending || usage.isPending || lastAccountId === undefined) {
    // Cuentas y categorías no se guardan en el teléfono: sin red se explica que no se puede registrar (AC-1).
    return online ? (
      <StatusScreen busy message={t('quickAdd.loading')} />
    ) : (
      <StatusScreen title={t('offline.title')} message={t('offline.cannotSave')} />
    );
  }
  if (activeAccounts.length === 0) {
    return <StatusScreen title={t('quickAdd.noAccounts.title')} message={t('quickAdd.noAccounts.text')} />;
  }

  const initialAccountId =
    activeAccounts.find((account) => account.id === lastAccountId)?.id ?? activeAccounts[0]!.id;
  return (
    <QuickAddForm
      accounts={activeAccounts}
      categories={categories.data ?? []}
      usage={usage.data ?? new Map()}
      initialAccountId={initialAccountId}
      today={today}
    />
  );
}
