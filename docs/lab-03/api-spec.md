# Lab 3 API Contract — TokTickIT Users, Roles, IT Staff Ticketing, Admin

All endpoints are prefixed `/api`. All requests/responses are JSON unless noted.
Identity comes from the authenticated session (an httpOnly, `SameSite=Lax` signed
cookie set on login) — no endpoint accepts a client-supplied `requesterId` for
identity purposes any more (BR-03, BR-12). Error shape (unchanged from Lab 2):
`{ "error": { "code": "...", "message": "...", "fields": { ... } } }`.

## 0. Roles and Route Protection
| Prefix | Who may call it |
|---|---|
| `/api/auth/*` | Public, except `/api/auth/me` and `/api/auth/logout` (any authenticated user) |
| `/api/tickets*`, `/api/attachments*` (Lab 2, carried over) | Authenticated Requester, scoped to their own tickets |
| `/api/tickets/:id/comments` | Authenticated user who is the Ticket's Requester, or IT Staff/Administrator |
| `/api/tickets/:id/notes` | IT Staff/Administrator only |
| `/api/staff/*` | Active IT Staff or Administrator only |
| `/api/admin/*` | Active Administrator only |

Every route above checks role server-side on every request (FR-08). A user calling a
route outside their role receives `403 { "error": { "code": "FORBIDDEN" } }`; an
unauthenticated call receives `401 { "error": { "code": "UNAUTHENTICATED" } }`.

## 1. Data Model Changes
```
model User {
  id                    Int       @id @default(autoincrement())
  name                  String
  email                 String    @unique
  passwordHash          String
  role                  Role      // REQUESTER | IT_STAFF | ADMINISTRATOR
  isActive              Boolean   @default(true)
  requiresPasswordChange Boolean  @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  ticketsRequested      Ticket[]  @relation("requester")
  ticketsOwned          Ticket[]  @relation("owner")
  comments              PublicComment[]
  notes                 InternalNote[]
}

model Ticket {
  // ...Lab 2 fields unchanged (id, ticketNumber, categoryId, relatedSystemId,
  //     summary, description, requestedPriority, ticketDate, createdAt, updatedAt)
  requesterId   Int
  requester     User      @relation("requester", fields: [requesterId], references: [id])
  ticketOwnerId Int?
  ticketOwner   User?     @relation("owner", fields: [ticketOwnerId], references: [id])
  itPriority    Priority?
  currentStatus TicketStatus @default(NEW) // NEW|OPEN|IN_PROGRESS|WAITING_FOR_REQUESTER|
                                            // RESOLVED|CLOSED|REOPENED|CANCELLED
  appearsResolved Boolean @default(false)  // set by Requester (FR-10), read-only to Requester
  comments      PublicComment[]
  notes         InternalNote[]
}

model PublicComment {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())
}

model InternalNote {
  id        Int      @id @default(autoincrement())
  ticketId  Int
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())
}
```
The Lab 2 `Requester` table is retired; every existing `Requester` row becomes a
`User` row with `role = REQUESTER` in the migration (see §7).

## 2. Authentication

### POST /api/auth/login
- Request: `{ "email": "jane@toktickit.local", "password": "..." }`
- Response 200: `{ "data": { "id": 4, "name": "Jane Anderson", "role": "REQUESTER", "requiresPasswordChange": false } }`
  Sets the session cookie.
- Response 401 (wrong password, unknown email, or inactive account — identical body
  for all three, BR-06): `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Invalid email or password." } }`

### POST /api/auth/logout
- Response 200: `{ "data": { "loggedOut": true } }`. Invalidates the session
  server-side (BR-09); the cookie is cleared.

### GET /api/auth/me
- Response 200: `{ "data": { "id": 4, "name": "...", "email": "...", "role": "...", "requiresPasswordChange": false } }`
- Response 401 if not authenticated.

### POST /api/auth/change-password
- Request: `{ "currentPassword": "...", "newPassword": "..." }`
- Response 200: `{ "data": { "requiresPasswordChange": false } }`
- 400 `WEAK_PASSWORD` if `newPassword` fails the policy (BR-08).
- 401 `INVALID_CREDENTIALS` if `currentPassword` is wrong.
- Available whether or not `requiresPasswordChange` is set; when it is set, every
  other authenticated route (except `/api/auth/me` and `/api/auth/logout`) responds
  `403 { "error": { "code": "PASSWORD_CHANGE_REQUIRED" } }` until this succeeds.

## 3. Requester Tickets and Attachments (Lab 2, carried over)
Same endpoints and shapes as `docs/lab-02/api-spec.md`, with one change: the
Requester identity is taken from the session, not from a `requesterId`
query/body param (any such param is ignored — AC-03). Two additions:

### POST /api/tickets/:id/comments
- Request: `{ "content": "Thanks, still happening." }`
- Response 201: `{ "data": { "id": 9, "authorId": 4, "authorName": "Jane Anderson", "content": "...", "createdAt": "..." } }`
- 400 `VALIDATION_ERROR` if content is empty/whitespace or over 2000 chars (BR-19).
- 404 if the ticket is not owned by (or visible to) the caller.

### POST /api/tickets/:id/resolution-flag
Requester-only action for "problem appears resolved" (FR-10, BR-05, BR-17).
- Request: `{}` (no body needed)
- Response 200: `{ "data": { "appearsResolved": true } }`. Does not change `currentStatus`.

## 4. IT Staff Ticket Queue and Ticket Detail

### GET /api/staff/tickets
Query parameters (BR-20: invalid values fall back to defaults, never 400):
| Param | Values | Default |
|---|---|---|
| `search` | matches ticketNumber or summary | none |
| `category`, `requestedPriority`, `itPriority`, `status`, `ownerId` | see enums / `unassigned` | all |
| `sortBy` | createdAt / updatedAt / requestedPriority / itPriority | createdAt |
| `sortDir` | asc / desc | desc |
| `page`, `pageSize` (1–50) | — | 1, 10 |

- Response 200: `{ "data": [ { "id": 501, "ticketNumber": "...", "summary": "...", "category": "Hardware", "requestedPriority": "MEDIUM", "itPriority": "MEDIUM", "currentStatus": "IN_PROGRESS", "ticketOwner": { "id": 2, "name": "Michael Brown" } | null, "updatedAt": "..." } ], "meta": { "page": 1, "pageSize": 10, "totalItems": 87, "totalPages": 9 }, "state": "OK" | "EMPTY" | "NO_RESULTS" }`
- 403 `FORBIDDEN` if the caller is a Requester.

### GET /api/staff/tickets/:id
- Response 200: full ticket incl. requester name/email, owner, comments, internal
  notes, attachment list. 404 if the ticket does not exist.

### POST /api/staff/tickets/:id/claim
- Response 200: `{ "data": { "ticketOwnerId": 2, "ticketOwnerName": "Michael Brown" } }`
- 409 `ALREADY_ASSIGNED` if a different active owner is already set.

### POST /api/staff/tickets/:id/assign
- Request: `{ "ownerId": 3 }`
- Response 200: same shape as claim.
- 400 `INVALID_OWNER` if `ownerId` is not an active IT Staff/Administrator (BR-13/BR-14).

### PATCH /api/staff/tickets/:id/priority
- Request: `{ "itPriority": "HIGH" }`
- Response 200: `{ "data": { "itPriority": "HIGH" } }`

### PATCH /api/staff/tickets/:id/status
- Request: `{ "currentStatus": "OPEN" }`
- Response 200: `{ "data": { "currentStatus": "OPEN" } }`
- 409 `INVALID_TRANSITION` if the current→requested pair is not permitted by the
  transition matrix in `specification.md` §9: `{ "error": { "code": "INVALID_TRANSITION", "message": "Cannot move from CLOSED to IN_PROGRESS." } }`

### POST /api/tickets/:id/notes  ·  GET /api/tickets/:id/notes
IT Staff/Administrator only (BR-04). Same request/response shape as Public
Comments (§3), but never returned to a Requester caller — a Requester calling
`GET /api/tickets/:id/notes` receives `403 FORBIDDEN` with no note content in the
body (AC-04, AC-13).

## 5. Administrator User Management

### GET /api/admin/users
Query: `search` (name/email, optional), `role` (optional, one of the three roles).
- Response 200: `{ "data": [ { "id": 4, "name": "Jane Anderson", "email": "jane@toktickit.local", "role": "REQUESTER", "isActive": true } ] }`

### POST /api/admin/users
- Request: `{ "name": "Alex Thompson", "email": "alex@toktickit.local", "role": "IT_STAFF", "isActive": true, "initialPassword": "Temp1234!" }`
- Response 201: `{ "data": { "id": 12, "name": "Alex Thompson", "email": "...", "role": "IT_STAFF", "isActive": true, "requiresPasswordChange": true } }`
- 400 `VALIDATION_ERROR` (bad email format, weak `initialPassword`, missing name).
- 409 `EMAIL_IN_USE` (BR-11).

### PATCH /api/admin/users/:id
- Request (any subset): `{ "name": "...", "email": "...", "role": "...", "isActive": false }`
- Response 200: updated user (same shape as create).
- 409 `EMAIL_IN_USE`, `409 LAST_ADMIN` (would leave zero active Administrators, BR-24),
  `409 SELF_DEACTIVATION` (Administrator deactivating themselves, BR-24).

### POST /api/admin/users/:id/password
- Request: `{ "newInitialPassword": "Temp5678!" }`
- Response 200: `{ "data": { "requiresPasswordChange": true } }`. Invalidates the
  target user's existing session (BR-26).
- 400 `WEAK_PASSWORD` if it fails the policy (BR-08).

## 6. Standard HTTP Statuses Used
| Status | Meaning here |
|---|---|
| 200 | Successful retrieval or state-changing success |
| 201 | Resource created |
| 400 | Invalid input / validation error |
| 401 | Not authenticated |
| 403 | Authenticated but forbidden by role, ownership, or pending password change |
| 404 | Resource missing or not visible to the caller |
| 409 | Conflict (duplicate email, invalid status transition, last-admin/self rules, already assigned) |
| 500 | Unexpected server error (safe, generic message only) |

## 7. Migration from Lab 2
1. Create the `User` table and the new `Role`/extended `TicketStatus` enums.
2. Insert one `User` row per existing `Requester` row, copying `id, name, email,
   isActive, createdAt, updatedAt`, setting `role = REQUESTER` and a random
   `passwordHash` with `requiresPasswordChange = true` (documented local-dev-only
   seeded credential — never a real password, per handout §5.3).
3. Add `Ticket.ticketOwnerId` (nullable FK to `User`), `Ticket.appearsResolved`
   (default false), and extend the `TicketStatus` enum in place (Postgres
   `ALTER TYPE ... ADD VALUE`) rather than dropping and recreating it, so existing
   rows keep their current status value unchanged.
4. Re-point `Ticket.requesterId`'s foreign key from `Requester` to `User` (same
   integer ids, so no data rewrite is needed — only the constraint target changes).
5. Drop the `Requester` table once the migration is verified against a seeded copy
   of the Lab 2 database (BR-21).
6. Remove the client-side Development Requester selector and its local/session
   storage; the authenticated session is now the only source of identity.
