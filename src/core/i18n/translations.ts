// Textos de la interfaz en inglés y español.
// El inglés define las claves; el tipo obliga a que el español tenga exactamente las mismas.

export type Language = 'en' | 'es';

const en = {
  'tabs.today': 'Today',
  'tabs.movements': 'Movements',
  'tabs.payments': 'Payments',
  'tabs.plan': 'Plan',
  'today.title': 'Today',
  'today.placeholder': 'Your safe-to-spend estimate will appear here.',
  'movements.title': 'Movements',
  'movements.placeholder': 'Your income, expenses and transfers will appear here.',
  'payments.title': 'Recurring payments',
  'payments.placeholder': 'Your upcoming expected charges will appear here.',
  'plan.title': 'Plan',
  'plan.placeholder': 'Your budgets and savings goals will appear here.',
} as const;

export type TranslationKey = keyof typeof en;

// Record<TranslationKey, string>: si falta o sobra una clave en español, TypeScript no compila.
const es: Record<TranslationKey, string> = {
  'tabs.today': 'Hoy',
  'tabs.movements': 'Movimientos',
  'tabs.payments': 'Pagos',
  'tabs.plan': 'Plan',
  'today.title': 'Hoy',
  'today.placeholder': 'Aquí aparecerá tu estimación de cuánto puedes gastar hoy.',
  'movements.title': 'Movimientos',
  'movements.placeholder': 'Aquí aparecerán tus ingresos, gastos y transferencias.',
  'payments.title': 'Pagos recurrentes',
  'payments.placeholder': 'Aquí aparecerán tus próximos cargos esperados.',
  'plan.title': 'Plan',
  'plan.placeholder': 'Aquí aparecerán tus presupuestos y metas de ahorro.',
};

export const translations: Record<Language, Record<TranslationKey, string>> = { en, es };
