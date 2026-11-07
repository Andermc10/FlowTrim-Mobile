// Formato de montos y fechas, con las mismas reglas que la web (FlowTrim-frontend core/format/money.ts).
// Solo FORMATEA: los importes llegan calculados por el backend y la app nunca hace cuentas con dinero.
import type { Language } from '@/core/i18n/translations';

export function localeFor(language: Language): string {
  return language === 'es' ? 'es-CO' : 'en-US';
}

// Un formateador por combinación (crearlos es costoso y una pantalla formatea decenas de montos).
const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** COP sin decimales (en la práctica no se usan centavos); el resto con 2. */
export function formatMoney(value: number, currency: string, language: Language): string {
  const locale = localeFor(language);
  const key = `${locale}|${currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'COP' ? 0 : 2,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/**
 * Fecha `yyyy-MM-dd` legible ("Nov 30, 2026" / "30 nov 2026"), sin desfase por zona horaria. El mes va en letras de
 * forma explícita: con dateStyle 'medium' algunos datos de idioma dan "30/11/2026", ambiguo entre países.
 */
export function formatDate(date: string, language: Language): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  // UTC en ambos lados: "2026-11-30" nunca se muestra como 29 por estar en UTC−5.
  return new Intl.DateTimeFormat(localeFor(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
