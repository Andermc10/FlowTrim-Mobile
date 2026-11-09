// Planificador puro de recordatorios locales (HU-89, spec D3): qué avisar y cuándo, sin tocar el teléfono.
// Los recordatorios hablan de cargos ESPERADOS (no pagos) y siguen el reloj del teléfono (spec §9: la zona del
// dispositivo puede no ser la de Bogotá; las insignias siguen a la API, los recordatorios al reloj local).
import type { components } from '@/core/api/schema';
import { formatMoney } from '@/core/format/money';
import { translate } from '@/core/i18n/i18n';
import type { Language } from '@/core/i18n/translations';

type UpcomingCharge = components['schemas']['UpcomingChargeItem'];

/** Hora fija del aviso (spec §12: 09:00 local). */
export const REMINDER_HOUR = 9;
/** Solo pagos que vencen en los próximos 14 días. */
export const REMINDER_WINDOW_DAYS = 14;
/** Android limita las alarmas por app: nunca más de 30, las más cercanas primero. */
export const MAX_REMINDERS = 30;

export interface Reminder {
  /** Estable por pago y momento: reemplazar no duplica. */
  id: string;
  subscriptionId: string;
  at: Date;
  title: string;
  body: string;
}

// Desfase (ms) de la zona en un instante: la hora "de pared" de esa zona leída como UTC, menos el instante.
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - instant
  );
}

/** Instante de las `hour`:00 de una fecha `yyyy-MM-dd` en una zona (dos pasadas: correcto también con horario de verano). */
export function atLocalHour(date: string, hour: number, timeZone: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour);
  const first = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(first, timeZone));
}

/** Fecha `yyyy-MM-dd` de un instante en una zona. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addDays(date: string, delta: number): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type Moment = 'overdue' | 'tomorrow' | 'today';

const titleKeys = {
  overdue: 'reminders.title.overdue',
  tomorrow: 'reminders.title.tomorrow',
  today: 'reminders.title.today',
} as const;

/**
 * Recordatorios a programar ahora. Por cada pago que vence en los próximos 14 días: uno a las 09:00 del día anterior y
 * otro a las 09:00 del día del cobro; los momentos ya pasados se omiten. Un pago vencido recibe uno solo, a las
 * próximas 09:00. Máximo 30, los más cercanos primero.
 */
export function planReminders(
  upcoming: readonly UpcomingCharge[],
  now: Date,
  timeZone: string,
  language: Language,
): Reminder[] {
  const today = localDate(now, timeZone);
  const reminders: Reminder[] = [];

  const add = (charge: UpcomingCharge, date: string, moment: Moment) => {
    const at = atLocalHour(date, REMINDER_HOUR, timeZone);
    if (at.getTime() <= now.getTime()) {
      return;
    }
    reminders.push({
      id: `${charge.id}:${date}:${moment}`,
      subscriptionId: charge.id,
      at,
      title: translate(language, titleKeys[moment]),
      // El importe solo va en el cuerpo: el canal es PRIVADO y Android lo oculta en la pantalla de bloqueo.
      body: translate(language, 'reminders.body', {
        name: charge.name,
        amount: formatMoney(charge.amount, charge.currency, language),
      }),
    });
  };

  for (const charge of upcoming) {
    const days = daysBetween(today, charge.nextBillingDate);
    if (days < 0) {
      // Vencido: un solo aviso a las próximas 09:00 (hoy si aún no pasan, si no mañana).
      const todayAt = atLocalHour(today, REMINDER_HOUR, timeZone);
      add(charge, todayAt.getTime() > now.getTime() ? today : addDays(today, 1), 'overdue');
    } else if (days <= REMINDER_WINDOW_DAYS) {
      add(charge, addDays(charge.nextBillingDate, -1), 'tomorrow');
      add(charge, charge.nextBillingDate, 'today');
    }
  }

  return reminders
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id))
    .slice(0, MAX_REMINDERS);
}
