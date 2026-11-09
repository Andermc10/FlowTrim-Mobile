// Reglas puras de Pagos recurrentes y "Marcar como pagado" (HU-87). La cuenta regresiva y la ventana de alerta las
// calcula el servidor (HU-04); la app solo las une con los datos del pago y las describe con texto.
import type { components } from '@/core/api/schema';
import { isIsoDate } from '@/core/format/product-calendar';
import type { TranslationKey } from '@/core/i18n/translations';
import { parseAmount, type Account, type Category } from '@/features/movements/movements-view';

export type Subscription = components['schemas']['SubscriptionResponse'];
export type UpcomingCharges = components['schemas']['UpcomingChargesResponse'];
export type UpcomingCharge = components['schemas']['UpcomingChargeItem'];
export type MarkPaidRequest = components['schemas']['MarkPaidRequest'];
export type MarkPaidResponse = components['schemas']['MarkPaidResponse'];

export interface Payment {
  charge: UpcomingCharge;
  /** Detalle del pago (tipo, cuotas, enlace); null si no llegó en el listado. */
  subscription: Subscription | null;
}

/** Une los próximos cobros (ya ordenados por fecha en el servidor) con el detalle de cada pago, sin reordenar. */
export function joinPayments(upcoming: UpcomingCharges, subscriptions: readonly Subscription[]): Payment[] {
  const byId = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  return upcoming.items.map((charge) => ({ charge, subscription: byId.get(charge.id) ?? null }));
}

const alertKeys: Record<string, TranslationKey> = {
  Overdue: 'payments.alert.Overdue',
  Today: 'payments.alert.Today',
  DueWithin3Days: 'payments.alert.DueWithin3Days',
  DueWithin7Days: 'payments.alert.DueWithin7Days',
  Later: 'payments.alert.Later',
};

/** Ventana de alerta como texto; un valor nuevo de la API se muestra como "más adelante" sin romper la pantalla. */
export function alertKey(window: string): TranslationKey {
  return alertKeys[window] ?? 'payments.alert.Later';
}

/** Tono visual de la ventana (siempre acompañado del texto). */
export function alertTone(window: string): 'danger' | 'warning' | 'muted' {
  if (window === 'Overdue' || window === 'Today') return 'danger';
  if (window === 'DueWithin3Days' || window === 'DueWithin7Days') return 'warning';
  return 'muted';
}

/** Cuenta regresiva en palabras: vencidos en pasado, nunca como fechas futuras (CLAUDE.md §5). */
export function countdown(days: number): { key: TranslationKey; count: number } {
  if (days < 0) return { key: days === -1 ? 'payments.overdueOne' : 'payments.overdueMany', count: -days };
  if (days === 0) return { key: 'payments.dueToday', count: 0 };
  return { key: days === 1 ? 'payments.inOne' : 'payments.inMany', count: days };
}

const kindKeys: Record<string, TranslationKey> = {
  Subscription: 'payments.kind.Subscription',
  Bill: 'payments.kind.Bill',
  Instalment: 'payments.kind.Instalment',
};

export function kindKey(kind: string): TranslationKey {
  return kindKeys[kind] ?? 'payments.kind.Subscription';
}

/**
 * Solo se abre un enlace `https://` sin credenciales: la API ya lo exige (EP-14), pero la app no confía en ningún dato
 * para abrir URLs (un `javascript:` o `intent:` nunca llega al sistema).
 */
export function safePaymentUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Cuentas activas en la moneda del pago: FlowTrim nunca convierte monedas. */
export function accountsForPayment(payment: Subscription, accounts: readonly Account[]): Account[] {
  return accounts.filter((account) => !account.isArchived && account.currency === payment.currency);
}

export type MarkPaidMode = 'record' | 'dateOnly';

export interface MarkPaidDraft {
  mode: MarkPaidMode;
  accountId: string;
  amount: string;
  date: string;
  categoryId: string;
}

/**
 * Valores iniciales, como la web (EP-14 D7): registrar en la cuenta por defecto si sirve (o en la única disponible),
 * con el importe y la categoría del pago; sin cuentas en esa moneda solo se puede mover la fecha.
 */
export function initialDraft(
  payment: Subscription,
  accounts: readonly Account[],
  categories: readonly Category[],
  today: string,
): MarkPaidDraft {
  const options = accountsForPayment(payment, accounts);
  const account =
    options.find((option) => option.id === payment.defaultAccountId) ??
    (options.length === 1 ? options[0] : undefined);
  const category = categories.find((option) => option.id === payment.categoryId && !option.isArchived);
  return {
    mode: account ? 'record' : 'dateOnly',
    accountId: account?.id ?? '',
    amount: String(payment.amount),
    date: today,
    categoryId: category?.id ?? '',
  };
}

export type MarkPaidField = 'accountId' | 'amount' | 'date' | 'categoryId';
export type MarkPaidErrors = Partial<Record<MarkPaidField, TranslationKey>>;

export function validateMarkPaid(draft: MarkPaidDraft, today: string): MarkPaidErrors {
  if (draft.mode === 'dateOnly') return {};
  const errors: MarkPaidErrors = {};
  if (!draft.accountId) errors.accountId = 'markPaid.error.accountRequired';
  if (!draft.amount.trim()) errors.amount = 'quickAdd.error.amountRequired';
  else if (parseAmount(draft.amount) === null) errors.amount = 'quickAdd.error.amountInvalid';
  if (!isIsoDate(draft.date)) errors.date = 'quickAdd.error.dateInvalid';
  else if (draft.date > today) errors.date = 'markPaid.error.dateInFuture';
  if (!draft.categoryId) errors.categoryId = 'markPaid.error.categoryRequired';
  return errors;
}

/** Cuerpo del POST: null = "pagado fuera de FlowTrim" (solo mueve la fecha, HU-57). */
export function toMarkPaidRequest(draft: MarkPaidDraft): MarkPaidRequest | null {
  if (draft.mode === 'dateOnly') return null;
  return {
    accountId: draft.accountId,
    amount: parseAmount(draft.amount),
    date: draft.date,
    categoryId: draft.categoryId,
  };
}

/** Qué pasó, en palabras: plan completado, gasto registrado o solo fecha movida. */
export function resultKey(result: MarkPaidResponse): TranslationKey {
  if (result.completed) return 'markPaid.result.completed';
  return result.transaction ? 'markPaid.result.recorded' : 'markPaid.result.moved';
}
