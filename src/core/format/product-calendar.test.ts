import {
  isIsoDate,
  monthOf,
  monthRange,
  monthTitle,
  productToday,
  shiftDays,
  shiftMonth,
} from './product-calendar';

describe('product calendar', () => {
  it('productToday_LateEveningInBogota_IsStillTheBogotaDay', () => {
    // 2026-11-07 03:30 UTC = 2026-11-06 22:30 en Bogotá (UTC−5).
    expect(productToday(new Date('2026-11-07T03:30:00Z'))).toBe('2026-11-06');
    expect(productToday(new Date('2026-11-07T05:00:00Z'))).toBe('2026-11-07');
  });

  it('shiftDays_AcrossMonthAndYear_ReturnsIsoDate', () => {
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDays('2026-11-06', -89)).toBe('2026-08-09');
  });

  it('monthRange_LeapAndShortMonths_EndOnTheirLastDay', () => {
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthOf('2026-11-06')).toBe('2026-11');
  });

  it('shiftMonth_AcrossYears_ReturnsYearMonth', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('monthTitle_Spanish_CapitalizesOnlyTheFirstLetter', () => {
    expect(monthTitle('2026-11', 'es')).toBe('Noviembre de 2026');
    expect(monthTitle('2026-11', 'en')).toBe('November 2026');
  });

  it('isIsoDate_ImpossibleOrMalformedDates_AreRejected', () => {
    expect(isIsoDate('2026-11-06')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('06/11/2026')).toBe(false);
    expect(isIsoDate('2026-1-6')).toBe(false);
  });
});
