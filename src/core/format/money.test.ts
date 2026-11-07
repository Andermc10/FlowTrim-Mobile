import { formatDate, formatMoney, localeFor } from './money';

// Intl usa espacios no separables (U+00A0) entre símbolo y número; se normalizan para comparar.
const plain = (value: string) => value.replace(/ /g, ' ');

describe('formatMoney', () => {
  it('formatMoney_CopInSpanish_HasNoCentsAndDotThousands', () => {
    expect(plain(formatMoney(1234567.89, 'COP', 'es'))).toBe('$ 1.234.568');
  });

  it('formatMoney_UsdInEnglish_HasTwoDecimals', () => {
    expect(formatMoney(1234.5, 'USD', 'en')).toBe('$1,234.50');
  });

  it('formatMoney_Negative_KeepsSign', () => {
    expect(plain(formatMoney(-45000, 'COP', 'es'))).toBe('-$ 45.000');
  });
});

describe('formatDate', () => {
  it('formatDate_MonthEnd_IsNotShiftedByTimeZone', () => {
    expect(formatDate('2026-11-30', 'en')).toBe('Nov 30, 2026');
  });

  it('formatDate_Spanish_UsesSpanishMonth', () => {
    expect(formatDate('2026-11-30', 'es')).toMatch(/30.*nov.*2026/);
  });
});

describe('localeFor', () => {
  it('localeFor_Language_ReturnsSameLocalesAsTheWeb', () => {
    expect(localeFor('es')).toBe('es-CO');
    expect(localeFor('en')).toBe('en-US');
  });
});
