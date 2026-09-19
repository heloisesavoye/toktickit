# Lab 3 AI Use and Reflection

## LLM Used
Claude (Anthropic) — used as the AI coding agent for implementing session
authentication, RBAC, the IT Staff ticketing workflow, and the Admin screens
against the Lab 3 Spec-DD/Test-DD, and as a debugging partner once the suite
ran for the first time on a real machine (PostgreSQL, Windows/PowerShell).

## Key Prompts

| # | Prompt (summary) | Purpose | Outcome |
|---|---|---|---|
| 1 | "Continue with full Lab 3 implementation now that the Spec-DD and Test-DD are written" | Scoped implementation | Session auth, RBAC middleware, IT Staff queue/detail, Admin user management, and the full Lab 3 test suite (server + client) generated against the existing contract |
| 2 | "Migrate the Lab 2 attachment tests off requesterId params onto session-based `loginAgent()` auth, matching the Lab 3 pattern" | Regression safety | `attachments.api.test.ts` rewritten with a real cross-requester isolation test added |
| 3 | "Run the server test suite for real on my machine and tell me what's actually broken, not what the code intends" | First real execution | Surfaced two real, previously-unknown bugs (see below) instead of relying on read-through review |
| 4 | "Diagnose why every Lab 3 test fails with `DATABASE_URL` not found even though `.env` exists" | Root-cause debugging | Found that Vitest does not auto-load `.env` the way the Prisma CLI does; fixed via `process.loadEnvFile()` in `vitest.config.ts` and `tsx --env-file=.env` for the seed script |
| 5 | "All 30 remaining server failures are 403 on IT Staff/Administrator-only routes — find the real cause in the routing, not the test expectations" | Root-cause debugging | Found an unscoped `router.use(requireAuth(), requireRole("REQUESTER"))` in `attachments.ts`, mounted at the bare `/api` prefix, intercepting every `/api/staff/*` and `/api/admin/*` request before it reached the intended router. Fixed by scoping the gate to the attachments router's own route paths |
| 6 | "The client test run failed on Login and StaffTicketDetail — is this a component bug or a test bug?" | Failure triage | Confirmed both were test bugs: an unanchored `/Password/i` label query also matched the "Show password" button's aria-label, and a test tried to select a status-dropdown option ("RESOLVED") that the component correctly never offers from the ticket's current state (NEW) |
| 7 | "Don't guess at the Postgres credential problem — walk me through recreating the role and database cleanly" | Environment debugging | Resolved a cryptic Prisma "migration persistence is not initialized" error by dropping and recreating the `toktickit` role/database from a known state, rather than continuing to patch around unknown existing state |
| 8 | "Audit the implementation against every RBAC and status-transition rule before calling it done" | QA gate | Used before treating the 90/90 (server) and 35/35 (client) passing suite as a real completion signal, not just a green checkmark |
| 9 | "Every server test run wipes my admin/staff accounts — find the real cause, don't just tell me to reseed" | Root-cause debugging | Found that `resetDatabase()` in the Lab 3 test fixtures truncates every table, and `npm test` shared the same `DATABASE_URL` as `npm run dev`/`npm run seed`. Fixed by loading a dedicated `server/.env.test` for Vitest and adding a hard runtime guard that refuses to run `resetDatabase()` unless the database name contains "test" |
| 10 | "A real seeded account gets rejected with 'Invalid email or password' even with the right password — walk the whole request path, don't assume it's the credentials" | Root-cause debugging | Found two stacked bugs: `npm run dev` never loaded `server/.env` (so `PORT` silently fell back to a default that happened to match the client's own hardcoded fallback), and `client/.env.example` set `VITE_API_URL` while the code actually reads `VITE_API_BASE` — so no `client/.env` ever really worked. Fixing the server's env loading exposed the second bug immediately (the accidental port coincidence broke) |

## My Reflection
_[2–4 sentences, in your own words: what worked well using an AI agent for
implementation and debugging under a fixed Spec-DD/Test-DD, what you had to
correct or push back on (for example the real bugs found only once things
ran for real on your machine — the `attachments.ts` router-scoping bug, three
separate instances of the same ".env not auto-loaded by tsx" bug class, the
shared test/dev database wiping seeded accounts, and the client's mismatched
`VITE_API_BASE`/`VITE_API_URL` env var name — plus the two test-only bugs
found afterward), and one thing this process taught you about trusting "the
code looks right" versus "it actually ran end-to-end on a real machine".]_
