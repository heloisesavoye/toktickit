# Lab 2 Test Plan and Results — TokTickIT Requester MVP

## 1. Test Strategy
Tests are written from `specification.md` before implementation (Test-DD/TDD). Each Acceptance
Criterion (AC-01..AC-17) maps to at least one automated test across unit, API, UI component,
responsive/visual, and E2E levels. Tests are never written retroactively from whatever code exists.

## 2. Planned Tests

| Test ID | Type | AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | AC-01 | Ticket number generator produces `TKT-YYYY-NNNNNN`, sequential, unique | Format matches regex; no collision across 100 generations | server/tests/lab-02/ticket-number.unit.test.ts | Planned |
| UNIT-02 | Unit | BR-07/BR-08 | Summary/Description trimming + length validators | Rejects <5/<10 chars and >120/>2000 chars; trims whitespace | server/tests/lab-02/validators.unit.test.ts | Planned |
| API-01 | API | AC-01 | POST /api/tickets with valid data | 201; ticket saved; ticketNumber returned | server/tests/lab-02/create-ticket.api.test.ts | Planned |
| API-02 | API | AC-04 | POST /api/tickets with blank summary | 400 VALIDATION_ERROR with fields.summary | server/tests/lab-02/create-ticket.api.test.ts | Planned |
| API-03 | API | BR-09 | POST /api/tickets with inactive categoryId | 400 INVALID_REFERENCE | server/tests/lab-02/create-ticket.api.test.ts | Planned |
| API-04 | API | BR-05 | POST /api/tickets for inactive requester | 403 REQUESTER_INACTIVE | server/tests/lab-02/create-ticket.api.test.ts | Planned |
| API-05 | API | AC-03 | GET /api/tickets/:id owned by Requester A, requested as B | 404 TICKET_NOT_FOUND | server/tests/lab-02/ticket-detail.api.test.ts | Planned |
| API-06 | API | AC-08 | GET /api/tickets for Requester with 0 tickets | 200, data=[], state=EMPTY | server/tests/lab-02/my-tickets.api.test.ts | Planned |
| API-07 | API | AC-09 | GET /api/tickets?search=zzzz (no match) | 200, data=[], state=NO_RESULTS | server/tests/lab-02/my-tickets.api.test.ts | Planned |
| API-08 | API | AC-10 | GET /api/tickets?page=3&pageSize=10 with 42 rows | Returns items 21–30; meta.totalPages=5 | server/tests/lab-02/my-tickets.api.test.ts | Planned |
| API-09 | API | BR-19 | GET /api/tickets?sortBy=hacked | Falls back to default sort, 200 (not 400) | server/tests/lab-02/my-tickets.api.test.ts | Planned |
| API-10 | API | AC-06 | POST attachment, 6MB file | 413 FILE_TOO_LARGE | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-11 | API | AC-07 | POST 6th attachment on ticket with 5 active | 409 ATTACHMENT_LIMIT_REACHED | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-12 | API | BR-13 | POST attachment with .exe file | 400 UNSUPPORTED_FILE_TYPE | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-13 | API | AC-11 | GET /api/attachments/:id/download, active | 200, binary stream returned | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-14 | API | AC-12 | GET /api/attachments/:id/download, removed | 410 ATTACHMENT_REMOVED | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-15 | API | AC-13 | POST /api/attachments/:id/remove with reason | 200, isRemoved=true, reason stored | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-16 | API | BR-16 | POST remove with 2-char reason | 400 VALIDATION_ERROR | server/tests/lab-02/attachments.api.test.ts | Planned |
| API-17 | API | AC-16 | GET /api/requesters | Inactive requester absent from response | server/tests/lab-02/requesters.api.test.ts | Planned |
| UI-01 | UI | AC-02 | Navigate to My Tickets with no requester selected | Redirected to Requester Selection screen | client/src/.../RequesterGate.test.tsx | Planned |
| UI-02 | UI | AC-04 | Submit Create Ticket form with blank Summary | Field error shown; fetch/create API not called | client/src/.../CreateTicket.test.tsx | Planned |
| UI-03 | UI | — | Submit button shows busy state while pending | Button disabled + "Submitting…" text during pending promise | client/src/.../CreateTicket.test.tsx | Planned |
| UI-04 | UI | AC-05 | Simulated API failure on submit | Error banner shown; all field values still populated | client/src/.../CreateTicket.test.tsx | Planned |
| UI-05 | UI | AC-08/AC-09 | My Tickets renders EMPTY vs NO_RESULTS state from API `state` field | Correct message/CTA rendered per state | client/src/.../MyTickets.test.tsx | Planned |
| UI-06 | UI | AC-15 | Change Requester triggers ticket-list refetch | New requesterId used in next GET /api/tickets call | client/src/.../RequesterContext.test.tsx | Planned |
| UI-07 | UI | AC-12 | Ticket Detail renders removed attachment as non-downloadable with metadata | Download control absent/disabled; metadata visible | client/src/.../RequesterTicketDetail.test.tsx | Planned |
| UI-08 | UI | BR-16 | Remove-attachment dialog blocks submit until reason ≥5 chars | Confirm button disabled until valid | client/src/.../AttachmentSection.test.tsx | Planned |
| RESP-01 | Responsive/Visual | AC-14 | Playwright screenshot Create Ticket at 375/834/1280px | No horizontal scroll; fields stacked at 375px | e2e/lab-02/visual.spec.ts | Planned |
| RESP-02 | Responsive/Visual | AC-14 | Playwright screenshot My Tickets — table (desktop) vs cards (mobile) | Correct layout per breakpoint, no clipping | e2e/lab-02/visual.spec.ts | Planned |
| E2E-01 | E2E | AC-01, AC-05 | Select requester → fill form → submit → see confirmation | Confirmation shows official ticket number matching DB | e2e/lab-02/requester-ticket-flow.spec.ts | Planned |
| E2E-02 | E2E | AC-15 | Create ticket as Requester A, switch to B, verify A's ticket hidden | B's My Tickets excludes A's ticket | e2e/lab-02/requester-ticket-flow.spec.ts | Planned |
| E2E-03 | E2E | AC-13 | Add attachment, remove it with reason, verify it's blocked from download | Removed attachment shows metadata only, download blocked | e2e/lab-02/requester-ticket-flow.spec.ts | Planned |
| E2E-04 | E2E | AC-03 | Attempt to open another requester's ticket URL directly | Redirected/"not found", no data leak | e2e/lab-02/requester-ticket-flow.spec.ts | Planned |

## 3. Acceptance-Criterion Traceability
| AC | Covered by |
|---|---|
| AC-01 | UNIT-01, API-01, E2E-01 |
| AC-02 | UI-01 |
| AC-03 | API-05, E2E-04 |
| AC-04 | API-02, UI-02 |
| AC-05 | UI-04, E2E-01 |
| AC-06 | API-10 |
| AC-07 | API-11 |
| AC-08 | API-06, UI-05 |
| AC-09 | API-07, UI-05 |
| AC-10 | API-08 |
| AC-11 | API-13 |
| AC-12 | API-14, UI-07 |
| AC-13 | API-15, E2E-03 |
| AC-14 | RESP-01, RESP-02 |
| AC-15 | UI-06, E2E-02 |
| AC-16 | API-17 |
| AC-17 | (add UI-09 covering reference-data fetch failure on Create Ticket) |

## 4. Responsive and Visual Checklist
See `ui-spec.md` §14 — executed via RESP-01/RESP-02 and manual sign-off before submission.

## 5. Test Commands
```
# Backend unit + API
cd server && npm run test -- lab-02

# Frontend component/UI
cd client && npm run test -- lab-02

# E2E + visual (Playwright)
npx playwright test e2e/lab-02
```

## 6. Final Results
_To be filled in from the final `main` branch CI run before submission — paste pass/fail counts and
a link to the CI run or terminal output here._

## 7. Known Limitations or Deferred Tests
- Load/performance testing of My Tickets pagination beyond 42 seed rows is deferred to a later lab.
- Cross-browser visual testing limited to Chromium via Playwright in Lab 2.
- Idempotency-key based duplicate-submission protection is deferred to Lab 3 alongside real auth.
