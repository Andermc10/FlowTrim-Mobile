// Cliente HTTP único de la app, tipado con el contrato OpenAPI (schema.d.ts generado).
// Las pantallas nunca llaman a fetch directamente: usan hooks de su feature sobre este cliente (spec §13).
import createClient, { type Middleware } from 'openapi-fetch';

import { networkError, toApiError } from './api-error';
import type { paths } from './schema';

export interface ApiClientOptions {
  baseUrl: string;
  /** Devuelve el access token vigente o null sin sesión (lo provee la autenticación, HU-83). */
  getAccessToken: () => Promise<string | null>;
  /** Idioma de la interfaz: la API lo usa para las categorías por defecto (HU-65). */
  getLanguage: () => string;
  /** Se llama ante un 401 para cerrar la sesión local (HU-83). */
  onUnauthorized?: () => void;
  /** Inyectable para pruebas; por defecto el fetch global. */
  fetch?: typeof fetch;
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: options.fetch });

  const headers: Middleware = {
    async onRequest({ request }) {
      const token = await options.getAccessToken();
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      request.headers.set('Accept-Language', options.getLanguage());
      request.headers.set('Accept', 'application/json');
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) {
        options.onUnauthorized?.();
      }
      return response;
    },
  };

  client.use(headers);
  return client;
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

// Convierte el resultado de openapi-fetch en datos o en ApiError: los hooks (TanStack Query) solo ven éxito o throw.
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch (error) {
    // Cancelación (pantalla cerrada, TanStack Query): se relanza tal cual para que no se muestre como error.
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw networkError();
  }
  if (!result.response.ok) {
    throw toApiError(result.response.status, result.error ?? null, result.response.headers);
  }
  // 204 no trae cuerpo: openapi-fetch devuelve undefined y el tipo T del endpoint ya lo refleja.
  return result.data as T;
}
