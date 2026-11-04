# TokTickIT

IT service-desk ticketing app built incrementally across CPE 334 labs.

## Setup
1. `cd server && npm install && cp .env.example .env`
2. `cd ../client && npm install && cp .env.example .env`
3. In `server/`: `npx prisma migrate deploy` **then** `npm run seed` — in that
   order. Lab 4 adds the additive migration `20261104000000_lab4_actions_taken`
   (Actions Taken, status history, `Ticket.version`); its rollback script is
   `prisma/migrations/20261104000000_lab4_actions_taken/down.sql`. The seed is
   idempotent (safe to run repeatedly) and now creates tickets in every status
   with zero, one, and several Actions Taken. The Lab 3 migration adds the `User`/`Role` model and migrates any
   existing Lab 2 `Requester` rows with a placeholder password hash; the seed
   script (idempotent) replaces that placeholder with a real bcrypt hash and
   adds the IT Staff/Administrator accounts.
4. Run: `npm run dev` in `server/`, then `npm run dev` in `client/`
5. **Before running server tests**, set up a separate, disposable test
   database — the suite truncates every table between tests, and pointing it
   at your dev database wipes the accounts `npm run seed` just created:
   ```
   psql -U postgres -h localhost
   CREATE DATABASE toktickit_test OWNER toktickit;
   \q
   ```
   Then in `server/`: `cp .env.test.example .env.test`. (If `.env.test` is
   missing or doesn't point at a database with "test" in its name,
   `resetDatabase()` refuses to run rather than silently wiping dev data.)
6. Tests: `npm test` in `server/` and in `client/`
7. E2E/responsive screenshots (requires both dev servers running from step 4):
   `npm install && npx playwright install` at the repo root, then
   `npx playwright test` (all labs) or `npx playwright test e2e/lab-04/`.
   Screenshots land in `artifacts/lab-0X/screenshots/` (Lab 4:
   `staff-dashboard/`, `requester-dashboard/`, `actions-taken/` at desktop,
   tablet and mobile). Run `npm run seed` first: the E2E suite uses the seeded
   accounts below.

## Local dev credentials (Lab 3, seeded — never real passwords)
| Role | Email | Password |
|---|---|---|
| Requester | jennifer.anderson@example.com | `RequesterDev123!` |
| IT Staff | priya.nakamura@toktickit.local | `StaffDev123!` |
| Administrator | admin@toktickit.local | `AdminDev123!` |
| IT Staff (forced password change) | new.hire@toktickit.local | `Temp1234!` |
| IT Staff (2nd) | chalermchai.suk@toktickit.local | `StaffDev123!` |
| Requester with no tickets (empty dashboard) | new.requester@example.com | `RequesterDev123!` |

## Demo script (Lab 4)
1. Log in as **priya.nakamura@toktickit.local** → IT Staff Dashboard. Click a
   card (e.g. *Unassigned*) → filtered Ticket Queue with the same count.
2. Open **TKT-2026-000007** → *Actions Taken*: three actions by two staff
   (open / completed / cancelled). Add an action, assign it to a colleague,
   edit it, mark it completed.
3. Try *Current Status → Resolved* on a ticket with an open action: it is
   disabled with the reason; the backend also refuses it (`RESOLUTION_BLOCKED`).
4. Log in as **jennifer.anderson@example.com** → Requester Dashboard → open a
   ticket → read-only *Actions Taken by IT Support*.
5. Log in as **admin@toktickit.local** → Dashboard with active-user counts.

## Project history
- **Lab 1** — health check + category list scaffold (`docs/lab-01/`).
- **Lab 2** — Requester ticketing MVP: Development Requester selector, Create Ticket,
  My Tickets, Ticket Detail, Attachments (`docs/lab-02/`). See
  `docs/lab-02/repo-consolidation.md` for a note on how this lab's history was merged
  into this repository.
- **Lab 3** — authentication, role-based authorization, IT Staff workflow, and
  Administrator user management (`docs/lab-03/`).
- **Lab 4** — Actions Taken, final Ticket workflow with resolution gate and
  status history, optimistic concurrency, Requester and IT Staff/Admin
  dashboards, final regression and polish (`docs/lab-04/`).
