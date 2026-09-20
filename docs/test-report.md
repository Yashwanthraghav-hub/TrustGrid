# Test report

Environment: Windows, Node.js 24.14.1, npm 11.11.0, Next.js 16.3.5, Supabase PostgreSQL 17, Vercel production deployment.

| Check | Result | Evidence |
|---|---|---|
| `npm run lint` | PASS | ESLint completed without errors or warnings after the PostCSS export fix. |
| `npm run typecheck` | PASS | TypeScript completed with no diagnostics. |
| `npm test` | PASS | 26 domain tests: allocation fixtures/edge cases, matching, inventory, task transitions, evidence, and safe redirects. |
| `npm run test:integration` | PASS | 8 PGlite/PostgreSQL migration tests covering authorization, concurrent stock/need reservations, idempotency, custody accounting, challenge replay, and last-admin protection. |
| `npm run build` | PASS | Production Next.js build completed; 13 routes generated. |
| `npm run test:e2e` against production | RUN | Public routes, real demo calculations, sample-report ambiguity, keyboard skip link, and five viewport widths. See the final rerun result below. |
| Supabase migrations | PASS | Four migrations applied to project `ektmyhfqcchjiksqivvg` after integration validation. |
| Vercel production build | PASS | Deployment ready and aliased to `https://trustgrid-gamma.vercel.app`. |
| Real Google OAuth | NOT RUN | Google provider needs an owner-created Google Cloud OAuth client ID/secret. |
| Real Gemini extraction | NOT RUN | No Gemini API key/model is configured; structured fallback is implemented and usable. |
| Real multi-user end-to-end custody flow | NOT RUN | Requires at least four independently authenticated accounts after OAuth setup. Transaction and authorization paths are database tested. |
| Private Storage upload/download | NOT RUN live | Bucket limits and RLS policies migrated; requires authenticated accounts for live verification. |
| Docker build | NOT RUN | Standalone/Vercel builds passed; no Docker engine was verified in this environment. |

The first production Playwright run passed 6/9 tests; three cases timed out during Vercel navigation without reaching a failed product assertion. The harness was changed to use `domcontentloaded` and deployment-appropriate navigation/test timeouts, then rerun. Update the line below from the completed rerun output.

**Final production Playwright rerun:** PASS — 9/9 tests in 2.1 minutes.

No coverage percentage or performance claim is inferred from these checks.
