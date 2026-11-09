// Calendario del producto: la misma zona que usa la API para decidir qué es "hoy" (HU-04, HU-56).
// Igual que FlowTrim-frontend core/format/product-calendar.ts y transaction-days.ts.
import type { Language } from '@/core/i18n/translations';

import { localeFor } from './money';

export const productTimeZone = 'America/Bogota';

/** Fecha de hoy (`yyyy-MM-dd`) en el calendario del producto, sin importar la zona del teléfono. */
export function productToday(now: Date = new Date()): string {
  // formatToParts evita depender de cómo cada motor (Hermes, Node) ordena la fecha en un locale.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: productTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Fecha `yyyy-MM-dd` desplazada `delta` días (aritmética en UTC: sin saltos por horario de verano). */
export function shiftDays(date: string, delta: number): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

/** Mes `yyyy-MM` de una fecha `yyyy-MM-dd`. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Primer y último día (inclusivos) de un mes `yyyy-MM`, como espera el filtro de la API. */
export function monthRange(month: string): { from: string; to: string } {
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  // Día 0 del mes siguiente = último día de este mes.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** Mes `yyyy-MM` desplazado `delta` meses. */
export function shiftMonth(month: string, delta: number): string {
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Título del mes ("November 2026" / "Noviembre de 2026"). Solo se pone en mayúscula la primera letra: capitalizar cada
 * palabra daba "Noviembre De 2026" en la web (EP-11).
 */
export function monthTitle(month: string, language: Language): string {
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  const text = new Intl.DateTimeFormat(localeFor(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return text.charAt(0).toLocaleUpperCase(localeFor(language)) + text.slice(1);
}

/** `yyyy-MM-dd` real (formato y fecha existente: rechaza 2026-02-30). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
