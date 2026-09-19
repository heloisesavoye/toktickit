# TokTickIT

IT service-desk ticketing app built incrementally across CPE 334 labs.

## Setup
1. `cd server && npm install && cp .env.example .env`
2. `cd ../client && npm install && cp .env.example .env`
3. In `server/`: `npx prisma migrate deploy` then `npm run seed`
4. Run: `npm run dev` in `server/`, then `npm run dev` in `client/`
5. Tests: `npm test` in `server/` and in `client/`

## Project history
- **Lab 1** — health check + category list scaffold (`docs/lab-01/`).
- **Lab 2** — Requester ticketing MVP: Development Requester selector, Create Ticket,
  My Tickets, Ticket Detail, Attachments (`docs/lab-02/`). See
  `docs/lab-02/repo-consolidation.md` for a note on how this lab's history was merged
  into this repository.
- **Lab 3** — authentication, role-based authorization, IT Staff workflow, and
  Administrator user management (`docs/lab-03/`).
