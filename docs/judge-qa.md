# Judge questions

## How is this different from a WhatsApp group or an SOS map?

A message or pin remains evidence, not demand. TrustGrid lets coordinators link duplicate/conflicting reports into one reviewed need, checks that allocation inputs are current, reserves physical lots transactionally, and tracks custody until recipient confirmation.

## What does AI do, and what does it explicitly not verify?

AI turns English, Tamil, or Tanglish text into a nullable structured draft with missing-field questions and source snippets. A person edits it before submission. It does not verify truth, invent coordinates or quantities, approve a need, allocate stock, change roles, or execute tools.

## How do you avoid counting duplicate reports as multiple needs?

Normalized text, category, time, and confirmed location produce explainable suggestions. A coordinator links reports to one need; the relationship and reversal are recorded. Two reports never automatically create twice the demand.

## How do you prevent two coordinators allocating the same stock?

The commit function locks the organization, scenario needs, and inventory lots, rechecks need version and available balance, then creates reservations and ledger events in one transaction. Idempotency keys prevent duplicate movements. Concurrency tests exercise both final-stock and same-need races.

## Who decides what fair distribution means?

The coordinator chooses among named deterministic policies: equal share, urgency first, configured minimum targets, or proportional shortage. Inputs, result, policy, algorithm version, and manual reasons are retained; AI never chooses fairness.

## What happens when AI, GPS, realtime, or the backend fails?

AI failure returns the preserved structured form. GPS/map failure leaves area and text entry usable. Realtime reconnect triggers an authorized refetch rather than replaying totals. Backend mutations use idempotency keys and keep entered form data for retry; no success is shown without a committed response.

## What evidence supports a delivery, and where can collusion still occur?

The source confirms pickup, the assigned volunteer advances custody, and the designated recipient confirms receipt through actor-bound, step-bound, expiring, replay-resistant challenges. The ledger records actors, quantities, and time. Coordinated collusion or false self-reporting remains possible; this is participant confirmation, not independent proof.

## Who can see personal information and user history?

Members see their own reports, offers, notifications, and associated task history. An assigned approved volunteer sees precise task details only after authorization. Coordinators see organization operations; admins additionally manage membership and audit. RLS, private storage policies, composite organization foreign keys, and server checks enforce those scopes.

## Can a judge change the input and get a real computed result?

Yes. The public demo accepts stock changes and runs the same allocation functions as the application. The sample report loads an editable normal input and preserves unknown location/date details.

## What was actually implemented and tested during this hackathon?

The repository includes public/auth screens, member and admin workspaces, report extraction/fallback, evidence review, stock ledger, allocation policies and commits, volunteer eligibility, custody transitions, notifications, audit views, RLS/storage/realtime migrations, Vercel and Docker packaging, and original branding. Unit, PostgreSQL integration, production build, and public browser suites ran. Real Google OAuth, Gemini, authenticated multi-user delivery, and live private uploads remain account-dependent and are identified as not run.

## Practical limits

Adoption depends on organizations onboarding trusted coordinators and participants. Reports are self-reported, connectivity excludes some people, receipt is participant evidence, and review capacity can become the first operational bottleneck. Supabase provides useful managed primitives; it does not itself prove nationwide scalability.
