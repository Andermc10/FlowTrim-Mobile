// Traducción de respuestas HTTP fallidas a un error tipado que las pantallas pueden mostrar sin conocer HTTP.
// Regla de seguridad: nunca se guarda el cuerpo crudo ni trazas; solo campos conocidos de ProblemDetails.

export type ApiErrorKind =
  | 'validation' // 400 con errores por campo
  | 'badRequest' // 400/413 sin campos (p. ej. un code de negocio)
  | 'unauthorized' // 401: sesión vencida o ausente
  | 'forbidden' // 403: token sin sub
  | 'notFound' // 404: no existe o es de otro usuario (la API no distingue)
  | 'conflict' // 409 con code (p. ej. goal_saved_negative)
  | 'rateLimited' // 429
  | 'server' // 5xx
  | 'network'; // sin respuesta: sin señal, DNS, servidor caído

export interface ApiErrorDetails {
  kind: ApiErrorKind;
  status?: number;
  /** Código estable de negocio enviado por la API (`code` en ProblemDetails). */
  code?: string;
  /** Errores por campo (camelCase, como los envía la API). */
  fieldErrors?: Record<string, string[]>;
  /** Segundos de espera sugeridos por `Retry-After`. */
  retryAfterSeconds?: number;
  /** Referencia para soporte (`correlationId` o cabecera `X-Correlation-ID`, HU-41). */
  correlationId?: string;
}

export class ApiError extends Error implements ApiErrorDetails {
  override name = 'ApiError';
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
  correlationId?: string;

  constructor(details: ApiErrorDetails) {
    // El mensaje técnico solo sirve para depurar; la UI usa errorMessageKey().
    super(`API error: ${details.kind}${details.status ? ` (${details.status})` : ''}`);
    this.kind = details.kind;
    this.status = details.status;
    this.code = details.code;
    this.fieldErrors = details.fieldErrors;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.correlationId = details.correlationId;
  }
}

// Mismo criterio que la API para aceptar un id de correlación: corto y sin caracteres raros (no se muestra basura).
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._-]{1,64}$/;

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const result: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const texts = messages.filter((message): message is string => typeof message === 'string');
      if (texts.length > 0) {
        result[field] = texts;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// Retry-After puede venir en segundos ("30") o como fecha HTTP; nunca menos de 1 segundo.
export function parseRetryAfter(
  value: string | null | undefined,
  now: Date = new Date(),
): number | undefined {
  if (!value) {
    return undefined;
  }
  if (/^\d+$/.test(value.trim())) {
    return Math.max(1, Number(value.trim()));
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(1, Math.ceil((date - now.getTime()) / 1000));
}

// Regla pura: estado + cuerpo (ya parseado o null) + cabeceras → error tipado.
export function toApiError(
  status: number,
  body: unknown,
  headers: Headers,
  now: Date = new Date(),
): ApiError {
  const problem = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const rawCorrelationId = readString(problem.correlationId) ?? headers.get('X-Correlation-ID') ?? undefined;
  const correlationId =
    rawCorrelationId && SAFE_CORRELATION_ID.test(rawCorrelationId) ? rawCorrelationId : undefined;
  const code = readString(problem.code);
  const base = { status, code, correlationId };

  if (status === 400 || status === 413) {
    const fieldErrors = readFieldErrors(problem.errors);
    return new ApiError(
      fieldErrors ? { ...base, kind: 'validation', fieldErrors } : { ...base, kind: 'badRequest' },
    );
  }
  if (status === 401) {
    return new ApiError({ ...base, kind: 'unauthorized' });
  }
  if (status === 403) {
    return new ApiError({ ...base, kind: 'forbidden' });
  }
  if (status === 404) {
    return new ApiError({ ...base, kind: 'notFound' });
  }
  if (status === 409) {
    return new ApiError({ ...base, kind: 'conflict' });
  }
  if (status === 429) {
    return new ApiError({
      ...base,
      kind: 'rateLimited',
      retryAfterSeconds: parseRetryAfter(headers.get('Retry-After'), now),
    });
  }
  // Cualquier otro estado (5xx o inesperado) se trata como fallo del servidor, con referencia si la hay.
  return new ApiError({ ...base, kind: 'server' });
}

export function networkError(): ApiError {
  return new ApiError({ kind: 'network' });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
