import { ApiError, parseRetryAfter, toApiError } from './api-error';
import { errorMessage } from './error-message';

const noHeaders = new Headers();

describe('toApiError', () => {
  it('toApiError_400WithFieldErrors_ReturnsValidationWithFields', () => {
    const error = toApiError(
      400,
      {
        title: 'One or more validation errors occurred.',
        errors: { amount: ['Amount must be greater than 0.'] },
      },
      noHeaders,
    );
    expect(error.kind).toBe('validation');
    expect(error.fieldErrors).toEqual({ amount: ['Amount must be greater than 0.'] });
  });

  it('toApiError_400WithCodeOnly_ReturnsBadRequestWithCode', () => {
    const error = toApiError(400, { code: 'file_required' }, noHeaders);
    expect(error.kind).toBe('badRequest');
    expect(error.code).toBe('file_required');
  });

  it('toApiError_FieldErrorsWithNonStrings_KeepsOnlyTexts', () => {
    const error = toApiError(400, { errors: { amount: [1, 'Required.'], name: [null] } }, noHeaders);
    expect(error.fieldErrors).toEqual({ amount: ['Required.'] });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [500, 'server'],
    [502, 'server'],
    [504, 'server'],
    [418, 'server'],
  ] as const)('toApiError_Status%i_Returns%s', (status, kind) => {
    expect(toApiError(status, null, noHeaders).kind).toBe(kind);
  });

  it('toApiError_409WithCode_ReturnsConflictWithCode', () => {
    const error = toApiError(409, { code: 'goal_saved_negative' }, noHeaders);
    expect(error.kind).toBe('conflict');
    expect(error.code).toBe('goal_saved_negative');
  });

  it('toApiError_429WithRetryAfter_ReturnsSeconds', () => {
    const error = toApiError(429, null, new Headers({ 'Retry-After': '42' }));
    expect(error.kind).toBe('rateLimited');
    expect(error.retryAfterSeconds).toBe(42);
  });

  it('toApiError_500WithCorrelationIdInBody_KeepsReference', () => {
    const error = toApiError(500, { title: 'An error occurred.', correlationId: 'abc-123' }, noHeaders);
    expect(error.kind).toBe('server');
    expect(error.correlationId).toBe('abc-123');
  });

  it('toApiError_500WithCorrelationIdHeaderOnly_UsesHeader', () => {
    const error = toApiError(500, null, new Headers({ 'X-Correlation-ID': 'from-header' }));
    expect(error.correlationId).toBe('from-header');
  });

  it('toApiError_UnsafeCorrelationId_IsDropped', () => {
    const error = toApiError(500, { correlationId: '<script>alert(1)</script>' }, noHeaders);
    expect(error.correlationId).toBeUndefined();
  });

  it('toApiError_RawBody_IsNeverKept', () => {
    const error = toApiError(500, { detail: 'Npgsql stack trace', secret: 'x' }, noHeaders);
    expect(JSON.stringify(error)).not.toContain('Npgsql');
    expect(error.message).toBe('API error: server (500)');
  });
});

describe('parseRetryAfter', () => {
  it('parseRetryAfter_Seconds_ReturnsNumber', () => {
    expect(parseRetryAfter('30')).toBe(30);
  });

  it('parseRetryAfter_Zero_ReturnsAtLeastOne', () => {
    expect(parseRetryAfter('0')).toBe(1);
  });

  it('parseRetryAfter_HttpDate_ReturnsSecondsUntilDate', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    expect(parseRetryAfter('Wed, 04 Nov 2026 12:00:10 GMT', now)).toBe(10);
  });

  it('parseRetryAfter_MissingOrInvalid_ReturnsUndefined', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});

describe('errorMessage', () => {
  it('errorMessage_ServerErrorWithReference_ReturnsGenericTextAndReference', () => {
    const message = errorMessage(new ApiError({ kind: 'server', status: 500, correlationId: 'abc-123' }));
    expect(message).toEqual({ key: 'errors.server', reference: 'abc-123' });
  });

  it('errorMessage_RateLimitedWithWait_PassesSeconds', () => {
    expect(errorMessage(new ApiError({ kind: 'rateLimited', retryAfterSeconds: 12 }))).toEqual({
      key: 'errors.rateLimited',
      params: { seconds: 12 },
    });
  });

  it('errorMessage_RateLimitedWithoutWait_UsesGenericWait', () => {
    expect(errorMessage(new ApiError({ kind: 'rateLimited' })).key).toBe('errors.rateLimitedNoWait');
  });

  it('errorMessage_NotFound_HasNoReference', () => {
    expect(errorMessage(new ApiError({ kind: 'notFound', correlationId: 'x' }))).toEqual({
      key: 'errors.notFound',
    });
  });

  it('errorMessage_UnknownError_ReturnsGenericServerText', () => {
    expect(errorMessage(new TypeError('undefined is not a function'))).toEqual({ key: 'errors.server' });
  });
});
