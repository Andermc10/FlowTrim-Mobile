import { DEFAULT_PREFERENCES, parsePreferences } from './preferences';

describe('parsePreferences', () => {
  it('parsePreferences_Valid_ReturnsValues', () => {
    expect(parsePreferences('{"language":"es","theme":"light"}')).toEqual({ language: 'es', theme: 'light' });
  });

  it.each([null, '', '{broken', '"text"'])('parsePreferences_Missing_ReturnsDefaults (%s)', (raw) => {
    expect(parsePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
  });

  it('parsePreferences_UnknownValues_FallBackPerField', () => {
    expect(parsePreferences('{"language":"fr","theme":"neon"}')).toEqual({
      language: undefined,
      theme: 'system',
    });
  });

  it('parsePreferences_OnlyTheme_KeepsDeviceLanguage', () => {
    expect(parsePreferences('{"theme":"dark"}')).toEqual({ language: undefined, theme: 'dark' });
  });
});
