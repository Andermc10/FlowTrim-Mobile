import { pickLanguage, translate } from './i18n';
import { translations } from './translations';

describe('translations', () => {
  // Doble seguro además del tipo: atrapa claves vacías o añadidas con "as any".
  it('translations_EnglishAndSpanish_HaveTheSameKeys', () => {
    expect(Object.keys(translations.es).sort()).toEqual(Object.keys(translations.en).sort());
  });

  it.each(['en', 'es'] as const)('translations_%s_HasNoEmptyText', (language) => {
    for (const text of Object.values(translations[language])) {
      expect(text.trim()).not.toBe('');
    }
  });
});

describe('pickLanguage', () => {
  it('pickLanguage_SpanishDevice_ReturnsSpanish', () => {
    expect(pickLanguage(['es'])).toBe('es');
  });

  it('pickLanguage_UnsupportedFirstThenSpanish_ReturnsSpanish', () => {
    expect(pickLanguage(['pt', 'es', 'en'])).toBe('es');
  });

  it('pickLanguage_NoSupportedLanguage_FallsBackToEnglish', () => {
    expect(pickLanguage(['fr', null])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });
});

describe('translate', () => {
  it('translate_SpanishKey_ReturnsSpanishText', () => {
    expect(translate('es', 'tabs.payments')).toBe('Pagos');
  });
});
