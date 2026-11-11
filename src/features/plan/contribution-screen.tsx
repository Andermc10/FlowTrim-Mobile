// Aportar o retirar de una meta (HU-88 FR-2). Es un dato declarado: no mueve dinero entre cuentas (EP-15).
// Un retiro mayor que lo ahorrado lo rechaza la API con 400 en `amount` (lo ahorrado nunca baja de 0) y se ve ahí.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

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
import { StatusScreen } from '@/shared/ui/status-screen';
import { TextField } from '@/shared/ui/text-field';

import {
  NOTE_MAX_LENGTH,
  toContributionRequest,
  validateContribution,
  type ContributionDraft,
  type ContributionErrors,
  type ContributionField,
  type ContributionKind,
  type Goal,
} from './plan-view';
import { useAddContribution, useGoal } from './use-plan';

function ContributionForm({ goal, today }: { goal: Goal; today: string }) {
  const { colors, spacing, typography } = useTheme();
  const { t, language } = useI18n();
  const router = useRouter();
  const add = useAddContribution(goal.id);
  // Sin red no se guarda ni se encola nada (HU-90 FR-2).
  const online = useOnline();
  const [draft, setDraft] = useState<ContributionDraft>({
    kind: 'deposit',
    amount: '',
    date: today,
    note: '',
  });
  const [clientErrors, setClientErrors] = useState<ContributionErrors>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const money = (value: number) => formatMoney(value, goal.currency, language);

  const update = (patch: Partial<ContributionDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const errorsFor = (field: ContributionField): string[] => {
    const local = clientErrors[field];
    return [...(local ? [t(local)] : []), ...(serverErrors[field] ?? [])];
  };

  function submit() {
    setServerErrors({});
    const errors = validateContribution(draft, today);
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      AccessibilityInfo.announceForAccessibility(t('errors.validation'));
      return;
    }
    add.mutate(toContributionRequest(draft), {
      onSuccess: () => {
        AccessibilityInfo.announceForAccessibility(
          t(
            draft.kind === 'deposit' ? 'plan.contribution.savedDeposit' : 'plan.contribution.savedWithdrawal',
          ),
        );
        router.back();
      },
      onError: (error) => {
        if (isApiError(error) && error.kind === 'validation') {
          setServerErrors(error.fieldErrors ?? {});
        }
      },
    });
  }

  const generalError =
    add.isError && !(isApiError(add.error) && add.error.kind === 'validation')
      ? errorMessage(add.error)
      : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {goal.name}
        </Text>
        <Text style={[typography.body, { color: colors.muted }]}>
          {t('plan.contribution.current', { saved: money(goal.saved), target: money(goal.target) })}
        </Text>
      </View>

      <ChoiceGroup<ContributionKind>
        label={t('plan.contribution.type')}
        choices={[
          { value: 'deposit', label: t('plan.contribution.deposit') },
          { value: 'withdrawal', label: t('plan.contribution.withdrawal') },
        ]}
        selected={draft.kind}
        onSelect={(kind) => update({ kind })}
      />
      <TextField
        label={t('plan.contribution.amount', { currency: goal.currency })}
        value={draft.amount}
        onChangeText={(amount) => update({ amount })}
        keyboardType="decimal-pad"
        placeholder="0"
        autoFocus
        errors={errorsFor('amount')}
      />
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
        label={t('plan.contribution.note')}
        value={draft.note}
        onChangeText={(note) => update({ note })}
        maxLength={NOTE_MAX_LENGTH}
        errors={errorsFor('note')}
      />
      <Text style={[typography.caption, { color: colors.muted }]}>{t('plan.contribution.declared')}</Text>

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
        label={t('plan.contribution.save')}
        onPress={submit}
        loading={add.isPending}
        disabled={!online}
      />
    </ScrollView>
  );
}

export function ContributionScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [today] = useState(() => productToday());
  const goal = useGoal(id);
  const online = useOnline();

  if (goal.isPending) {
    return online ? (
      <StatusScreen busy message={t('plan.loading')} />
    ) : (
      <StatusScreen title={t('offline.title')} message={t('offline.cannotSave')} />
    );
  }
  if (goal.isError) {
    return (
      <ErrorState title={t('plan.goal.loadError')} error={goal.error} onRetry={() => void goal.refetch()} />
    );
  }
  return <ContributionForm goal={goal.data.goal} today={today} />;
}
