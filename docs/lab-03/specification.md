# Lab 3 Sprint Engineering Specification — TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

## 1. Sprint Goal
Replace the temporary Development Requester selector with real email/password
authentication and server-side role-based authorization for three roles (Requester,
IT Staff, Administrator); ship the first operational IT Staff Ticket Queue and Ticket
Detail workflow; and ship a minimalist Administrator User Management screen — all
without breaking any Lab 2 Requester function.

## 2. Stakeholder Request Interpretation
The temporary Requester selector was a Lab 2 testing convenience; the system now
needs real users. Administrators need a simple screen to view, create, and edit user
accounts, assign one role, activate/deactivate accounts, and set a new initial
password. Anyone signing in with an initial password must choose a new password
before using the app. Requesters keep every Lab 2 ticket function, but their identity
now comes from the authenticated session instead of a selector. IT Staff need a
professional Ticket Queue to find work, open Ticket Detail, claim or reassign a
Ticket, set IT Priority, talk to the Requester through Public Comments, keep private
Internal Notes, and move the Ticket through its permitted status workflow.
Requesters may flag that a problem appears resolved, but only IT Staff/Administrator
formally resolve or close a Ticket. Every API and screen is protected by role and
ownership — hiding a button is never authorization.

## 3. Scope
### Included
- Email/password authentication, logout, current-user retrieval
- Mandatory first-login password change for users created with an initial password
- Server-side role-based authorization for Requester, IT Staff, Administrator
- Migration from the Lab 2 Development Requester identity to the real User model
- Continued Requester ownership protection for all Lab 2 Ticket/Attachment functions
- IT Staff Ticket Queue (search, filters, sort, pagination) and Ticket Detail
  (ownership/claim, IT Priority, permitted status changes, Public Comments, Internal
  Notes, existing Attachments)
- Minimalist Administrator User Management (list, search, role filter, create, edit,
  activate/deactivate, set new initial password)
- Zen Green UI extensions reusing Lab 2 tokens and components

### Explicitly excluded (per handout §4.2)
Email invitations/password-reset email, MFA, social login, SSO, self-registration,
Actions Taken, SLA/escalation/notifications, dashboards/KPI analytics, multi-tenant
orgs, production deployment changes, multiple roles per user, user deletion, bulk
user operations/import/export, account-history screens, extended user-profile fields,
email delivery of passwords, account unlocking/approval workflows, mandatory
pagination/multi-column sort/multiple simultaneous filters on the user list.

## 4. Functional Requirements

### Authentication and session (FR-01 – FR-08)
- FR-01 The system shall let a user authenticate with email and password and
  establish an authenticated session on success.
- FR-02 The system shall reject authentication for a wrong password, an unknown
  email, or an inactive account with one indistinguishable safe error message.
- FR-03 The system shall flag a user as `requiresPasswordChange` when an
  Administrator sets an initial/new password, and shall block access to normal
  application routes (API and UI) until a new password is saved.
- FR-04 The system shall let a user with `requiresPasswordChange = true` submit a new
  password (meeting the password policy) and shall clear the flag on success.
- FR-05 The system shall expose the current authenticated user's id, name, email, and
  role via a "current user" endpoint used to drive role-based navigation.
- FR-06 The system shall let the current user log out, invalidating server-side
  session state so the same credential can no longer be used to call protected
  routes without authenticating again.
- FR-07 The system shall show only the navigation entries and actions permitted for
  the current user's role.
- FR-08 The system shall enforce every authorization rule server-side; a hidden or
  disabled frontend control is never treated as sufficient protection.

### Requester regression (FR-09 – FR-10)
- FR-09 The system shall continue to support every Lab 2 Requester function (create
  ticket, My Tickets, Ticket Detail, attachments) using the authenticated Requester's
  identity in place of the removed Development Requester selector.
- FR-10 The system shall let a Requester post a Public Comment and mark that the
  reported problem appears resolved, without granting them the ability to set
  `currentStatus` to `Resolved` or `Closed`.

### IT Staff ticket workflow (FR-11 – FR-19)
- FR-11 The system shall let any active IT Staff or Administrator view the IT Staff
  Ticket Queue containing all Tickets regardless of owner.
- FR-12 The system shall support searching the Ticket Queue by Ticket Number or
  Summary, filtering by Category, Requested Priority, IT Priority, Current Status,
  and Ticket Owner, sorting by Created Date/Requested Priority/IT Priority/Last
  Updated, and paginating results.
- FR-13 The system shall let IT Staff/Administrator open Ticket Detail for any
  Ticket.
- FR-14 The system shall let IT Staff/Administrator claim an unassigned Ticket
  (setting themselves as Ticket Owner) or reassign a Ticket to another active IT
  Staff/Administrator.
- FR-15 The system shall let IT Staff/Administrator set or change IT Priority
  independently of Requested Priority.
- FR-16 The system shall let IT Staff/Administrator change Current Status to any
  status permitted by the transition matrix in §4.5 of the handout (reproduced in
  §9 below).
- FR-17 The system shall let IT Staff/Administrator post Public Comments (visible to
  the Requester) and Internal Notes (never visible to the Requester).
- FR-18 The system shall let IT Staff/Administrator view existing Attachments on any
  Ticket.
- FR-19 The system shall show clear loading, empty, no-results, forbidden, and safe
  failure states on the Ticket Queue and Ticket Detail screens.

### Administrator user management (FR-20 – FR-27)
- FR-20 The system shall let an Administrator view a list of users showing Name,
  Email, Role, and Status, searchable by name or email and optionally filterable by
  role.
- FR-21 The system shall let an Administrator create a user with a name, email, one
  role (Requester, IT Staff, or Administrator), an activation state, and an initial
  password that the user must change at next login.
- FR-22 The system shall let an Administrator edit a user's name, email, role, and
  activation state.
- FR-23 The system shall let an Administrator set a new initial password for an
  existing user, which the user must change at their next login.
- FR-24 The system shall reject a create/update that would result in a duplicate
  email address.
- FR-25 The system shall prevent an Administrator from deactivating their own
  account.
- FR-26 The system shall prevent an action that would leave the system with zero
  active Administrators.
- FR-27 The system shall use deactivation, never deletion, to remove a user's access.

## 5. Business Rules

| BR ID | Rule |
|---|---|
| BR-01 | Only an active user with valid credentials may authenticate. |
| BR-02 | A user marked as requiring a password change cannot enter the normal application until a new valid password is saved. |
| BR-03 | The authenticated user identity, not a requesterId supplied by the client, determines ownership of Requester operations. |
| BR-04 | Public Comments are visible to the Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator. |
| BR-05 | A Requester may indicate that the problem appears resolved, but cannot formally set the Ticket to Resolved or Closed. |
| BR-06 | A failed login attempt (wrong password or unknown email) and a login attempt against an inactive account return the same generic "invalid email or password" message; the system never reveals which part was wrong or whether the account exists. |
| BR-07 | Passwords are never stored or logged in plaintext; they are hashed with a strong, salted algorithm (bcrypt, cost factor ≥ 12) before being persisted. |
| BR-08 | A password (initial or user-chosen) must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character. |
| BR-09 | Logout invalidates the current session server-side; a previously valid session token is rejected by every protected route after logout. |
| BR-10 | An inactive user can never authenticate, regardless of password correctness, and their existing sessions (if any) are treated as invalid. |
| BR-11 | Email addresses are unique (case-insensitive) across all users; a create/update that collides with an existing email is rejected with a field-level error. |
| BR-12 | The "current user" endpoint always reflects the authenticated session; it is never trusted from client-supplied state (localStorage, query params, etc.). |
| BR-13 | Ticket ownership (`ticketOwnerId`) may be null (unassigned) or reference exactly one active IT Staff or Administrator user; a Ticket is never owned by a Requester or by an inactive user. |
| BR-14 | Claiming an unassigned Ticket sets `ticketOwnerId` to the acting IT Staff/Administrator's id; reassigning an owned Ticket requires selecting another active IT Staff/Administrator from a server-validated list. |
| BR-15 | Requested Priority is set once by the Requester at ticket creation and is never edited afterward. IT Priority initially copies Requested Priority and may only be changed afterward by IT Staff or Administrator. |
| BR-16 | The required Ticket statuses are `New`, `Open`, `In Progress`, `Waiting for Requester`, `Resolved`, `Closed`, `Reopened`, `Cancelled`; only the transitions in §9 (Ticket status transition matrix) are permitted, and every transition is validated server-side regardless of what the client requests. |
| BR-17 | Only IT Staff or Administrator may change Current Status; a Requester's "problem appears resolved" action never changes `currentStatus` — it is recorded separately (e.g., a flag/comment) for IT Staff to act on. |
| BR-18 | Public Comments and Internal Notes are append-only in Lab 3: no editing or deletion. Each entry records its author and creation time from the backend, never from client input. |
| BR-19 | Public Comment and Internal Note content is required and rejected if empty or whitespace-only; content is limited to 2,000 characters and is rendered as plain text (HTML/script content is escaped, never executed) to prevent stored XSS. |
| BR-20 | The Ticket Queue's search, filter, and sort parameters are validated; unknown or invalid values fall back to safe defaults rather than producing a server error. |
| BR-21 | Migrating from Lab 2, every existing Ticket's `requesterId` is preserved unchanged and now references a real, migrated Requester `User` row instead of the old `Requester` table; no Ticket loses its owner or history during migration. |
| BR-22 | An Administrator creates a user with exactly one role selected from `Requester`, `IT Staff`, `Administrator`; the system has no concept of multiple simultaneous roles in Lab 3. |
| BR-23 | An Administrator update may change a user's name, email, role, and activation state, but never their password directly (password changes go through the "set new initial password" action, which always forces a change at next login). |
| BR-24 | An Administrator can never deactivate their own account (BR-25 in the handout's numbering) and the system can never end up with zero active Administrators after any create/update/deactivate action; the API rejects the specific action that would cause either condition, with a clear error naming the constraint. |
| BR-25 | Deactivating a user does not delete their historical Tickets, Comments, Notes, or Ticket ownership; an inactive Ticket Owner's name still displays on their previously owned Tickets, but they no longer appear in the "claim/reassign" candidate list. |
| BR-26 | Setting a new initial password for an existing user immediately invalidates that user's current session(s) and sets `requiresPasswordChange = true`. |

## 6. UI Specification Summary
See `ui-spec.md` for full detail. Login/Change Password screens, an authenticated
app shell showing the current user's name and role with role-specific navigation and
Logout, the IT Staff Ticket Queue and Ticket Detail screens, and the Administrator
User Management screen all reuse the Zen Green tokens and reusable components
established in Lab 2 (`client/src/theme/tokens.css`, `client/src/components/ui/`).

## 7. Data Changes
See `api-spec.md` §1 for full field lists. Summary:
- New `User` model replaces the Lab 2 `Requester` model as the source of identity:
  `id, name, email (unique), passwordHash, role (REQUESTER|IT_STAFF|ADMINISTRATOR),
  isActive, requiresPasswordChange, createdAt, updatedAt`.
- `Ticket` gains `ticketOwnerId` (nullable FK to `User`, restricted to IT Staff/
  Administrator), `itPriority` (already nullable since Lab 2, now actively used),
  and status values extended to the full Lab 3 set.
- New `PublicComment` and `InternalNote` models: `id, ticketId (FK), authorId (FK to
  User), content, createdAt`.
- `Ticket.requesterId` now references `User` instead of the retired `Requester`
  table.

## 8. API Contract
Full contract in `api-spec.md`. New/changed endpoints: `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`,
`GET /api/staff/tickets`, `GET /api/staff/tickets/:id`,
`POST /api/staff/tickets/:id/claim`, `POST /api/staff/tickets/:id/assign`,
`PATCH /api/staff/tickets/:id/priority`, `PATCH /api/staff/tickets/:id/status`,
`POST /api/tickets/:id/comments`, `GET /api/tickets/:id/comments`,
`POST /api/tickets/:id/notes`, `GET /api/tickets/:id/notes`,
`GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`,
`POST /api/admin/users/:id/password`. All Lab 2 Ticket/Attachment endpoints are kept,
now deriving the Requester identity from the session instead of a `requesterId`
body/query parameter.

## 9. Ticket Status Transition Matrix
| From \ To | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled |
|---|---|---|---|---|---|---|---|
| New | IT Staff/Admin | IT Staff/Admin | — | — | — | — | IT Staff/Admin |
| Open | — | IT Staff/Admin | IT Staff/Admin | — | — | — | IT Staff/Admin |
| In Progress | — | — | IT Staff/Admin | IT Staff/Admin | — | — | IT Staff/Admin |
| Waiting for Requester | — | IT Staff/Admin | — | IT Staff/Admin | — | — | IT Staff/Admin |
| Resolved | — | — | — | — | IT Staff/Admin | IT Staff/Admin | — |
| Closed | — | — | — | — | — | IT Staff/Admin | — |
| Reopened | — | IT Staff/Admin | IT Staff/Admin | — | — | — | IT Staff/Admin |
| Cancelled | — | — | — | — | — | — | — |

A Requester triggers none of these transitions directly; their "problem appears
resolved" action is recorded for IT Staff to review and does not change
`currentStatus`. Every cell not marked with a role is an invalid transition and is
rejected with a 409-style conflict error naming the current and requested status.

## 10. Acceptance Criteria
- AC-01 Given an active user with valid credentials, when the user logs in, then the
  backend establishes authenticated access and returns the permitted user identity
  and role.
- AC-02 Given a user who must change the initial password, when login succeeds, then
  normal application screens remain unavailable until a new valid password is saved.
- AC-03 Given an authenticated Requester, when the client supplies another
  requesterId, then the backend still applies the authenticated identity and does not
  return another Requester's data.
- AC-04 Given a Requester account, when an Internal Note endpoint is requested, then
  the operation is rejected without exposing note content.
- AC-05 Given a wrong password or an unknown email, when the user attempts to log in,
  then the same generic "invalid email or password" message is shown, with no
  indication of which part was wrong.
- AC-06 Given an inactive user's correct credentials, when the user attempts to log
  in, then authentication is rejected with the same generic message as AC-05.
- AC-07 Given an authenticated user, when they log out and then replay their
  previous session token against a protected endpoint, then the request is rejected
  as unauthenticated.
- AC-08 Given an unassigned Ticket, when an IT Staff member claims it, then
  `ticketOwnerId` is set to that IT Staff member and the Ticket Queue reflects the
  new owner.
- AC-09 Given a Ticket owned by IT Staff member A, when Administrator reassigns it to
  active IT Staff member B, then B becomes the owner and A no longer sees it as
  theirs in "My assigned" filters.
- AC-10 Given a Ticket with `currentStatus = New`, when IT Staff sets IT Priority and
  moves status to `Open`, then both values persist and are reflected immediately in
  Ticket Detail and the Queue.
- AC-11 Given a Ticket in `Closed` status, when IT Staff attempts to set status to
  `In Progress` directly, then the transition is rejected as invalid per §9.
- AC-12 Given a Requester views their own Ticket, when they mark the problem as
  appearing resolved, then `currentStatus` does not change and IT Staff sees the
  flag in Ticket Detail.
- AC-13 Given IT Staff posts an Internal Note, when the Requester views the same
  Ticket, then the Internal Note is not present anywhere in the response or the UI.
- AC-14 Given empty or whitespace-only content, when a Public Comment or Internal
  Note is submitted, then the request is rejected with a field-level validation
  error and nothing is persisted.
- AC-15 Given the IT Staff Ticket Queue has 87 tickets and page size 10, when IT
  Staff opens page 5, then tickets 41–50 are shown with correct pagination controls.
- AC-16 Given a Requester attempts to call any `/api/staff/*` or `/api/admin/*`
  endpoint, when the request is made, then it is rejected as forbidden regardless of
  frontend navigation state.
- AC-17 Given an Administrator creates a user with an email that already exists,
  when the form is submitted, then a field-level "email already in use" error is
  shown and no user is created.
- AC-18 Given an Administrator sets a new initial password for a user, when that
  user next logs in, then they are required to change the password before reaching
  any other screen, and their previous session (if still open elsewhere) is no
  longer valid.
- AC-19 Given the only active Administrator account, when that Administrator
  attempts to deactivate their own account or change their own role away from
  Administrator, then the action is rejected with an error naming the safety rule.
- AC-20 Given a Ticket owned by a user who is later deactivated, when Ticket Detail
  is viewed, then the former owner's name still displays, but that user no longer
  appears in the claim/reassign candidate list.
- AC-21 Given Lab 2 seed Tickets exist before migration, when the Lab 3 migration
  runs, then every Ticket's Requester ownership is unchanged and each affected
  Requester can still log in and see exactly their own Tickets in My Tickets.
- AC-22 Given the viewport is <768px, when the IT Staff Ticket Queue, Ticket Detail,
  or Administrator User Management screen is viewed, then fields/columns stack
  usably with no horizontal overflow.

## 11. Definition of Done
- All FR/BR/AC above implemented and traceable to passing tests in `tests.md`.
- No test skipped, disabled, or commented out on the final `main` branch.
- Every protected endpoint enforces role and ownership server-side (verified by
  direct-API authorization tests, not just UI checks).
- Password hashing verified (no plaintext password ever appears in the database, a
  log, or a fixture committed to the repo).
- Migration from the Lab 2 `Requester` model to the Lab 3 `User` model is documented
  and tested; existing Ticket ownership is provably unchanged after migration.
- Zen Green tokens and component states match `ui-spec.md`, verified with Playwright
  screenshots at desktop/tablet/mobile for Login, Ticket Queue, Ticket Detail, and
  User Management.
- Seed data satisfies handout §5.3 (idempotent; ≥4 active + 1 inactive Requester,
  ≥3 active + 1 inactive IT Staff, ≥1 active Administrator; realistic ticket spread).
- README documents setup, seed, and test commands and is current.
- Peer-reviewed PRs merged through a Lab 3 staging branch into `main`; `reviewer.md`
  completed with real PR links and comments.

## 12. Assumptions and Decisions
- Authentication uses server-side sessions (signed, httpOnly cookie) rather than a
  client-stored JWT, since the stack already runs Express behind the Vite dev
  server on the same origin in development; this avoids exposing any token to
  client-side JavaScript and keeps CSRF exposure limited to state-changing requests,
  which use the `SameSite=Lax` cookie default plus a same-origin check.
- `ticketOwnerId` is restricted to `IT_STAFF` and `ADMINISTRATOR` roles at the
  application layer (not a DB-level polymorphic constraint), validated on every
  claim/assign call.
- The Lab 2 `Requester` table is migrated into `User` rows with `role = REQUESTER`
  in the same migration that introduces the `User` model, so `Ticket.requesterId`
  can be repointed in a single, reversible migration script (see `api-spec.md` §7
  for the exact migration steps).
- BR numbering in this document restarts at BR-01 for Lab 3 and does not continue
  Lab 2's BR sequence, matching the handout's own example table, which also restarts
  at BR-01 for Lab 3.
