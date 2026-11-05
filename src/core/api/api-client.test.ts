import { createApiClient, unwrap } from './api-client';
import { ApiError } from './api-error';
import { shouldRetryQuery } from './query-client';

const BASE_URL = 'https://api.example.test';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function setup(response: Response | Error, token: string | null = 'test-token') {
  const fetchMock = jest.fn(async (_request: Request) => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  });
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseUrl: BASE_URL,
    getAccessToken: async () => token,
    getLanguage: () => 'es',
    onUnauthorized,
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { client, fetchMock, onUnauthorized };
}

describe('createApiClient', () => {
  it('request_WithSession_SendsBearerTokenAndLanguage', async () => {
    const { client, fetchMock } = setup(jsonResponse(200, []));

    await unwrap(client.GET('/api/accounts'));

    const request = fetchMock.mock.calls[0]![0];
    expect(request.url).toBe(`${BASE_URL}/api/accounts`);
    expect(request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.headers.get('Accept-Language')).toBe('es');
  });

  it('request_WithoutSession_SendsNoAuthorizationHeader', async () => {
    const { client, fetchMock } = setup(jsonResponse(200, []), null);

    await unwrap(client.GET('/api/accounts'));

    expect(fetchMock.mock.calls[0]![0].headers.has('Authorization')).toBe(false);
  });

  it('unwrap_Success_ReturnsTypedData', async () => {
    const { client } = setup(jsonResponse(200, [{ id: '1', name: 'Bank' }]));

    const accounts = await unwrap(client.GET('/api/accounts'));

    expect(accounts[0]?.name).toBe('Bank');
  });

  it('unwrap_401_ThrowsUnauthorizedAndNotifiesSession', async () => {
    const { client, onUnauthorized } = setup(jsonResponse(401, null));

    await expect(unwrap(client.GET('/api/accounts'))).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('unwrap_500WithCorrelationId_ThrowsServerErrorWithReference', async () => {
    const { client } = setup(jsonResponse(500, { title: 'An error occurred.', correlationId: 'ref-500' }));

    await expect(unwrap(client.GET('/api/dashboard/today'))).rejects.toMatchObject({
      kind: 'server',
      status: 500,
      correlationId: 'ref-500',
    });
  });

  it('unwrap_NetworkFailure_ThrowsNetworkError', async () => {
    const { client } = setup(new TypeError('Network request failed'));

    await expect(unwrap(client.GET('/api/accounts'))).rejects.toMatchObject({ kind: 'network' });
  });

  it('unwrap_Abort_RethrowsAbortError', async () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    const { client } = setup(abort);

    await expect(unwrap(client.GET('/api/accounts'))).rejects.toBe(abort);
  });
});

describe('shouldRetryQuery', () => {
  it.each(['network', 'server'] as const)('shouldRetryQuery_%sOnFirstFailure_ReturnsTrue', (kind) => {
    expect(shouldRetryQuery(0, new ApiError({ kind }))).toBe(true);
  });

  it.each(['validation', 'unauthorized', 'notFound', 'conflict', 'rateLimited'] as const)(
    'shouldRetryQuery_%s_ReturnsFalse',
    (kind) => {
      expect(shouldRetryQuery(0, new ApiError({ kind }))).toBe(false);
    },
  );

  it('shouldRetryQuery_AfterTwoFailures_ReturnsFalse', () => {
    expect(shouldRetryQuery(2, new ApiError({ kind: 'network' }))).toBe(false);
  });
});
