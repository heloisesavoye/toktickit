# Lab 4 AI Use and Reflection

## LLM Used
Claude (Anthropic, Claude Opus 5.5) — used as the **specification agent**
(turning the Lab 4 handout into `specification.md`, `api-spec.md`,
`ui-spec.md`, `tests.md`) and as the **coding agent** (migration, API, UI, and
tests on feature branches against that contract).

## Key Prompts

| # | Prompt (summary) | Purpose | Outcome |
|---|---|---|---|
| 1 | "Read the Lab 4 handout and the existing Lab 3 code on `lab3/implementation`, then draft the Sprint 4 engineering contract before writing any code" | Spec DD | `docs/lab-04/specification.md`, `api-spec.md`, `ui-spec.md`, `tests.md` pushed on `docs/lab-04-contract` before the implementation branch |
| 2 | "Define a resolution gate that the backend enforces even if the client bypasses the screen, and a concurrency rule so one user can't silently overwrite another's change" | Business rules | BR-08 (≥1 completed and 0 open actions) and BR-11 (integer `version`, atomic `updateMany where id AND version`, `409 STALE_UPDATE` with the current record) |
| 3 | "Give every dashboard card an exact query, an empty behavior, and a drill-down filter that reproduces the same count in the list screen" | Dashboard contract | Metric tables in specification.md §10; `status=ACTIVE` and `itPriority=UNSET` list filters added so card count = list total (AC-15) |
| 4 | "Write the Prisma migration additively so Lab 3 data is untouched, plus a rollback script, and test both directions on a real PostgreSQL" | Migration | `20261104000000_lab4_actions_taken/migration.sql` + `down.sql`, applied up → down → up on PostgreSQL 16 without errors |
| 5 | "Make the seed idempotent and cover every status, zero/one/many actions, and a Requester with no tickets" | Seed data | Upserts keyed on ticket number and `seedKey`; history only written once; found and fixed two existing seed bugs (see reflection) |
| 6 | "Write the API tests first from tests.md, including direct-API attacks: Requester creating actions, spoofed performedById, inactive assignee, stale versions, parallel completions" | Test DD / TDD | `server/tests/lab-04/*.test.ts` (unit, actions, workflow, both dashboards, migration/seed, performance smoke) |
| 7 | "Build the Actions Taken area with list / create / view-edit modes, double-click protection, and forms that keep the user's input after a failure" | UI | `ActionsTaken.tsx` with an in-flight guard, `Saving…` busy state, STALE_UPDATE banner + Reload, accessible confirm dialog |
| 8 | "The Dashboard is now the landing page — find every Lab 2/3 test that assumed the old landing page and update only what changed" | Regression | Lab 3 E2E helpers updated to open the queue from the nav; the Lab 2 E2E (still using the removed Development Requester selector) rewritten to log in |
| 9 | _[Your prompt when you ran the suites on your machine and fixed what failed]_ | Verification | _[What actually failed and how it was fixed]_ |

## My Reflection
_[Write 5–8 sentences in your own words. Points you may want to cover:]_
- _What the specification agent did well (e.g. turning the handout into
  numbered, testable BR/AC, and spotting that the field list had no assignee
  although the grading asks for "inactive-assignee rejection")._
- _What you had to correct or decide yourself (e.g. Dashboard as landing page,
  Asia/Bangkok time zone, attachment notes as free text)._
- _Two real bugs the agent found in the existing seed while extending it: a
  seeded ticket owned by a Requester (violating Lab 3 BR-13), and the ticket
  number sequence not being advanced after seeding, so the first ticket
  created after a fresh seed collided with TKT-2026-000001._
- _Limits: the coding agent could not install npm packages in its own
  environment, so every test run and fix happened on your machine — and what
  you learned from running the suites yourself._
