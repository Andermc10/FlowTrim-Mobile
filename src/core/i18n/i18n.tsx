// Proveedor de idioma: elige inglés o español y entrega la función t() para traducir.
import { getLocales } from 'expo-localization';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { translations, type Language, type TranslationKey } from './translations';

// Regla pura: el primer idioma del teléfono que soportamos gana; si ninguno, inglés.
export function pickLanguage(deviceLanguageCodes: readonly (string | null)[]): Language {
  for (const code of deviceLanguageCodes) {
    if (code === 'es' || code === 'en') {
      return code;
    }
  }
  return 'en';
}

export type TranslationParams = Record<string, string | number>;

// Reemplaza {nombre} por su valor; un marcador sin valor se deja visible para detectarlo en pruebas.
export function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  const text = translations[language][key];
  if (!params) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (marker, name: string) =>
    name in params ? String(params[name]) : marker,
  );
}

interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  // El valor inicial se calcula una sola vez (función en useState), no en cada render.
  const [language, setLanguage] = useState<Language>(
    () => initialLanguage ?? pickLanguage(getLocales().map((locale) => locale.languageCode)),
  );

  const value = useMemo<I18n>(
    () => ({ language, setLanguage, t: (key, params) => translate(language, key, params) }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return value;
}
