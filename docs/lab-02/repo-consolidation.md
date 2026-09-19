# Lab 2 Repository Consolidation Note

## What happened
Lab 2 (the Requester ticketing MVP) was developed and committed in a **separate** local
git repository whose remote was accidentally created as
`github.com/heloisesavoye/-cpe334-toktickit` instead of continuing in
`github.com/heloisesavoye/toktickit`, which holds Lab 1. Lab 3 must evolve directly on
top of Lab 2, so before starting Lab 3 the Lab 2 work was merged into this repository
(`toktickit`) on branch `integrate/lab2`.

## What the merge did
- Kept `docs/lab-01/` and the Lab 1 project history untouched.
- Brought in all Lab 2 source (`client/src`, `server/src`, Prisma schema and migration,
  seed script), tests (`client/tests/lab-02`, `server/tests/lab-02`), specs
  (`docs/lab-02/*.md`), and the Lab 2 E2E spec (`e2e/lab-02/`).
- The Lab 1 prototype screen (the "Check System" button in `App.tsx`, backed by
  `client/src/api.ts` and the inline `/api/categories` route in the old
  `server/src/app.ts`) is **superseded** by the Lab 2 Requester application, the same
  way each later lab replaces the previous lab's temporary screens (e.g. Lab 3 removes
  the Lab 2 Development Requester selector). Its test files
  (`client/tests/lab-01/App.test.tsx`, `server/tests/lab-01/categories.test.ts`) were
  retired for the same reason; they tested a UI/API contract the app no longer has.
- `server/tests/lab-01/health.test.ts` still passes: `server/src/app.ts` keeps
  `GET /api/health` returning `{ status: "ok", service: "TokTickIT API" }`, and exports
  a ready-made `app` instance (`export const app = createApp();`) for compatibility
  with that test's import, alongside the Lab 2 `createApp()` factory used everywhere
  else.

## What this means for grading evidence
Lab 2's original git history (branches, PR-style commits on the `-cpe334-toktickit`
remote) predates this consolidation and is not reproduced commit-by-commit here, since
GitHub does not let commits be transplanted between unrelated repositories while
preserving their original SHAs. `docs/lab-02/reviewer.md` and `docs/lab-02/tests.md`
describe the real Lab 2 workflow (solo development, direct commits, peer review with
yosko91) as it actually happened; this note documents the additional repository
consolidation step taken before Lab 3.
