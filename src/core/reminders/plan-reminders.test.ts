import { chargeFixture } from '@/testing/payments-fixtures';

import { MAX_REMINDERS, atLocalHour, localDate, planReminders } from './plan-reminders';

const BOGOTA = 'America/Bogota';
// 2026-11-06 en Bogotá (UTC−5): 08:00 = 13:00 UTC; 10:00 = 15:00 UTC.
const at8 = new Date('2026-11-06T13:00:00Z');
const at10 = new Date('2026-11-06T15:00:00Z');
const iso = (date: Date) => date.toISOString();

describe('planReminders', () => {
  it('planReminders_DueTomorrowAt0800_SchedulesTodayAndTomorrowAt0900', () => {
    const reminders = planReminders([chargeFixture({ nextBillingDate: '2026-11-07' })], at8, BOGOTA, 'en');

    expect(reminders.map((reminder) => iso(reminder.at))).toEqual([
      '2026-11-06T14:00:00.000Z',
      '2026-11-07T14:00:00.000Z',
    ]);
    expect(reminders[0]).toMatchObject({ title: 'Expected charge tomorrow', subscriptionId: 'sub-netflix' });
    expect(reminders[0]!.body).toMatch(/^Streaming · COP[\s ]38,900$/);
    expect(reminders[1]!.title).toBe('Expected charge today');
  });

  it('planReminders_DueTomorrowAt1000_PastMomentIsSkipped', () => {
    const reminders = planReminders([chargeFixture({ nextBillingDate: '2026-11-07' })], at10, BOGOTA, 'en');
    expect(reminders.map((reminder) => [iso(reminder.at), reminder.title])).toEqual([
      ['2026-11-07T14:00:00.000Z', 'Expected charge today'],
    ]);
  });

  it('planReminders_Overdue_SingleReminderAtTheNext0900', () => {
    const overdue = chargeFixture({
      nextBillingDate: '2026-11-03',
      daysUntilCharge: -3,
      alertWindow: 'Overdue',
    });

    const before = planReminders([overdue], at8, BOGOTA, 'es');
    expect(before.map((reminder) => [iso(reminder.at), reminder.title])).toEqual([
      ['2026-11-06T14:00:00.000Z', 'Cargo esperado vencido'],
    ]);
    const after = planReminders([overdue], at10, BOGOTA, 'es');
    expect(after.map((reminder) => iso(reminder.at))).toEqual(['2026-11-07T14:00:00.000Z']);
  });

  it('planReminders_OutsideFourteenDays_IsIgnored', () => {
    expect(planReminders([chargeFixture({ nextBillingDate: '2026-11-20' })], at8, BOGOTA, 'en')).toHaveLength(
      2,
    );
    expect(planReminders([chargeFixture({ nextBillingDate: '2026-11-21' })], at8, BOGOTA, 'en')).toEqual([]);
  });

  it('planReminders_OnlyChargesInTheUpcomingList_AreScheduled', () => {
    // Las inactivas (y los planes completados) no vienen en GET /api/subscriptions/upcoming: nada que avisar.
    expect(planReminders([], at8, BOGOTA, 'en')).toEqual([]);
  });

  it('planReminders_ManyPayments_CapsAtThirtyClosestFirst', () => {
    const charges = Array.from({ length: 20 }, (_, index) =>
      chargeFixture({
        id: `sub-${index}`,
        nextBillingDate: `2026-11-${String(8 + (index % 10)).padStart(2, '0')}`,
      }),
    );
    const reminders = planReminders(charges, at8, BOGOTA, 'en');

    expect(reminders).toHaveLength(MAX_REMINDERS);
    const times = reminders.map((reminder) => reminder.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // Los descartados son los más lejanos.
    expect(iso(reminders.at(-1)!.at) <= '2026-11-17T14:00:00.000Z').toBe(true);
  });

  it('planReminders_Spanish_UsesSpanishTextAndMoneyFormat', () => {
    const [first] = planReminders([chargeFixture({ nextBillingDate: '2026-11-07' })], at8, BOGOTA, 'es');
    expect(first!.title).toBe('Cargo esperado mañana');
    expect(first!.body).toMatch(/^Streaming · \$[\s ]38\.900$/);
  });

  it('planReminders_SameInputs_GiveStableIdsSoReplacingNeverDuplicates', () => {
    const charges = [chargeFixture({ nextBillingDate: '2026-11-07' })];
    expect(planReminders(charges, at8, BOGOTA, 'en').map((r) => r.id)).toEqual(
      planReminders(charges, at8, BOGOTA, 'en').map((r) => r.id),
    );
  });
});

describe('time zone helpers', () => {
  it('atLocalHour_ZoneWithDaylightSaving_UsesTheOffsetOfThatDay', () => {
    // Nueva York: UTC−4 en verano, UTC−5 en invierno (el cambio fue el 1 de noviembre de 2026).
    expect(iso(atLocalHour('2026-10-30', 9, 'America/New_York'))).toBe('2026-10-30T13:00:00.000Z');
    expect(iso(atLocalHour('2026-11-02', 9, 'America/New_York'))).toBe('2026-11-02T14:00:00.000Z');
    expect(iso(atLocalHour('2026-11-06', 9, BOGOTA))).toBe('2026-11-06T14:00:00.000Z');
  });

  it('localDate_LateEveningInBogota_IsStillThatDay', () => {
    expect(localDate(new Date('2026-11-07T03:30:00Z'), BOGOTA)).toBe('2026-11-06');
  });
});
