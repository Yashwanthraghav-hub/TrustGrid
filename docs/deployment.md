# Deployment

## Verified Vercel deployment

TrustGrid is deployed at [https://trustgrid-gamma.vercel.app](https://trustgrid-gamma.vercel.app). The Vercel project is linked through `.vercel/` locally; that directory is ignored by Git.

Production variables configured in Vercel are the Supabase URL/publishable key, `APP_URL`, `HANDOFF_HASH_SECRET`, and `CRON_SECRET`. After adding or changing a `NEXT_PUBLIC_` value, create a new production deployment because that value is compiled into the client bundle.

```bash
npx vercel --prod
```

The linked Supabase Site URL is the production alias, and the allowlist includes both production and local callbacks. Google OAuth remains disabled until its Google Cloud client ID/secret are supplied. Gemini remains optional.

## Scheduled expiry

Call the protected expiry operation on a schedule with `CRON_SECRET`, or run `npm run holds:expire` in an authorized worker. Mutating operations independently reject expired reservations, so cleanup timing cannot make an expired hold usable.

## Standalone container

```bash
docker build -t trustgrid .
docker run --env-file .env.local -p 3000:3000 trustgrid
```

The image uses Next.js standalone output, copies static assets, binds to `0.0.0.0`, and honors `PORT`. The container build path is documented but was not run in this Windows environment. Hosted Supabase remains an external dependency.

## Smoke checks

The public landing, help, privacy, login, register, and demo pages were tested against the public HTTPS alias. Protected `/admin` redirects to login, unauthenticated API responses use `no-store`, and responsive overflow checks cover 360, 390, 768, 1280, and 1440 pixel widths. Real multi-user OAuth and private upload verification await the OAuth client configuration.
