// Configuración pública de la app, leída de variables EXPO_PUBLIC_* en tiempo de compilación.
// Nada de esto es secreto: dominio y client id de Auth0, audiencia y URL de la API viajan dentro del APK.

export interface AppConfig {
  apiUrl: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0Audience: string;
}

export type RawAppConfig = Record<keyof AppConfig, string | undefined>;

// Nombre de la variable de entorno de cada campo: se usa en los mensajes de error.
const variableNames: Record<keyof AppConfig, string> = {
  apiUrl: 'EXPO_PUBLIC_API_URL',
  auth0Domain: 'EXPO_PUBLIC_AUTH0_DOMAIN',
  auth0ClientId: 'EXPO_PUBLIC_AUTH0_CLIENT_ID',
  auth0Audience: 'EXPO_PUBLIC_AUTH0_AUDIENCE',
};

export class AppConfigError extends Error {
  override name = 'AppConfigError';
}

// Regla pura: valida la configuración. Los mensajes nombran variables, nunca imprimen sus valores.
export function parseAppConfig(raw: RawAppConfig, options: { isDevelopment: boolean }): AppConfig {
  const missing = (Object.keys(variableNames) as (keyof AppConfig)[])
    .filter((key) => !raw[key]?.trim())
    .map((key) => variableNames[key]);
  if (missing.length > 0) {
    throw new AppConfigError(`Missing configuration: ${missing.join(', ')}`);
  }

  const apiUrl = parseApiUrl(raw.apiUrl!.trim(), options.isDevelopment);
  return {
    apiUrl,
    auth0Domain: raw.auth0Domain!.trim(),
    auth0ClientId: raw.auth0ClientId!.trim(),
    auth0Audience: raw.auth0Audience!.trim(),
  };
}

function parseApiUrl(value: string, isDevelopment: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppConfigError('EXPO_PUBLIC_API_URL is not a valid URL');
  }
  // Fuera de desarrollo solo HTTPS: los datos financieros nunca viajan sin cifrar (MASVS-NETWORK).
  const allowedProtocols = isDevelopment ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(url.protocol)) {
    throw new AppConfigError(
      isDevelopment ? 'EXPO_PUBLIC_API_URL must use http or https' : 'EXPO_PUBLIC_API_URL must use https',
    );
  }
  // Credenciales dentro de la URL quedarían expuestas en el APK y en los logs.
  if (url.username || url.password) {
    throw new AppConfigError('EXPO_PUBLIC_API_URL must not contain credentials');
  }
  // Sin barra final: las rutas se concatenan como `${apiUrl}/api/...`.
  return url.origin + url.pathname.replace(/\/+$/, '');
}

let cached: AppConfig | undefined;

// Lee y valida una sola vez. Expo solo incrusta EXPO_PUBLIC_* si se acceden así, de forma literal.
export function getAppConfig(): AppConfig {
  cached ??= parseAppConfig(
    {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      auth0Domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN,
      auth0ClientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID,
      auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
    },
    { isDevelopment: __DEV__ },
  );
  return cached;
}
