// Reglas puras de Plan (HU-88): presupuestos del mes y metas de ahorro. Gastado, restante, porcentaje y estimaciones
// los calcula la API (EP-15); la app solo los describe y valida lo que el usuario escribe al aportar o retirar.
import type { components } from '@/core/api/schema';
import { isIsoDate, monthOf, monthTitle } from '@/core/format/product-calendar';
import type { Language, TranslationKey } from '@/core/i18n/translations';
import { parseAmount } from '@/features/movements/movements-view';

export type BudgetList = components['schemas']['BudgetListResponse'];
export type Budget = components['schemas']['BudgetResponse'];
export type Goal = components['schemas']['GoalResponse'];
export type GoalDetail = components['schemas']['GoalDetailResponse'];
export type ContributionRequest = components['schemas']['ContributionRequest'];

/** Límite del dominio (GoalContribution.NoteMaxLength en la API). */
export const NOTE_MAX_LENGTH = 200;

/** Ancho de la barra (0–100): solo dibuja el porcentaje que ya calculó la API. */
export function meterWidth(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

/** Estado de la meta en palabras: completada, fecha objetivo vencida o ninguno. */
export function goalStatusKey(goal: Goal): TranslationKey | null {
  if (goal.completed) return 'plan.goal.completed';
  if (goal.isOverdue) return 'plan.goal.overdue';
  return null;
}

/** Mes estimado de finalización ("March 2027"); null cuando no hay aportes suficientes para estimar. */
export function estimatedMonth(goal: Goal, language: Language): string | null {
  return goal.estimatedCompletion ? monthTitle(monthOf(goal.estimatedCompletion), language) : null;
}

export type ContributionKind = 'deposit' | 'withdrawal';

export interface ContributionDraft {
  kind: ContributionKind;
  amount: string;
  date: string;
  note: string;
}

export type ContributionField = 'amount' | 'date' | 'note';
export type ContributionErrors = Partial<Record<ContributionField, TranslationKey>>;

export function validateContribution(draft: ContributionDraft, today: string): ContributionErrors {
  const errors: ContributionErrors = {};
  if (!draft.amount.trim()) errors.amount = 'quickAdd.error.amountRequired';
  else if (parseAmount(draft.amount) === null) errors.amount = 'quickAdd.error.amountInvalid';
  if (!isIsoDate(draft.date)) errors.date = 'quickAdd.error.dateInvalid';
  else if (draft.date > today) errors.date = 'quickAdd.error.dateInFuture';
  if (draft.note.trim().length > NOTE_MAX_LENGTH) errors.note = 'plan.contribution.noteLength';
  return errors;
}

/** Cuerpo del POST: un retiro es el mismo importe con signo negativo (así lo define la API, EP-15). */
export function toContributionRequest(draft: ContributionDraft): ContributionRequest {
  const amount = parseAmount(draft.amount);
  return {
    amount: amount === null ? null : draft.kind === 'withdrawal' ? -amount : amount,
    date: draft.date,
    note: draft.note.trim() || null,
  };
}
