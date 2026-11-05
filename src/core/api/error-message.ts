// Mensaje para el usuario a partir de cualquier error (ApiError u otro): clave de traducción, parámetros y referencia.
import type { TranslationParams } from '@/core/i18n/i18n';
import type { TranslationKey } from '@/core/i18n/translations';

import { isApiError } from './api-error';

export interface ErrorMessage {
  key: TranslationKey;
  params?: TranslationParams;
  /** Solo para fallos inesperados (servidor/desconocido): el usuario la da a soporte; nunca se muestran detalles. */
  reference?: string;
}

export function errorMessage(error: unknown): ErrorMessage {
  if (!isApiError(error)) {
    // Error de programación o de librería: mensaje genérico, sin filtrar su texto técnico.
    return { key: 'errors.server' };
  }
  switch (error.kind) {
    case 'validation':
      return { key: 'errors.validation' };
    case 'badRequest':
      return { key: 'errors.badRequest', reference: error.correlationId };
    case 'unauthorized':
      return { key: 'errors.unauthorized' };
    case 'forbidden':
      return { key: 'errors.forbidden' };
    case 'notFound':
      return { key: 'errors.notFound' };
    case 'conflict':
      return { key: 'errors.conflict' };
    case 'rateLimited':
      return error.retryAfterSeconds
        ? { key: 'errors.rateLimited', params: { seconds: error.retryAfterSeconds } }
        : { key: 'errors.rateLimitedNoWait' };
    case 'server':
      return { key: 'errors.server', reference: error.correlationId };
    case 'network':
      return { key: 'errors.network' };
  }
}
