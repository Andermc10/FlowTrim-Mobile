// Reglas puras de Movimientos y del registro rápido (HU-86). Ningún total de dinero se calcula aquí: los totales del
// mes vienen de la API; la app solo agrupa, ordena y valida lo que el usuario escribe.
import type { components } from '@/core/api/schema';
import { isIsoDate } from '@/core/format/product-calendar';
import type { TranslationKey } from '@/core/i18n/translations';

export type Transaction = components['schemas']['TransactionResponse'];
export type TransactionList = components['schemas']['TransactionListResponse'];
export type TransactionRequest = components['schemas']['TransactionRequest'];
export type Account = components['schemas']['AccountResponse'];
export type Category = components['schemas']['CategoryResponse'];

export const transactionTypes = ['Expense', 'Income', 'Transfer'] as const;
export type TransactionType = (typeof transactionTypes)[number];

/** Tamaño de página del listado (la API acepta hasta 200). */
export const MOVEMENTS_PAGE_SIZE = 50;
/** Ventana para ordenar las categorías por uso reciente (igual que la web, HU-67). */
export const USAGE_WINDOW_DAYS = 90;
/** Límite del dominio (Transaction.DescriptionMaxLength en la API). */
export const DESCRIPTION_MAX_LENGTH = 140;

export interface MovementDay {
  date: string;
  data: Transaction[];
}

/** Agrupa por día los movimientos que la API ya entrega ordenados por fecha descendente (solo agrupa, no suma). */
export function groupByDay(items: readonly Transaction[]): MovementDay[] {
  const days: MovementDay[] = [];
  for (const item of items) {
    const last = days.at(-1);
    if (last && last.date === item.date) {
      last.data.push(item);
    } else {
      days.push({ date: item.date, data: [item] });
    }
  }
  return days;
}

/** Siguiente página según lo que informa la API; undefined cuando ya se cargó todo. */
export function nextPage(list: TransactionList): number | undefined {
  return list.page * list.pageSize < list.totalCount ? list.page + 1 : undefined;
}

/** Signo visible del importe: el tipo también se dice con texto, no solo con color. */
export function amountSign(type: string): '+' | '-' | '' {
  if (type === 'Income') return '+';
  if (type === 'Expense') return '-';
  return '';
}

/** Usos por categoría en los movimientos recientes (cuenta registros, no dinero). */
export function countByCategory(items: readonly Transaction[]): ReadonlyMap<string, number> {
  const usage = new Map<string, number>();
  for (const item of items) {
    if (item.categoryId) {
      usage.set(item.categoryId, (usage.get(item.categoryId) ?? 0) + 1);
    }
  }
  return usage;
}

/** Categorías activas de la clase del tipo, más usadas primero; empate = orden de la API (por nombre). */
export function categoriesFor(
  type: TransactionType,
  categories: readonly Category[],
  usage: ReadonlyMap<string, number>,
): Category[] {
  const kind = type === 'Income' ? 'Income' : 'Expense';
  return categories
    .filter((category) => category.kind === kind && !category.isArchived)
    .map((category, index) => ({ category, index, uses: usage.get(category.id) ?? 0 }))
    .sort((a, b) => b.uses - a.uses || a.index - b.index)
    .map((entry) => entry.category);
}

/** Destinos de una transferencia: otra cuenta activa con la misma moneda (no hay conversión). */
export function destinationAccounts(sourceId: string, accounts: readonly Account[]): Account[] {
  const source = accounts.find((account) => account.id === sourceId);
  return accounts.filter(
    (account) =>
      !account.isArchived && account.id !== sourceId && (!source || account.currency === source.currency),
  );
}

/**
 * Importe escrito por el usuario → número, o null si no es válido. Acepta punto o coma decimal (el teclado numérico
 * en español muestra coma) y hasta 2 decimales; sin separadores de miles para no confundir "1.500" con 1,5.
 */
export function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return value > 0 ? value : null;
}

export interface QuickAddDraft {
  type: TransactionType;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  amount: string;
  date: string;
  description: string;
}

export type DraftField = 'accountId' | 'toAccountId' | 'categoryId' | 'amount' | 'date' | 'description';
export type DraftErrors = Partial<Record<DraftField, TranslationKey>>;

/** Validación en el teléfono, coherente con la API (que sigue siendo la autoridad). */
export function validateDraft(draft: QuickAddDraft, today: string): DraftErrors {
  const errors: DraftErrors = {};
  const transfer = draft.type === 'Transfer';
  if (!draft.accountId) errors.accountId = 'quickAdd.error.accountRequired';
  if (transfer && !draft.toAccountId) errors.toAccountId = 'quickAdd.error.toAccountRequired';
  if (!transfer && !draft.categoryId) errors.categoryId = 'quickAdd.error.categoryRequired';
  if (!draft.amount.trim()) errors.amount = 'quickAdd.error.amountRequired';
  else if (parseAmount(draft.amount) === null) errors.amount = 'quickAdd.error.amountInvalid';
  if (!isIsoDate(draft.date)) errors.date = 'quickAdd.error.dateInvalid';
  // Comparar texto yyyy-MM-dd equivale a comparar fechas.
  else if (draft.date > today) errors.date = 'quickAdd.error.dateInFuture';
  if (draft.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.description = 'quickAdd.error.descriptionLength';
  }
  return errors;
}

/** Cuerpo de POST /api/transactions; solo se llama con un borrador ya validado. */
export function toRequest(draft: QuickAddDraft): TransactionRequest {
  const transfer = draft.type === 'Transfer';
  return {
    type: draft.type,
    accountId: draft.accountId,
    toAccountId: transfer ? draft.toAccountId : null,
    categoryId: transfer ? null : draft.categoryId,
    amount: parseAmount(draft.amount),
    date: draft.date,
    description: draft.description.trim() || null,
    note: null,
  };
}
