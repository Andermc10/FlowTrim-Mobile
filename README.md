# FlowTrim Mobile

Android companion app for [FlowTrim](https://github.com/Andermc10/FlowTrim-frontend), the transparent
personal-finance engine. Built with **React Native + Expo + TypeScript**, it consumes the existing
[FlowTrim API](https://github.com/Andermc10/FlowTrim-backend) without any backend change.

> **Status:** HU-81 — repository foundation (tabs, theme, languages, configuration, CI). Screens arrive story by story;
> see the epic spec [`EP-17-flowtrim-mobile.md`](https://github.com/Andermc10/FlowTrim-tracker/blob/main/specs/EP-17-flowtrim-mobile.md).

## What it will do (and what it won't)

| On the phone | Stays on the web |
|---|---|
| Today: safe to spend per currency, committed charges, budgets to watch | CSV imports and exports, reports, analytics charts |
| Quick add of expenses, income and transfers | Cancellation simulator, cost per use |
| Movements of the month | AI Assistant |
| Recurring payments with *mark as paid* | Creating / editing recurring payments, accounts and categories |
| Budgets and savings goals (contributions) | |
| Biometric app lock, opt-in **local** payment reminders, read-only offline | |

Every figure comes from the API: the app never recalculates money. Expected charges are always labelled *expected*.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo SDK 58 (managed) + React Native 0.88 + TypeScript strict | Android builds without Android Studio; one codebase |
| Navigation | Expo Router (file-based, typed routes) | Routes are files in `src/app/` |
| Tests | Jest (`jest-expo`) + React Native Testing Library | Behaviour-level tests, same discipline as the other repos |
| Quality | ESLint (`eslint-config-expo`) + Prettier, zero warnings | Enforced in CI |

All dependency versions are pinned exactly.

## Project structure

```
src/
  app/                 routes only (Expo Router): every file is a screen or a layout
    _layout.tsx        providers (safe area, theme, i18n) and the root stack
    (tabs)/            Today · Movements · Payments · Plan
  core/                cross-cutting code: config, i18n, theme (later: api, auth, storage, notifications)
  shared/ui/           reusable UI primitives
  features/<feature>/  screens, hooks and components per feature (from HU-85)
  __tests__/           tests that render the real router (tests never live in src/app)
```

## Getting started

Requirements: Node **22.13+**, an Android phone (or emulator) and, for the API, the local
[FlowTrim backend](https://github.com/Andermc10/FlowTrim-backend).

```bash
npm ci
cp .env.example .env   # fill in the public values (see the file)
npm test               # unit tests
npm start              # Metro dev server
```

Native sign-in (HU-83) needs a **development build** (`npm run android` or an EAS development build); Expo Go is not
enough for it.

| Script | Purpose |
|---|---|
| `npm run lint` | ESLint + Prettier check, fails on any warning |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest |
| `npm run format` | Prettier write |

## Configuration

Only **public** values, read at build time from `EXPO_PUBLIC_*` variables (`.env`, ignored by Git):
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH0_DOMAIN`, `EXPO_PUBLIC_AUTH0_CLIENT_ID`, `EXPO_PUBLIC_AUTH0_AUDIENCE`.
Release builds refuse a non-`https` API URL and URLs with credentials; error messages name the variable, never its value.

## Security and privacy

The checklist is **OWASP MASVS v2** (spec EP-17 §13). Already in place in HU-81:

- Android auto-backup disabled (`allowBackup: false`) so cached data never leaves the device.
- `https` required outside development; no credentials in URLs.
- `no-console` lint rule: nothing can write financial data to the device log.
- Exact dependency versions, `npm audit` gate for high/critical runtime advisories, Dependabot alerts, secret
  scanning with push protection.
- CI with read-only permissions and no secrets.

Coming with their stories: tokens in the Android Keystore (`expo-secure-store`), PKCE sign-in in the system browser,
biometric lock, private notifications. Known accepted gaps live in [`docs/TECH-DEBT.md`](docs/TECH-DEBT.md).

## Process

Spec-driven development: stories and specs live in
[FlowTrim-tracker](https://github.com/Andermc10/FlowTrim-tracker) (milestone *FlowTrim Mobile*). One branch and one
PR per story, Conventional Commits, protected `main` with a required CI check.
