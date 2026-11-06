import {
  emailFromIdToken,
  needsRefresh,
  parseStoredSession,
  REFRESH_MARGIN_MS,
  sessionFromTokenResponse,
  type StoredSession,
} from './session';
import { createTokenManager, SessionExpiredError, type TokenStorage } from './token-manager';

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

// Tokens ficticios: las pruebas nunca usan tokens reales.
const fresh: StoredSession = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: NOW + 3_600_000,
};
const nearExpiry: StoredSession = { ...fresh, expiresAt: NOW + 30_000 };

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: TokenStorage & { value: () => string | null } = {
    load: jest.fn(async () => value),
    save: jest.fn(async (next: string) => {
      value = next;
    }),
    clear: jest.fn(async () => {
      value = null;
    }),
    value: () => value,
  };
  return storage;
}

function setup(
  stored: StoredSession | null,
  refresh: (session: StoredSession) => Promise<StoredSession> = jest.fn(async () => fresh),
) {
  const storage = memoryStorage(stored ? JSON.stringify(stored) : null);
  const onExpired = jest.fn();
  const manager = createTokenManager({ storage, refresh, now: () => NOW, onExpired });
  return { manager, storage, refresh, onExpired };
}

describe('session rules', () => {
  it('sessionFromTokenResponse_WithExpiresIn_ComputesExpiry', () => {
    const session = sessionFromTokenResponse(
      { accessToken: 'a', refreshToken: 'r', expiresIn: 86400, issuedAt: NOW / 1000 },
      NOW,
    );
    expect(session.expiresAt).toBe(NOW + 86_400_000);
  });

  it('sessionFromTokenResponse_WithoutNewRefreshToken_KeepsPrevious', () => {
    expect(
      sessionFromTokenResponse({ accessToken: 'a', expiresIn: 60 }, NOW, { refreshToken: 'old-refresh' })
        .refreshToken,
    ).toBe('old-refresh');
  });

  it('sessionFromTokenResponse_WithoutExpiresIn_IsAlreadyExpired', () => {
    expect(needsRefresh(sessionFromTokenResponse({ accessToken: 'a' }, NOW), NOW)).toBe(true);
  });

  it('needsRefresh_InsideMargin_ReturnsTrue', () => {
    expect(needsRefresh({ ...fresh, expiresAt: NOW + REFRESH_MARGIN_MS - 1 }, NOW)).toBe(true);
    expect(needsRefresh({ ...fresh, expiresAt: NOW + REFRESH_MARGIN_MS + 1 }, NOW)).toBe(false);
  });

  it.each([
    null,
    '',
    'not json',
    '{"accessToken":""}',
    '{"accessToken":"a"}',
    '{"accessToken":"a","expiresAt":1,"refreshToken":5}',
  ])('parseStoredSession_InvalidValue_ReturnsNull (%s)', (raw) => {
    expect(parseStoredSession(raw)).toBeNull();
  });
});

describe('createTokenManager', () => {
  it('restore_ValidStoredSession_ReturnsIt', async () => {
    const { manager } = setup(fresh);
    await expect(manager.restore()).resolves.toEqual(fresh);
  });

  it('restore_CorruptedValue_ReturnsNullAndClearsStorage', async () => {
    const storage = memoryStorage('{broken');
    const manager = createTokenManager({ storage, refresh: jest.fn(), now: () => NOW, onExpired: jest.fn() });

    await expect(manager.restore()).resolves.toBeNull();
    expect(storage.clear).toHaveBeenCalled();
  });

  it('getAccessToken_FreshToken_DoesNotRefresh', async () => {
    const { manager, refresh } = setup(fresh);
    await manager.restore();

    await expect(manager.getAccessToken()).resolves.toBe('access-1');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('getAccessToken_NoSession_ReturnsNull', async () => {
    const { manager } = setup(null);
    await manager.restore();
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });

  it('getAccessToken_NearExpiry_RefreshesAndPersistsNewTokens', async () => {
    const renewed = { accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: NOW + 3_600_000 };
    const { manager, storage } = setup(
      nearExpiry,
      jest.fn(async () => renewed),
    );
    await manager.restore();

    await expect(manager.getAccessToken()).resolves.toBe('access-2');
    expect(parseStoredSession(storage.value())).toEqual(renewed);
  });

  it('getAccessToken_ConcurrentCallsNearExpiry_RefreshOnlyOnce', async () => {
    const { manager, refresh } = setup(nearExpiry);
    await manager.restore();

    const tokens = await Promise.all([
      manager.getAccessToken(),
      manager.getAccessToken(),
      manager.getAccessToken(),
    ]);

    expect(tokens).toEqual(['access-1', 'access-1', 'access-1']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('getAccessToken_RefreshTokenRejected_ExpiresSessionAndClearsStorage', async () => {
    const refresh = jest.fn(async () => {
      throw new SessionExpiredError('invalid_grant');
    });
    const { manager, storage, onExpired } = setup(nearExpiry, refresh);
    await manager.restore();

    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(storage.value()).toBeNull();
  });

  it('getAccessToken_RefreshWithoutNetwork_KeepsSessionAndRethrows', async () => {
    const offline = new TypeError('Network request failed');
    const { manager, storage, onExpired } = setup(
      nearExpiry,
      jest.fn(async () => Promise.reject(offline)),
    );
    await manager.restore();

    await expect(manager.getAccessToken()).rejects.toBe(offline);
    expect(onExpired).not.toHaveBeenCalled();
    expect(parseStoredSession(storage.value())).toEqual(nearExpiry);
  });

  it('getAccessToken_ExpiredWithoutRefreshToken_ExpiresSession', async () => {
    const { manager, onExpired } = setup({ accessToken: 'a', expiresAt: NOW - 1 });
    await manager.restore();

    await expect(manager.getAccessToken()).resolves.toBeNull();
    expect(onExpired).toHaveBeenCalled();
  });

  it('clear_AfterSignIn_RemovesStoredTokens', async () => {
    const { manager, storage } = setup(null);
    await manager.setSession(fresh);

    await manager.clear();

    expect(storage.value()).toBeNull();
    await expect(manager.getAccessToken()).resolves.toBeNull();
  });
});

describe('emailFromIdToken', () => {
  // JWT de prueba sin firma real: { "email": "ana.muñoz@example.test" } en base64url.
  const encode = (claims: object) =>
    // UTF-8 → bytes → base64 (como hace Auth0), sin depender de Buffer de Node.
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(claims))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const idToken = (claims: object) => `header.${encode(claims)}.signature`;

  it('emailFromIdToken_ValidToken_ReturnsEmailWithAccents', () => {
    expect(emailFromIdToken(idToken({ email: 'ana.muñoz@example.test' }))).toBe('ana.muñoz@example.test');
  });

  it.each([undefined, '', 'not-a-jwt', 'a.%%%.c'])(
    'emailFromIdToken_Invalid_ReturnsUndefined (%s)',
    (token) => {
      expect(emailFromIdToken(token)).toBeUndefined();
    },
  );

  it('emailFromIdToken_NoEmailClaim_ReturnsUndefined', () => {
    expect(emailFromIdToken(idToken({ sub: 'auth0|x' }))).toBeUndefined();
  });

  it('sessionFromTokenResponse_RefreshWithoutIdToken_KeepsPreviousEmail', () => {
    const session = sessionFromTokenResponse({ accessToken: 'a', expiresIn: 60 }, NOW, {
      email: 'a@example.test',
    });
    expect(session.email).toBe('a@example.test');
  });
});
