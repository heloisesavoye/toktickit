# Lab 3 Test Plan and Results — TokTickIT Users, Roles, IT Staff Ticketing, Admin

## 1. Test Strategy
Written from `specification.md` before implementation (Test-DD/TDD), same discipline
as Lab 2. Each Acceptance Criterion (AC-01..AC-22) maps to at least one automated
test across unit, API/integration, UI component, authorization, migration/regression,
and E2E levels. No test is written retroactively from whatever the coding agent
produced, and none is skipped, disabled, or commented out on the final `main` branch.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What It Tests | Expected Result | Automated Test File | Status |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-07/BR-08 | Password hashing + policy validator | bcrypt hash never equals plaintext; weak passwords rejected | server/tests/lab-03/password.unit.test.ts | Pending run |
| UNIT-02 | Unit | BR-16 | Status transition matrix helper | Every cell in specification.md §9 matches allowed/rejected | server/tests/lab-03/status-transitions.unit.test.ts | Pending run |
| API-01 | API | AC-01 | POST /api/auth/login with valid credentials | 200; session cookie set; role/user returned | server/tests/lab-03/auth.api.test.ts | Planned |
| API-02 | API | AC-05 | POST /api/auth/login wrong password / unknown email | 401 INVALID_CREDENTIALS, identical message both cases | server/tests/lab-03/auth.api.test.ts | Planned |
| API-03 | API | AC-06 | POST /api/auth/login for inactive user with correct password | 401 INVALID_CREDENTIALS, same message as API-02 | server/tests/lab-03/auth.api.test.ts | Planned |
| API-04 | API | AC-02 | Authenticated call to a normal route while requiresPasswordChange=true | 403 PASSWORD_CHANGE_REQUIRED | server/tests/lab-03/auth.api.test.ts | Planned |
| API-05 | API | AC-02 | POST /api/auth/change-password with a valid new password | 200; requiresPasswordChange=false; normal routes now reachable | server/tests/lab-03/auth.api.test.ts | Planned |
| API-06 | API | AC-07 | POST /api/auth/logout then replay old session cookie on a protected route | 401 UNAUTHENTICATED | server/tests/lab-03/auth.api.test.ts | Planned |
| API-07 | API | AC-03 | GET /api/tickets/:id as Requester A with a spoofed requesterId for B in the query string | Returns A's own data only; spoofed param ignored | server/tests/lab-03/authorization.api.test.ts | Planned |
| API-08 | API | AC-04 | GET /api/tickets/:id/notes as a Requester | 403 FORBIDDEN; response body contains no note content | server/tests/lab-03/authorization.api.test.ts | Planned |
| API-09 | API | AC-16 | Requester calls GET /api/staff/tickets and POST /api/admin/users | Both 403 FORBIDDEN | server/tests/lab-03/authorization.api.test.ts | Planned |
| API-10 | API | AC-08 | POST /api/staff/tickets/:id/claim on an unassigned ticket | 200; ticketOwnerId set to caller | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-11 | API | AC-09 | POST /api/staff/tickets/:id/assign to another active IT Staff member | 200; new owner reflected; old owner's "My assigned" excludes it | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-12 | API | BR-14 | POST assign with a Requester id as ownerId | 400 INVALID_OWNER | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-13 | API | AC-15 | GET /api/staff/tickets?page=5&pageSize=10 with 87 seeded tickets | Returns items 41–50; meta.totalPages=9 | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-14 | API | BR-20 | GET /api/staff/tickets?sortBy=hacked | Falls back to default sort, 200 (not 400) | server/tests/lab-03/staff-queue.api.test.ts | Planned |
| API-15 | API | AC-10 | PATCH IT Priority then PATCH status New→Open | Both persist; reflected in immediate re-fetch | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-16 | API | AC-11 | PATCH status Closed→In Progress | 409 INVALID_TRANSITION naming both statuses | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-17 | API | AC-12 | POST /api/tickets/:id/resolution-flag as the owning Requester | 200; appearsResolved=true; currentStatus unchanged | server/tests/lab-03/staff-ticket-detail.api.test.ts | Planned |
| API-18 | API | AC-13 | POST Internal Note as IT Staff, then GET ticket as the Requester | Note absent from the Requester's response entirely | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-19 | API | AC-14 | POST comment/note with whitespace-only content | 400 VALIDATION_ERROR; nothing persisted | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-20 | API | BR-19 | POST comment with a `<script>` payload | Stored/rendered as escaped plain text, not executed | server/tests/lab-03/comments-notes.api.test.ts | Planned |
| API-21 | API | AC-17 | POST /api/admin/users with an email already in use | 409 EMAIL_IN_USE; no user created | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-22 | API | AC-18 | POST /api/admin/users/:id/password, then log in as that user | requiresPasswordChange=true forced; prior session invalidated | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-23 | API | AC-19 | Sole active Administrator PATCHes self to isActive=false | 409 SELF_DEACTIVATION (or LAST_ADMIN); no change applied | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-24 | API | AC-20 | Deactivate a Ticket Owner, then GET the ticket and GET claim candidates | Owner name still shown on ticket; excluded from candidate list | server/tests/lab-03/users-admin.api.test.ts | Planned |
| API-25 | API | FR-20/FR-21 | GET /api/admin/users?search=&role= and POST create with a valid payload | Search/role filter correct; 201 on create | server/tests/lab-03/users-admin.api.test.ts | Planned |
| MIGR-01 | Migration/Regression | AC-21 | Run the Lab 3 migration against a seeded copy of the Lab 2 database | Every Ticket keeps its original requesterId/owner data; affected Requesters can log in and see only their own tickets | server/tests/lab-03/migration.integration.test.ts | Planned |
| MIGR-02 | Migration/Regression | FR-09 | Re-run all Lab 2 Requester API tests against the Lab 3 server with an authenticated session in place of requesterId | All Lab 2 Requester behaviors (create/list/detail/attachments) still pass | server/tests/lab-03/requester-regression.api.test.ts | Planned |
| UI-01 | UI | AC-01/AC-05 | Login form: valid submit vs wrong-password submit | Valid → redirect into app; invalid → single inline banner, no field-level leak | client/tests/lab-03/Login.test.tsx | Planned |
| UI-02 | UI | AC-02 | Change Password screen policy checklist | Continue disabled until all rules pass and confirmation matches | client/tests/lab-03/ChangePassword.test.tsx | Planned |
| UI-03 | UI | FR-07 | App shell renders nav for each of the three roles | Only permitted nav items rendered per role | client/tests/lab-03/AppShell.test.tsx | Planned |
| UI-04 | UI | AC-15 | Ticket Queue pagination controls with a mocked 87-item response | Correct page controls and item range shown | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned |
| UI-05 | UI | — | Ticket Queue renders EMPTY vs NO_RESULTS from API `state` field | Correct message/CTA rendered per state | client/tests/lab-03/StaffTicketQueue.test.tsx | Planned |
| UI-06 | UI | AC-10 | Ticket Detail: change IT Priority dropdown then status dropdown | Both API calls fired with correct payload; UI reflects response | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned |
| UI-07 | UI | — | Internal Notes panel styling vs Public Comments panel | Distinct background/label present; snapshot-level check | client/tests/lab-03/StaffTicketDetail.test.tsx | Planned |
| UI-08 | UI | AC-19 | Admin edit panel for the sole active Administrator | Deactivate button disabled with explanatory tooltip | client/tests/lab-03/UserManagement.test.tsx | Planned |
| UI-09 | UI | AC-17 | Create User form submit with a duplicate email (mocked 409) | Field-level "email already in use" error shown; panel stays open | client/tests/lab-03/UserManagement.test.tsx | Planned |
| RESP-01 | Responsive/Visual | AC-22 | Every E2E-01..06 screenshot captured across all 3 Playwright projects (desktop 1280×800 Chromium, tablet iPad gen7 WebKit, mobile iPhone 13 WebKit) | No horizontal scroll; usable stacked/table layout at each width; files under `artifacts/lab-03/screenshots/<screen>/<scenario>/<project>.png` matching ui-spec.md §10 | e2e/lab-03/authentication.spec.ts, e2e/lab-03/staff-ticket-flow.spec.ts, e2e/lab-03/user-administration.spec.ts | Pending run |
| E2E-01 | E2E | AC-01, AC-02 | Log in with an initial password → forced change screen → land in app | Ends on the correct role's home screen | e2e/lab-03/authentication.spec.ts | Pending run |
| E2E-02 | E2E | AC-07 | Log in, log out, reload (simulating browser back/bookmark), attempt access | Redirected to Login; action blocked | e2e/lab-03/authentication.spec.ts | Pending run |
| E2E-03 | E2E | AC-08, AC-10, AC-13 | IT Staff claims a ticket, sets IT Priority + status, posts a comment and a note | Comment and note both persist and render in their own panel; status/priority persist | e2e/lab-03/staff-ticket-flow.spec.ts | Pending run |
| E2E-04 | E2E | AC-11, AC-16 | Direct API call to a Staff-only/Admin-only endpoint using a Requester/IT Staff session cookie (bypassing the UI) | 403 FORBIDDEN in both cases; evidence saved to artifacts/lab-03/api-authorization-evidence.txt | e2e/lab-03/staff-ticket-flow.spec.ts, e2e/lab-03/user-administration.spec.ts | Pending run |
| E2E-05 | E2E | AC-17, AC-18 | Administrator creates a user (duplicate-email rejected, valid create succeeds), sets a new initial password, that user logs in | Forced change on first login; duplicate email shows field-level error | e2e/lab-03/user-administration.spec.ts | Pending run |
| E2E-06 | E2E | AC-19 | Administrator attempts to deactivate their own account via the UI | Checkbox disabled with explanatory message, no API call sent | e2e/lab-03/user-administration.spec.ts | Pending run |

## 3. Acceptance-Criterion Traceability
| AC | Covered by |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-04, API-05, UI-02, E2E-01 |
| AC-03 | API-07 |
| AC-04 | API-08 |
| AC-05 | API-02, UI-01 |
| AC-06 | API-03 |
| AC-07 | API-06, E2E-02 |
| AC-08 | API-10, E2E-03 |
| AC-09 | API-11 |
| AC-10 | API-15, UI-06, E2E-03 |
| AC-11 | API-16, E2E-04 |
| AC-12 | API-17 |
| AC-13 | API-18, UI-07, E2E-03 |
| AC-14 | API-19, API-20 |
| AC-15 | API-13, UI-04 |
| AC-16 | API-09 |
| AC-17 | API-21, UI-09, E2E-05 |
| AC-18 | API-22, E2E-05 |
| AC-19 | API-23, UI-08, E2E-06 |
| AC-20 | API-24 |
| AC-21 | MIGR-01 |
| AC-22 | RESP-01 |

## 4. Responsive and Visual Checklist
See `ui-spec.md` §9 — executed via RESP-01 plus manual sign-off before submission.

## 5. Test Commands
```
# Backend unit + API
cd server && npm run test -- lab-03

# Frontend component/UI
cd client && npm run test -- lab-03

# E2E + visual (Playwright)
npx playwright test e2e/lab-03
```

## 6. Final Results
_To be filled in from the final `main` branch CI run before submission — paste
pass/fail counts and a link to the CI run or terminal output here. Every row in §2
must read "Pass" (or an honestly documented "Not Implemented"/"Known Failure" with a
reason) before this file is considered final; none may stay "Planned" at submission._

## 7. Known Limitations or Deferred Tests
- E2E/visual coverage runs on 3 Playwright projects (desktop: Chromium, tablet
  + mobile: WebKit via the iPad gen 7 / iPhone 13 device presets) rather than
  every real browser engine and device.
- Email-based session/CSRF hardening beyond `SameSite=Lax` + same-origin checks
  (e.g., double-submit CSRF tokens) is deferred, since Lab 3 explicitly excludes
  MFA/SSO and keeps the client and server on the same origin in development.
- Load/performance testing of the Ticket Queue beyond the seeded ~90 tickets is
  deferred to a later lab, consistent with the Lab 2 precedent.
