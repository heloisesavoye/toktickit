# Lab 4 Sprint Engineering Specification — TokTickIT Actions Taken, Dashboards, and Final Regression

> Engineering contract for Sprint 4. Written before the implementation PRs
> (Spec DD). Companion documents: `ui-spec.md`, `api-spec.md`, `tests.md`.
> BR/FR/AC numbering restarts at 01 for Lab 4, as in Lab 3.

## 1. Sprint Goal
Let IT Staff plan and record the real work done on each Ticket through **Actions
Taken**, gate formal resolution on that recorded work, give every role a concise
**dashboard** that links back to the detailed screens, and harden the complete
Labs 1–3 application so that authentication, Requester, IT Staff, Administrator,
comment, note, and attachment behavior keeps working under one consistent Zen
Green UI.

## 2. Stakeholder Request Interpretation
Tickets can be raised and discussed, but the service desk has no record of *what
was actually done*. Each Ticket now gets a list of Actions Taken lines (date/time,
description, result, who performed it, whether a follow-up is needed and why, and
a pointer to supporting files). The Ticket Owner still coordinates the Ticket, but
any IT Staff member may record an action on it. A Requester saying "this looks
fixed" stays advisory: IT Staff must review the recorded work and formally move the
Ticket to Resolved. Each role gets a short dashboard of the numbers that matter to
them, each number clickable through to the list behind it. Finally, the whole
product is polished and regression-tested so it is ready for the final demo.

## 3. Scope
### Included
- `ActionTaken` model, migration, seed, REST API, and Actions Taken area on the IT
  Staff Ticket Detail (list, create, view/edit, complete, cancel).
- Read-only Actions Taken list on the Requester Ticket Detail.
- Final Ticket status-transition matrix with a backend **resolution gate**.
- Append-only Ticket status history (who changed what, when).
- Optimistic concurrency (`version`) on Tickets and Actions Taken.
- Requester dashboard, IT Staff dashboard, Administrator dashboard (IT Staff
  dashboard + user-account counts), with drill-down into filtered lists.
- Final regression, accessibility, responsive, and visual-consistency hardening.

### Explicitly excluded (handout §4.2)
SLA clocks, escalation, on-call scheduling, breach notifications; email/SMS/LINE/
push notifications; inventory, spare parts, purchasing, service-cost accounting;
time-sheets, payroll, labor cost; multi-level approvals, e-signatures; BI tools,
report builders, exports; multi-tenancy and production cloud operations; deleting
Actions Taken; editing or deleting Public Comments/Internal Notes; any feature not
listed in this contract.

## 4. Functional Requirements

### Actions Taken (FR-01 – FR-09)
- FR-01 The system shall let active IT Staff and Administrators create an Action
  Taken on any Ticket that is not `CLOSED` or `CANCELLED`.
- FR-02 Each Action Taken shall record Action Date/Time, Action Description,
  Result, Performed by (set automatically from the session), Assignee, Follow-Up
  Required (yes/no), Follow-up Note, Attachment Notes, Action Status, and audit
  timestamps.
- FR-03 The system shall let IT Staff/Administrators edit the description, result,
  date/time, assignee, follow-up fields, and attachment notes of an `OPEN` Action
  Taken.
- FR-04 The system shall let IT Staff/Administrators mark an `OPEN` Action Taken
  `COMPLETED` or `CANCELLED`; completed and cancelled actions become read-only.
- FR-05 The system shall list all Actions Taken of a Ticket in a stable order
  (Action Date/Time ascending, then id ascending).
- FR-06 The system shall show a Requester every Action Taken on a Ticket they own,
  read-only, and shall never let a Requester create or change one.
- FR-07 The system shall reject an Action Taken assigned to a user who is inactive
  or is not IT Staff/Administrator.
- FR-08 The system shall reject an update to an Action Taken whose `version` does
  not match the stored version (stale update) with a conflict error.
- FR-09 Creating, editing, completing, or cancelling an Action Taken shall update
  the parent Ticket's "last updated" time.

### Ticket workflow (FR-10 – FR-14)
- FR-10 The system shall enforce the final status-transition matrix (§9) on the
  backend for every status change.
- FR-11 The system shall refuse a change to `RESOLVED` unless the resolution gate
  (BR-08) is satisfied, even when the client bypasses the normal screen.
- FR-12 The system shall record every successful status change in an append-only
  status history shown on the IT Staff Ticket Detail.
- FR-13 The system shall reject a status change sent with a stale `expectedVersion`
  so one user cannot silently overwrite another user's recent change.
- FR-14 The Ticket Detail screen shall offer only the transitions permitted from
  the current status and refresh the Ticket summary after a successful change.

### Dashboards (FR-15 – FR-19)
- FR-15 The system shall provide a Requester dashboard summarizing only the
  authenticated Requester's own Tickets (metrics in §10.1).
- FR-16 The system shall provide an IT Staff dashboard with operational metrics,
  the current user's open Actions Taken, urgent Tickets, and recently updated
  Tickets (metrics in §10.2).
- FR-17 The system shall provide Administrators the IT Staff dashboard plus
  active-user counts per role.
- FR-18 Every dashboard metric shall be calculated by the backend and every card
  shall link to a filtered list or the relevant Ticket Detail.
- FR-19 Dashboards shall become the landing page after login for every role.

### Hardening (FR-20 – FR-24)
- FR-20 All Labs 1–3 screens and APIs shall remain available to permitted users
  and keep their behavior.
- FR-21 Every screen shall show consistent loading, validation, success, empty,
  forbidden, conflict, not-found, and safe-failure feedback.
- FR-22 Submit buttons shall be disabled while a request is in flight so repeated
  clicks cannot create duplicates.
- FR-23 Forms shall keep the user's input after a recoverable failure.
- FR-24 Placeholder text, console errors, broken links, and unfinished controls
  shall be removed; the README shall document setup, migration, seed, tests, and
  demo accounts.

## 5. Business Rules

| BR ID | Rule |
|---|---|
| BR-01 | An Action Taken belongs to exactly one Ticket (non-null foreign key) and can never be moved to another Ticket. |
| BR-02 | The Ticket Owner coordinates the Ticket, but an Action Taken may be performed by and assigned to a different active IT Staff member or Administrator. |
| BR-03 | "Performed by" is always the authenticated user who created the action; it is set by the backend and ignored if sent by the client. |
| BR-04 | The Assignee defaults to the creator and must be an active IT Staff member or Administrator; inactive or Requester users are rejected with `INVALID_ASSIGNEE`. |
| BR-05 | Action Description is required, trimmed, 5–2,000 characters. Result is required, trimmed, 1–1,000 characters. Attachment Notes are optional, ≤ 500 characters. All are stored and rendered as plain text. |
| BR-06 | Follow-up Note is required (1–1,000 characters) when Follow-Up Required is yes, and is cleared when Follow-Up Required is no. |
| BR-07 | Action Date/Time defaults to the time of creation, may be back-dated, but may not be more than 5 minutes in the future (clock-skew allowance) and may not be earlier than the Ticket's creation time. |
| BR-08 | **Resolution gate:** a Ticket may move to `RESOLVED` only if it has at least one `COMPLETED` Action Taken and no `OPEN` Action Taken. Otherwise the backend returns `409 RESOLUTION_BLOCKED` naming the unmet condition. |
| BR-09 | Action Status is `OPEN`, `COMPLETED`, or `CANCELLED`. Only `OPEN → COMPLETED` and `OPEN → CANCELLED` are allowed; completed and cancelled actions are read-only. Actions Taken are never deleted. |
| BR-10 | Actions Taken may not be created on a `CLOSED` or `CANCELLED` Ticket; a Ticket must be `REOPENED` first. |
| BR-11 | Every Action Taken and Ticket update carries a `version` integer. An update whose version differs from the stored one is rejected with `409 STALE_UPDATE` and the current record, so the user can review before retrying. |
| BR-12 | A Requester's "problem appears resolved" flag is advisory and never changes `currentStatus`. It is cleared automatically when the Ticket moves to `REOPENED`. |
| BR-13 | Only IT Staff and Administrators change Ticket status, and only along the matrix in §9. Every successful change appends one immutable status-history row (from, to, actor, time). |
| BR-14 | Requesters see all Actions Taken on Tickets they own (read-only) and nothing on Tickets they do not own (404, as in Lab 2/3). |
| BR-15 | "Active" statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`. Final statuses are `CLOSED`, `CANCELLED`. `RESOLVED` is neither: it awaits closure. |
| BR-16 | Dashboard metrics are computed by the backend at request time from the database; the client never computes a count from a list. |
| BR-17 | Dashboard date boundaries use the service-desk time zone **Asia/Bangkok (UTC+7)**. "Recent" means within the last 7 days (rolling, from request time). |
| BR-18 | The Requester dashboard counts and lists only Tickets whose `requesterId` is the authenticated user. |
| BR-19 | Every dashboard card returns its own drill-down filter so the UI can open the matching filtered list; a zero count still renders the card with a zero and a "nothing here" hint. |
| BR-20 | Legacy Tickets created before Lab 4 have zero Actions Taken; they stay valid, appear normally in lists and dashboards, and their existing status is preserved. The resolution gate applies only to *new* transitions into `RESOLVED`. |

## 6. UI Specification Summary
Full detail in `ui-spec.md`. Summary:
- **Navigation:** a "Dashboard" entry is first for every role and is the landing
  page. Active page is shown by bold text plus an underline (not color alone).
- **Requester Dashboard:** welcome line, 4 metric cards (Open, Waiting for me,
  Resolved, Closed), "Needs your attention" list, "Recently updated" list, Quick
  Actions (Create Ticket, My Tickets).
- **IT Staff Dashboard:** 5 metric cards (Unassigned, New, In Progress, Waiting for
  Requester, My Assigned), "My open Actions Taken", "Urgent tickets" (High IT
  priority, active), "Recently updated", tickets by status; Administrators also see
  user-account counts.
- **Actions Taken area** on IT Staff Ticket Detail: table (card list on mobile),
  "Add action" form (create mode), row "View / Edit" (view/edit mode), Complete and
  Cancel buttons with confirmation, inline validation, conflict banner with
  "Reload" action.
- **Workflow:** status select shows only permitted transitions; when the
  resolution gate is unmet, "Resolved" is shown disabled with the reason; status
  history list below the summary.
- **Requester Ticket Detail:** read-only Actions Taken list (no internal notes).
- **Responsive:** ≥1024 desktop grid, 768–1023 two columns, <768 single column;
  tables become stacked cards; no horizontal page scroll.

## 7. Data Changes
Full schema in `api-spec.md` §1.
- New enum `ActionStatus { OPEN COMPLETED CANCELLED }`.
- New model `ActionTaken`: `id, ticketId → Ticket, actionAt, description, result,
  performedById → User, assigneeId → User, followUpRequired, followUpNote?,
  attachmentNotes?, status, completedAt?, cancelledAt?, version, createdAt,
  updatedAt`. Indexes: `(ticketId, actionAt)`, `(assigneeId, status)`.
- New model `TicketStatusChange` (append-only): `id, ticketId → Ticket, fromStatus,
  toStatus, changedById → User, changedAt`. Index `(ticketId, changedAt)`.
- `Ticket` gains `version Int @default(1)` and the relations above. Index
  `(updatedAt)` and `(itPriority)` added for dashboard queries.
- **Migration** `20261104000000_lab4_actions_taken`: purely additive (new enum,
  two new tables, one new column with a default, new indexes). No existing row is
  modified or deleted. Legacy Tickets get `version = 1` and zero actions (BR-20).
- **Rollback:** a documented `down.sql` drops the two new tables, the enum, the
  indexes, and the `version` column; Lab 3 data is untouched by both directions.
- **Seed:** idempotent (upserts keyed on Ticket Number and a seed key per action).
  Adds Tickets in every status (NEW … CANCELLED), every priority, assigned and
  unassigned; Tickets with 0, 1, and 3 Actions Taken (open, completed, cancelled,
  follow-up required); and one Requester with no Tickets, to demonstrate zero
  dashboard metrics.

### Design decisions (justified)
1. **Separate `ActionTaken` table, not a JSON column on Ticket.** Actions need
   their own author, assignee, status, version, and indexes (dashboard "my open
   actions" query on `(assigneeId, status)`); a child table also enforces BR-01
   with a foreign key.
2. **Integer `version` for optimistic concurrency instead of row locks.** The app
   is stateless HTTP; a version check inside a conditional `updateMany` (`where id
   AND version`) detects stale writes atomically without holding database locks
   across user think-time.
3. **Append-only `TicketStatusChange` table** instead of overwriting a "last
   changed by" column, so the workflow is auditable and ordering is stable.
4. **Actions are cancelled, never deleted**, which keeps dashboards and the
   resolution gate reproducible from history.

## 8. API Contract
Full contract in `api-spec.md`. New/changed endpoints:
- `GET /api/staff/tickets/:id/actions`, `POST /api/staff/tickets/:id/actions`
- `PATCH /api/staff/actions/:actionId` (edit, requires `version`)
- `POST /api/staff/actions/:actionId/complete`, `POST /api/staff/actions/:actionId/cancel`
- `GET /api/staff/assignees` (active IT Staff/Administrators for the assignee list)
- `GET /api/tickets/:id/actions` (Requester, own Ticket only, read-only)
- `PATCH /api/staff/tickets/:id/status` — now accepts optional `expectedVersion`,
  enforces the resolution gate, writes status history, returns `version`
- `GET /api/staff/tickets/:id` — now includes `actions`, `statusHistory`, `version`,
  `resolutionGate`
- `GET /api/dashboard/requester`, `GET /api/dashboard/staff`
- All Lab 2 and Lab 3 endpoints unchanged.

## 9. Ticket Status Transition Matrix (final)
Only IT Staff and Administrators may perform transitions. "—" = rejected with
`409 INVALID_TRANSITION`. ⚑ = also subject to the resolution gate (BR-08).

| From \ To | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled |
|---|---|---|---|---|---|---|---|
| New | ✓ | ✓ | — | — | — | — | ✓ |
| Open | — | ✓ | ✓ | — | — | — | ✓ |
| In Progress | — | — | ✓ | ✓ ⚑ | — | — | ✓ |
| Waiting for Requester | — | ✓ | — | ✓ ⚑ | — | — | ✓ |
| Resolved | — | — | — | — | ✓ | ✓ | — |
| Closed | — | — | — | — | — | ✓ | — |
| Reopened | — | ✓ | ✓ | — | — | — | ✓ |
| Cancelled | — | — | — | — | — | — | — |

## 10. Dashboard Calculations

### 10.1 Requester dashboard (`GET /api/dashboard/requester`)
All queries add `requesterId = <session user>` (BR-18).

| Metric key | Label | Calculation | Drill-down |
|---|---|---|---|
| `openTickets` | My Open Tickets | count where status ∈ active (BR-15) | My Tickets, `status=ACTIVE` |
| `waitingForMe` | Waiting for Me | count where status = `WAITING_FOR_REQUESTER` | My Tickets, `status=WAITING_FOR_REQUESTER` |
| `resolved` | Resolved | count where status = `RESOLVED` | My Tickets, `status=RESOLVED` |
| `closed` | Closed | count where status = `CLOSED` | My Tickets, `status=CLOSED` |
| `needsAttention` (list ≤ 5) | Needs your attention | status = `WAITING_FOR_REQUESTER`, `updatedAt` desc | Ticket Detail |
| `recentlyUpdated` (list ≤ 5) | Recently updated | `updatedAt` ≥ now − 7 days, `updatedAt` desc | Ticket Detail |
| `recentlyResolved` (list ≤ 5) | Recently resolved | status ∈ {RESOLVED, CLOSED} and a status-history row to RESOLVED in the last 7 days | Ticket Detail |

### 10.2 IT Staff dashboard (`GET /api/dashboard/staff`)
| Metric key | Label | Calculation | Drill-down |
|---|---|---|---|
| `unassigned` | Unassigned | `ticketOwnerId` is null and status ∈ active | Queue, `ownerId=unassigned&status=ACTIVE` |
| `new` | New | status = `NEW` | Queue, `status=NEW` |
| `inProgress` | In Progress | status = `IN_PROGRESS` | Queue, `status=IN_PROGRESS` |
| `waitingForRequester` | Waiting for Requester | status = `WAITING_FOR_REQUESTER` | Queue, `status=WAITING_FOR_REQUESTER` |
| `myAssigned` | My Assigned | `ticketOwnerId` = me and status ∈ active | Queue, `ownerId=<me>&status=ACTIVE` |
| `byStatus` | Tickets by status | count grouped by status (all 8 keys, zeros included) | Queue, `status=<key>` |
| `byItPriority` | Active by IT priority | active tickets grouped by IT Priority (LOW/MEDIUM/HIGH/UNSET) | Queue, `itPriority=<key>&status=ACTIVE` |
| `myOpenActions` (list ≤ 5 + count) | My open Actions Taken | ActionTaken where `assigneeId` = me and status = `OPEN`, `actionAt` asc | Ticket Detail |
| `urgent` (list ≤ 5) | Urgent tickets | active and `itPriority = HIGH`, `updatedAt` desc | Ticket Detail |
| `recentlyUpdated` (list ≤ 5) | Recently updated | `updatedAt` ≥ now − 7 days, `updatedAt` desc | Ticket Detail |
| `userCounts` (Admin only) | Active users | active users grouped by role | User Management |

Empty behavior: counts are `0` and lists are `[]` — never an error. The response
includes `generatedAt` (ISO) and `timeZone: "Asia/Bangkok"`.

## 11. Acceptance Criteria
- AC-01 Given a permitted IT Staff user and valid data, when an Action Taken is
  created, then it is saved under the correct Ticket with the authenticated user as
  Performed by and the approved assignee.
- AC-02 Given an authenticated Requester, when dashboard data is retrieved, then
  only metrics and recent Tickets owned by that Requester are returned.
- AC-03 Given a Ticket with no completed Action Taken, when IT Staff tries to set it
  to Resolved (UI or direct API), then it is rejected with `RESOLUTION_BLOCKED` and
  the status is unchanged.
- AC-04 Given a Ticket with one completed and no open Action Taken, when IT Staff
  sets it to Resolved, then the status changes, a status-history row is appended,
  and the Ticket summary refreshes.
- AC-05 Given Follow-Up Required = yes and an empty Follow-up Note, when the action
  is saved, then a field-level validation error is returned and nothing is saved.
- AC-06 Given an inactive IT Staff user as assignee, when an action is created or
  edited, then it is rejected with `INVALID_ASSIGNEE`.
- AC-07 Given a Requester (or a direct API call by a Requester), when they try to
  create or edit an Action Taken, then the backend rejects it with 403.
- AC-08 Given a Requester viewing their own Ticket, when Actions Taken exist, then
  all of them are shown read-only; for another Requester's Ticket the API returns 404.
- AC-09 Given two users editing the same Action Taken, when the second saves with
  the old version, then `STALE_UPDATE` is returned with the current record and
  nothing is overwritten.
- AC-10 Given two users changing a Ticket's status, when the second sends a stale
  `expectedVersion`, then `STALE_UPDATE` is returned and the first change stands.
- AC-11 Given a completed or cancelled Action Taken, when anyone tries to edit,
  complete, or cancel it again, then the change is rejected with
  `ACTION_NOT_EDITABLE`.
- AC-12 Given a Closed or Cancelled Ticket, when IT Staff tries to add an Action
  Taken, then it is rejected with `TICKET_NOT_ACTIVE`.
- AC-13 Given multiple Actions Taken by different IT Staff on one Ticket, when the
  Ticket Detail is opened, then they are listed in stable `actionAt`, `id` order
  with each performer's name.
- AC-14 Given seeded data, when the IT Staff dashboard is retrieved, then every
  count equals the corresponding direct database count.
- AC-15 Given a dashboard card, when it is activated by mouse or keyboard, then the
  matching filtered list opens with the same number of results as the card.
- AC-16 Given no matching records, when a dashboard is retrieved, then counts are
  0, lists are empty, and the UI shows an empty-state hint instead of an error.
- AC-17 Given an Administrator, when the dashboard is retrieved, then IT Staff
  metrics and active-user counts per role are returned; IT Staff do not receive
  user counts.
- AC-18 Given a Requester calls the staff dashboard, or IT Staff call the
  Requester dashboard, then the backend returns 403.
- AC-19 Given a Ticket in any status, when the status control is opened, then only
  the transitions of §9 are offered.
- AC-20 Given a Requester marked a Ticket "appears resolved", when IT Staff
  reopens it after resolution, then the flag is cleared and status-history shows
  every change in order.
- AC-21 Given the Lab 4 migration runs on a Lab 3 database, then every existing
  User, Ticket, Attachment, Public Comment, and Internal Note is unchanged and
  legacy Tickets show zero Actions Taken.
- AC-22 Given the seed is run twice, then no duplicate Tickets or Actions Taken are
  created.
- AC-23 Given a slow network, when the user double-clicks "Save action", then only
  one Action Taken is created.
- AC-24 Given a save fails with a network or 500 error, then the form keeps the
  entered values and shows a safe error message.
- AC-25 Given viewports of 1280, 768, and 375 px, when the dashboards and Ticket
  Detail are shown, then nothing is clipped or overlapping and there is no
  horizontal page scroll.
- AC-26 Given keyboard-only use, when navigating dashboards and the Actions Taken
  form, then every control is reachable with a visible focus ring and every status
  is shown with text, not color alone.
- AC-27 Given the complete Lab 2 and Lab 3 test suites, when run on the final
  `main`, then all pass (authentication, My Tickets, Ticket Detail, Attachments,
  Public Comments, Internal Notes, IT Staff queue/detail, Administrator user
  management).

## 12. Definition of Done (Product Completion)
- [ ] Every FR, BR, and AC above is implemented and maps to at least one passing
      automated test in `tests.md`; no test is skipped or commented out on `main`.
- [ ] All Lab 1–3 tests still pass on `main` (regression).
- [ ] Every write endpoint enforces role, ownership, validation, and versioning on
      the backend (direct-API tests, not only UI tests).
- [ ] Migration applied on a copy of the Lab 3 database with no data loss;
      rollback script tested; seed run twice without duplicates.
- [ ] Dashboard counts verified against direct SQL queries (evidence in PDF Part 5).
- [ ] Desktop, tablet, and mobile screenshots for all Lab 4 screens in
      `artifacts/lab-04/screenshots/`; visual and accessibility checklist in
      `ui-spec.md` completed.
- [ ] No console errors, placeholder text, broken links, or unfinished controls.
- [ ] README documents setup, migration, seed, tests, E2E, and demo accounts.
- [ ] Work delivered through GitHub Issues → feature branches → reviewed PRs →
      `lab4-staging` → `main`; `reviewer.md` and `ai-use.md` completed.

## 13. Assumptions and Decisions
- **Assignee added to Actions Taken.** The stakeholder field list does not name an
  assignee, but the handout's grading (Part 6: "assign", "inactive-assignee
  rejection") and AC-01 ("approved assignee") require one. It defaults to the
  creator so the simple case needs no extra input.
- **Action Status added** (`OPEN/COMPLETED/CANCELLED`) so the desk can *plan* work
  (stakeholder: "plan and track the actual work") and so the resolution gate has a
  clear, testable condition.
- **Attachment Notes are free text**, not a link to an Attachment row, because the
  stakeholder describes them as "what file to look for"; real files remain in the
  Lab 2 Attachments area.
- **`expectedVersion` is optional on the status endpoint** to keep the Lab 3 API
  and its tests backward compatible; the Lab 4 UI always sends it.
- **Time zone fixed to Asia/Bangkok** (KMUTT service desk) rather than per-user time
  zones, which are out of scope.
- **Routing stays state-based** (no URL router dependency added); drill-down passes
  filters to the existing list screens as initial filter state.
