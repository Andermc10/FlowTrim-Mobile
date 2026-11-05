import { AppConfigError, parseAppConfig, type RawAppConfig } from './app-config';

// Valores ficticios: las pruebas nunca usan el tenant ni la API reales.
const valid: RawAppConfig = {
  apiUrl: 'https://api.example.test',
  auth0Domain: 'tenant.example.test',
  auth0ClientId: 'test-client-id',
  auth0Audience: 'https://api.example.test',
};

describe('parseAppConfig', () => {
  it('parseAppConfig_ValidHttpsInRelease_ReturnsConfig', () => {
    expect(parseAppConfig(valid, { isDevelopment: false })).toEqual(valid);
  });

  it('parseAppConfig_TrailingSlash_IsRemoved', () => {
    const config = parseAppConfig(
      { ...valid, apiUrl: 'https://api.example.test/' },
      { isDevelopment: false },
    );
    expect(config.apiUrl).toBe('https://api.example.test');
  });

  it('parseAppConfig_HttpInRelease_Throws', () => {
    expect(() =>
      parseAppConfig({ ...valid, apiUrl: 'http://192.168.1.20:5214' }, { isDevelopment: false }),
    ).toThrow('EXPO_PUBLIC_API_URL must use https');
  });

  it('parseAppConfig_HttpInDevelopment_IsAllowedForTheLanApi', () => {
    const config = parseAppConfig({ ...valid, apiUrl: 'http://192.168.1.20:5214' }, { isDevelopment: true });
    expect(config.apiUrl).toBe('http://192.168.1.20:5214');
  });

  it('parseAppConfig_OtherProtocol_Throws', () => {
    expect(() =>
      parseAppConfig({ ...valid, apiUrl: 'ftp://api.example.test' }, { isDevelopment: true }),
    ).toThrow(AppConfigError);
  });

  it('parseAppConfig_CredentialsInUrl_Throws', () => {
    expect(() =>
      parseAppConfig({ ...valid, apiUrl: 'https://user:secret@api.example.test' }, { isDevelopment: false }),
    ).toThrow('must not contain credentials');
  });

  it('parseAppConfig_InvalidUrl_Throws', () => {
    expect(() => parseAppConfig({ ...valid, apiUrl: 'not a url' }, { isDevelopment: true })).toThrow(
      'is not a valid URL',
    );
  });

  it('parseAppConfig_MissingValues_NamesVariablesWithoutPrintingValues', () => {
    const run = () =>
      parseAppConfig({ ...valid, auth0ClientId: ' ', auth0Domain: undefined }, { isDevelopment: true });
    expect(run).toThrow('Missing configuration: EXPO_PUBLIC_AUTH0_DOMAIN, EXPO_PUBLIC_AUTH0_CLIENT_ID');
    expect(run).not.toThrow(/api\.example\.test/);
  });
});
