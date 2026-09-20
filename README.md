# TrustGrid

**From crisis noise to coordinated action.** TrustGrid turns multilingual community reports into human-reviewed needs, compares explainable allocation policies against confirmed stock, and records each delivery handoff through participant confirmation.

[Live demo](https://trustgrid-gamma.vercel.app) · [Setup](docs/setup.md) · [Architecture](docs/architecture.md) · [API contract](docs/api.yaml) · [Test report](docs/test-report.md)

## Implemented flow

1. A member writes an English, Tamil, or Tanglish report or uses the structured form. Google Gemini can create a schema-validated draft when configured; the structured form remains available when AI is unavailable.
2. A coordinator reviews the original text and corrections, links duplicates or conflicts, and confirms one operational need.
3. Confirmed offers become inventory lots. Coordinators compare equal, urgency-first, minimum-target, and proportional allocations, then atomically reserve a selected scenario.
4. Approved volunteers see only eligible tasks. Source, volunteer, and recipient perform independently authorized pickup and receipt steps with short-lived hashed challenges.
5. Append-only stock movements, task events, review decisions, and redacted audit events explain the result.

The public `/demo` is fictional, read-only, and runs the real deterministic allocation code. It never creates operational records.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage/Realtime, Google GenAI, TanStack Query, React Hook Form, Zod, Recharts, XYFlow, Leaflet, Vitest, PGlite, and Playwright. The project pins Node 24 and dependency versions in `package-lock.json`.

## Start locally

```bash
cp .env.example .env.local
npm install
npm run env:check
npm run dev
```

Configure Supabase and Google OAuth as described in [docs/setup.md](docs/setup.md). No public admin-registration or authentication bypass exists; the first admin is created with `npm run admin:bootstrap` after that user signs in.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
```

The verified HTTPS deployment is `https://trustgrid-gamma.vercel.app`. Google OAuth still requires an account owner to finish the Google Cloud OAuth client and enter its ID/secret in Supabase before real sign-in can complete. Gemini extraction similarly requires an optional API key and a model selected from the account's actual model list.

## Safety and limits

TrustGrid is a coordination prototype. It does not dispatch emergency services, verify that a report is true, diagnose medical needs, or guarantee aid. Reports remain self-reported until a coordinator reviews them, receipt evidence is participant confirmation rather than independent proof, and organization onboarding, connectivity, and reviewer capacity remain operational constraints.

Sample names, locations, and quantities are fictional. OpenStreetMap tiles are requested only when an operator configures a tile URL and attribution. Fonts are bundled locally through Fontsource. Third-party libraries retain their own licenses.
