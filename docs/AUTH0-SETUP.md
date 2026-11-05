# Auth0 setup for the mobile app (HU-83)

The mobile app signs in with **OAuth 2.0 for native apps (RFC 8252)**: Authorization Code + PKCE (S256) in the system
browser (Android Custom Tabs). It has **no client secret** and never sees the user's password. It uses the same tenant
and API audience as the web app, so the token `sub` — and therefore the user's data — is the same on both.

## 1. Create the Native application

Auth0 Dashboard → **Applications → Applications → Create Application** → name `FlowTrim Mobile`, type **Native**.

In **Settings**:

| Field                      | Value                 | Why                                                                                   |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Allowed Callback URLs      | `flowtrim://callback` | Where Auth0 returns after sign-in (`REDIRECT_URI` in `src/core/auth/auth-service.ts`) |
| Allowed Logout URLs        | `flowtrim://callback` | Where Auth0 returns after sign-out (same route, it redirects home)                    |
| Allowed Web Origins / CORS | _(empty)_             | Native requests have no browser origin                                                |

In **Settings → Advanced Settings → Grant Types**: keep **Authorization Code** and **Refresh Token** only.

In **Refresh Token Rotation**: **Rotation on** (reuse detection revokes the whole family if an old refresh token is
replayed) and an **absolute expiration** (e.g. 30 days) plus an **inactivity expiration** (e.g. 15 days).

## 2. Allow refresh tokens for the FlowTrim API

**Applications → APIs → FlowTrim API (`https://api.flowtrim.dev`) → Settings → Access Settings** → enable
**Allow Offline Access**. Without it Auth0 ignores the `offline_access` scope and the app has to sign in again every
time the access token expires.

## 3. Configure the app

Copy `.env.example` to `.env` and fill in (all values are public by design — they ship inside the app):

```
EXPO_PUBLIC_API_URL=http://<your-pc-lan-ip>:5214        # dev build only; release builds require https
EXPO_PUBLIC_AUTH0_DOMAIN=dev-flowtrim.us.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=<client id of the Native application>
EXPO_PUBLIC_AUTH0_AUDIENCE=https://api.flowtrim.dev
```

The client id is **not** a secret (a Native application has no secret). Never put the web app's or any other client
secret here.

## What the app requests

- Scopes: `openid email offline_access` (identity, the e-mail shown in Settings, and a refresh token).
- Tokens are stored only in `expo-secure-store` (Android Keystore). Sign-out deletes them, clears every cached query,
  revokes the refresh token and ends the Auth0 browser session (so the next sign-in can use another account).
