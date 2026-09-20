# Setup

## Prerequisites

- Node.js 24.14.1 (see `.nvmrc`) and npm 11+
- A Supabase project and Supabase CLI login
- A Google Cloud OAuth web client for real Google sign-in
- Optional Google Gemini API key
- Vercel CLI login for deployment

## Environment

Copy `.env.example` to `.env.local`. Public variables are embedded in the browser bundle and require a rebuild when changed. Keep all server values unprefixed.

Required application values:

- `APP_URL`: exact application origin.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: project publishable key.
- `HANDOFF_HASH_SECRET`: random server-only value used to hash short-lived handoff codes.
- `CRON_SECRET`: random server-only value for scheduled hold expiry.

Optional AI values are `GEMINI_API_KEY` and `GEMINI_MODEL`. Run `npm run ai:models` after supplying the key and select a model that the account actually lists.

Setup-only scripts use `DATABASE_URL` or Supabase setup credentials. Never expose a service-role key through a `NEXT_PUBLIC_` variable.

## Database

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npm run db:types
```

`db push` applies versioned migrations and does not reset remote data. `npm run db:migrate` requires `DATABASE_URL` and applies the same files directly. Never point integration tests or reset tooling at an operational database.

## Google OAuth

1. In Google Cloud, configure the OAuth consent screen for the intended audience.
2. Create a **Web application** OAuth client.
3. Register `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as an authorized redirect URI.
4. In Supabase Authentication → Providers → Google, enable Google and enter the client ID and secret.
5. In Supabase Authentication → URL Configuration, set the deployed origin as Site URL and allow both the deployed `/auth/callback` and local `http://localhost:3000/auth/callback`.

If the Google app remains in external testing, add every judge as a test user. TrustGrid requests only the ordinary OpenID profile and email scopes.

## First administrator

Sign in once so the Supabase auth user exists, then set `BOOTSTRAP_ADMIN_USER_ID` to that UUID. Optionally set `BOOTSTRAP_ORG_NAME` and `ALLOW_PUBLIC_JOIN`.

```bash
npm run admin:bootstrap
```

The script verifies the auth user, creates or reuses an organization, grants its first admin membership, and records an audit event. It is not an application route.

## Commands

- `npm run dev`, `build`, `start`: development, production build, standalone production server.
- `npm run lint`, `typecheck`, `test`, `test:integration`, `test:e2e`: verification.
- `npm run env:check`: safe configuration presence check.
- `npm run db:migrate`, `db:types`, `db:seed`: schema, generated types, and fictional demo data.
- `npm run admin:bootstrap`: protected first-admin setup.
- `npm run holds:expire`: scheduled reservation cleanup.
- `npm run pitch:generate`: regenerate the five-slide presentation.
