# Lab 4 Test Plan and Results — Actions Taken, Workflow, Dashboards, Final Regression

## 1. Test Strategy
Written from `specification.md` before implementation (Test DD), then each test
is written first and made to pass (TDD). Every Acceptance Criterion AC-01..AC-27
maps to at least one automated test. Levels: unit, API/integration (Vitest +
Supertest on a disposable `toktickit_test` PostgreSQL database), UI component
(Vitest + Testing Library), UI style/responsive and E2E (Playwright, desktop /
tablet / mobile projects), migration/regression, and a performance smoke test.
No test is skipped or commented out on the final `main` branch. The full Lab 1–3
suites are re-run unchanged as regression.

Status column: **Planned** → **Pass** / **Fail** once run on `main`.

## 2. Planned Tests

### Unit
| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-05, BR-06, BR-07 | `validateActionInput` (lengths, follow-up note rule, future/before-ticket dates) | Correct field errors; valid input passes | server/tests/lab-04/action-validation.unit.test.ts | Planned |
| UNIT-02 | Unit | BR-08 | `evaluateResolutionGate` for 0 actions / only open / completed+open / completed only | Only "completed ≥1 and open = 0" is allowed | server/tests/lab-04/action-validation.unit.test.ts | Planned |
| UNIT-03 | Unit | BR-09 | Action status transitions | Only OPEN→COMPLETED/CANCELLED allowed | server/tests/lab-04/action-validation.unit.test.ts | Planned |
| UNIT-04 | Unit | BR-15, §9 | Final transition matrix + ACTIVE set | Every matrix cell matches spec | server/tests/lab-04/action-validation.unit.test.ts | Planned |

### API / integration
| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| API-01 | API | AC-13, FR-05 | GET actions on a Ticket with 3 actions by 2 staff | Ordered by actionAt, id; performer names present | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-02 | API | BR-03 | POST with a spoofed `performedById` | Ignored; performer = caller | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-03 | API | AC-01 | Create a valid Action Taken with another staff as assignee | 201; under correct Ticket; performer = caller; assignee saved | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-04 | API | AC-05 | followUpRequired=true, empty note | 400 VALIDATION_ERROR fields.followUpNote; nothing saved | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-05 | API | AC-06 | Inactive staff / Requester as assignee (create and edit) | 400 INVALID_ASSIGNEE | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-06 | API | AC-07 | Requester POST / PATCH / complete on actions | 403 FORBIDDEN | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-07 | API | AC-08 | Requester GET actions on own vs another's Ticket | 200 list / 404 | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-08 | API | AC-09 | Two PATCHes with same version | First 200 (version+1); second 409 STALE_UPDATE with `current` | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-09 | API | AC-11 | Edit / complete / cancel a completed action | 409 ACTION_NOT_EDITABLE | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-10 | API | AC-12 | Create action on CLOSED and CANCELLED tickets | 409 TICKET_NOT_ACTIVE | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-11 | API | FR-09 | Creating an action touches Ticket.updatedAt | updatedAt later than before | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-12 | API | AC-23 | Two parallel complete requests with the same version | Exactly one succeeds | server/tests/lab-04/actions-taken.api.test.ts | Planned |
| API-13 | API | AC-03 | IN_PROGRESS→RESOLVED with 0 completed actions / with an open action | 409 RESOLUTION_BLOCKED; status unchanged | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-14 | API | AC-04 | Complete an action then IN_PROGRESS→RESOLVED | 200; history row appended; version+1 | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-15 | API | AC-10 | Status change with stale expectedVersion | 409 STALE_UPDATE; status unchanged | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-16 | API | AC-19, BR-13 | Invalid transition (CLOSED→IN_PROGRESS) and Requester attempt | 409 INVALID_TRANSITION / 403 | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-17 | API | AC-20 | appearsResolved → resolve → close → reopen | Flag cleared on REOPENED; history in order | server/tests/lab-04/ticket-workflow.api.test.ts | Planned |
| API-18 | API | AC-02, AC-16 | Requester dashboard for A (data) and for a Requester with no tickets | Only A's counts/lists; zeros and [] for empty | server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| API-19 | API | AC-15 | Requester card count equals GET /tickets with the card filter (status=ACTIVE) | Same totals | server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| API-20 | API | AC-18 | IT Staff calls requester dashboard | 403 | server/tests/lab-04/requester-dashboard.api.test.ts | Planned |
| API-21 | API | AC-14 | Staff dashboard counts vs direct Prisma counts | All equal | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| API-22 | API | AC-15 | Each staff card filter applied to GET /staff/tickets | `meta.totalItems` = card count | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| API-23 | API | AC-17, AC-18 | Admin gets userCounts; IT Staff don't; Requester 403 | As specified | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| API-24 | API | AC-16 | Staff dashboard on a DB with no tickets | All counts 0; lists [] | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| MIGR-01 | Migration/Regression | AC-21 | Lab 3 rows survive the Lab 4 migration; legacy tickets have version 1 and 0 actions | Unchanged rows | server/tests/lab-04/migration.integration.test.ts | Planned |
| MIGR-02 | Migration/Regression | AC-22 | Seed run twice | No duplicate tickets/actions | server/tests/lab-04/migration.integration.test.ts | Planned |
| PERF-01 | Performance smoke | FR-16 | Staff dashboard with 300 tickets / 600 actions | Responds < 1 s locally | server/tests/lab-04/staff-dashboard.api.test.ts | Planned |
| REG-01 | Regression | AC-27 | Entire Lab 1, 2, 3 server suites | All pass | server/tests/lab-0{1,2,3}/** | Planned |

### UI component
| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UI-01 | UI | FR-16, AC-15 | Staff dashboard renders cards from API; clicking a card calls `onDrillDown` with its filter | Correct labels/values; filter passed | client/tests/lab-04/StaffDashboard.test.tsx | Planned |
| UI-02 | UI | AC-16 | Staff dashboard empty lists, loading, and 500 states | Hints / status / retry shown | client/tests/lab-04/StaffDashboard.test.tsx | Planned |
| UI-03 | UI | AC-17 | Admin-only Active users card | Shown only when `userCounts` present | client/tests/lab-04/StaffDashboard.test.tsx | Planned |
| UI-04 | UI | FR-15 | Requester dashboard cards, attention list, open ticket | Cards and lists; row click opens detail | client/tests/lab-04/RequesterDashboard.test.tsx | Planned |
| UI-05 | UI | AC-16 | Requester with zero tickets | "haven't raised any tickets" callout | client/tests/lab-04/RequesterDashboard.test.tsx | Planned |
| UI-06 | UI | AC-05 | Follow-up note appears and is required only when Yes | Inline error; no API call | client/tests/lab-04/ActionsTaken.test.tsx | Planned |
| UI-07 | UI | AC-23 | Double-click Save | API called once; button shows Saving… | client/tests/lab-04/ActionsTaken.test.tsx | Planned |
| UI-08 | UI | AC-09, AC-24 | STALE_UPDATE and 500 on save | Warning/error shown; entered text kept | client/tests/lab-04/ActionsTaken.test.tsx | Planned |
| UI-09 | UI | AC-11 | Completed action opens read-only, no Complete/Cancel | Fields read-only | client/tests/lab-04/ActionsTaken.test.tsx | Planned |
| UI-10 | UI | AC-19, AC-03 | Status select: only permitted options; Resolved disabled when gate unmet | Options match matrix | client/tests/lab-04/TicketWorkflow.test.tsx | Planned |
| UI-11 | UI | AC-04 | Successful status change reloads summary and history | New status/history shown | client/tests/lab-04/TicketWorkflow.test.tsx | Planned |
| UI-12 | UI | FR-19, A-02 | AppShell: Dashboard first for each role; `aria-current` on active page | As specified | client/tests/lab-04/TicketWorkflow.test.tsx | Planned |
| REG-02 | Regression | AC-27 | Entire Lab 2/3 client suites | All pass | client/tests/lab-0{2,3}/** | Planned |

### End-to-end, style, responsive, accessibility (Playwright)
| Test ID | Type | Req / AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| E2E-01 | E2E | AC-01, AC-13 | Staff logs in, opens a ticket, adds two actions (one assigned to a colleague), edits, completes | Both listed in order; completed is read-only | e2e/lab-04/actions-taken-flow.spec.ts | Planned |
| E2E-02 | E2E | AC-03, AC-04 | Try Resolved before/after completing an action | Blocked with reason, then succeeds; history shown | e2e/lab-04/ticket-resolution.spec.ts | Planned |
| E2E-03 | E2E | AC-08 | Requester sees the actions read-only on own ticket | No edit controls | e2e/lab-04/ticket-resolution.spec.ts | Planned |
| E2E-04 | E2E | AC-15 | Staff dashboard card → filtered queue with matching count | Same number | e2e/lab-04/dashboards.spec.ts | Planned |
| E2E-05 | E2E | AC-02 | Requester dashboard shows only own tickets; drill-down to My Tickets | Own data only | e2e/lab-04/dashboards.spec.ts | Planned |
| RESP-01 | Responsive | AC-25 | Dashboards + Ticket Detail at 1280/768/375: no horizontal scroll | `scrollWidth ≤ clientWidth` | e2e/lab-04/dashboards.spec.ts | Planned |
| STYLE-01 | UI style | V-01..V-07 | Screenshots saved per screen/device for visual checklist | Files in artifacts/lab-04/screenshots | e2e/lab-04/dashboards.spec.ts | Planned |
| A11Y-01 | Accessibility | AC-26 | Keyboard: Tab to a dashboard card, Enter opens list; focus outline visible | Navigates; outline present | e2e/lab-04/dashboards.spec.ts | Planned |
| REG-03 | Regression | AC-27 | Lab 2/3 E2E (auth, requester flow, staff flow, admin) | All pass | e2e/lab-02/**, e2e/lab-03/** | Planned |

## 3. Traceability (AC → tests)
| AC | Tests |
|---|---|
| AC-01 | API-03, E2E-01 |
| AC-02 | API-18, E2E-05 |
| AC-03 | UNIT-02, API-13, UI-10, E2E-02 |
| AC-04 | API-14, UI-11, E2E-02 |
| AC-05 | UNIT-01, API-04, UI-06 |
| AC-06 | API-05 |
| AC-07 | API-06 |
| AC-08 | API-07, E2E-03 |
| AC-09 | API-08, UI-08 |
| AC-10 | API-15 |
| AC-11 | UNIT-03, API-09, UI-09 |
| AC-12 | API-10 |
| AC-13 | API-01, E2E-01 |
| AC-14 | API-21 |
| AC-15 | API-19, API-22, UI-01, E2E-04 |
| AC-16 | API-18, API-24, UI-02, UI-05 |
| AC-17 | API-23, UI-03 |
| AC-18 | API-20, API-23 |
| AC-19 | UNIT-04, API-16, UI-10 |
| AC-20 | API-17 |
| AC-21 | MIGR-01 |
| AC-22 | MIGR-02 |
| AC-23 | API-12, UI-07 |
| AC-24 | UI-08 |
| AC-25 | RESP-01 |
| AC-26 | A11Y-01, UI-12 |
| AC-27 | REG-01, REG-02, REG-03 |

## 4. How to Run
```bash
# server (uses server/.env.test → toktickit_test database)
cd server && npx prisma migrate deploy && npm test
# client
cd client && npm test
# E2E (server + client dev servers running, dev DB seeded)
cd server && npm run seed && npm run dev      # terminal 1
cd client && npm run dev                      # terminal 2
npx playwright test e2e/lab-04                # terminal 3, repo root
```

## 5. Final Results
_To be filled from the final `main` run: paste the server, client, and Playwright
summaries (passed / failed / skipped counts) and update the Final column above._
