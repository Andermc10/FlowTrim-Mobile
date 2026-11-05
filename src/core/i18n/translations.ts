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
  'errors.validation': 'Check the highlighted fields.',
  'errors.badRequest': 'The request could not be processed.',
  'errors.unauthorized': 'Your session expired. Sign in again.',
  'errors.forbidden': 'Your account cannot do this.',
  'errors.notFound': 'This item no longer exists.',
  'errors.conflict': 'This change conflicts with your current data.',
  'errors.rateLimited': 'Too many requests. Try again in {seconds} s.',
  'errors.rateLimitedNoWait': 'Too many requests. Try again in a moment.',
  'errors.server': 'Something went wrong on our side. Try again.',
  'errors.network': 'No connection to FlowTrim. Check your internet and try again.',
  'errors.reference': 'Reference: {id}',
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
  'errors.validation': 'Revisa los campos marcados.',
  'errors.badRequest': 'No se pudo procesar la solicitud.',
  'errors.unauthorized': 'Tu sesión expiró. Inicia sesión de nuevo.',
  'errors.forbidden': 'Tu cuenta no puede hacer esto.',
  'errors.notFound': 'Este elemento ya no existe.',
  'errors.conflict': 'Este cambio choca con tus datos actuales.',
  'errors.rateLimited': 'Demasiadas solicitudes. Intenta de nuevo en {seconds} s.',
  'errors.rateLimitedNoWait': 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
  'errors.server': 'Algo falló de nuestro lado. Intenta de nuevo.',
  'errors.network': 'Sin conexión con FlowTrim. Revisa tu internet e intenta de nuevo.',
  'errors.reference': 'Referencia: {id}',
};

export const translations: Record<Language, Record<TranslationKey, string>> = { en, es };
