// Reglas puras de la pantalla Today. Ninguna cifra de dinero se calcula aquí: todas vienen de la API (spec §5).
import type { components } from '@/core/api/schema';
import type { TranslationKey } from '@/core/i18n/translations';

export type TodayDashboard = components['schemas']['TodayDashboardResponse'];
export type CurrencyToday = components['schemas']['CurrencyTodayResponse'];
export type MonthCharge = components['schemas']['MonthChargeResponse'];
export type BudgetToWatch = components['schemas']['BudgetResponse'];

/** Último día del mes de la fecha de referencia del servidor (calendario del producto, America/Bogota). */
export function monthEnd(referenceDate: string): string {
  const [year = 1970, month = 1] = referenceDate.split('-').map(Number);
  // Día 0 del mes siguiente = último día de este mes (maneja 28/29/30/31 sin tablas).
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** Sin cuentas no hay moneda con dinero disponible: se guía al usuario en lugar de mostrar ceros. */
export function hasMoneyData(today: TodayDashboard): boolean {
  return today.currencies.length > 0;
}

const budgetStateKeys: Record<string, TranslationKey> = {
  OnTrack: 'budgets.state.OnTrack',
  Warning: 'budgets.state.Warning',
  Exceeded: 'budgets.state.Exceeded',
};

// Estado del presupuesto como TEXTO (no solo color). Un valor nuevo de la API cae en "cerca del límite", el aviso
// prudente, en lugar de romper la pantalla.
export function budgetStateKey(state: string): TranslationKey {
  return budgetStateKeys[state] ?? 'budgets.state.Warning';
}
