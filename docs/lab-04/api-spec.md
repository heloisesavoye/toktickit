# Lab 4 API Contract — Actions Taken, Workflow, Dashboards

All endpoints are prefixed `/api`, JSON in/out, identity from the Lab 3 session
cookie. Error shape is unchanged since Lab 2:
`{ "error": { "code": "...", "message": "...", "fields": { ... } } }`.
All Lab 2 and Lab 3 endpoints remain unchanged unless listed in §3.

## 0. Authorization Matrix

| Endpoint | Requester | IT Staff | Administrator |
|---|---|---|---|
| `GET /tickets/:id/actions` | own Ticket only (else 404) | 403 | 403 |
| `GET /staff/tickets/:id/actions` | 403 | ✓ | ✓ |
| `POST /staff/tickets/:id/actions` | 403 | ✓ | ✓ |
| `PATCH /staff/actions/:actionId` | 403 | ✓ | ✓ |
| `POST /staff/actions/:actionId/complete` | 403 | ✓ | ✓ |
| `POST /staff/actions/:actionId/cancel` | 403 | ✓ | ✓ |
| `GET /staff/assignees` | 403 | ✓ | ✓ |
| `PATCH /staff/tickets/:id/status` | 403 | ✓ | ✓ |
| `GET /dashboard/requester` | ✓ (own data) | 403 | 403 |
| `GET /dashboard/staff` | 403 | ✓ | ✓ (+ `userCounts`) |

Unauthenticated → `401 UNAUTHENTICATED`; pending password change →
`403 PASSWORD_CHANGE_REQUIRED` (Lab 3 behavior). Hidden UI controls are never
relied on.

## 1. Data Model (Prisma)

```prisma
enum ActionStatus {
  OPEN
  COMPLETED
  CANCELLED
}

model ActionTaken {
  id               Int          @id @default(autoincrement())
  ticketId         Int
  ticket           Ticket       @relation(fields: [ticketId], references: [id])
  actionAt         DateTime                       // Action Date/Time (BR-07)
  description      String                         // 5-2000 (BR-05)
  result           String                         // 1-1000 (BR-05)
  performedById    Int                            // auto from session (BR-03)
  performedBy      User         @relation("ActionPerformer", fields: [performedById], references: [id])
  assigneeId       Int                            // active IT Staff/Admin (BR-04)
  assignee         User         @relation("ActionAssignee", fields: [assigneeId], references: [id])
  followUpRequired Boolean      @default(false)
  followUpNote     String?                        // required when followUpRequired (BR-06)
  attachmentNotes  String?                        // <= 500
  status           ActionStatus @default(OPEN)    // BR-09
  completedAt      DateTime?
  cancelledAt      DateTime?
  version          Int          @default(1)       // optimistic concurrency (BR-11)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([ticketId, actionAt])
  @@index([assigneeId, status])
}

model TicketStatusChange {       // append-only (BR-13)
  id          Int          @id @default(autoincrement())
  ticketId    Int
  ticket      Ticket       @relation(fields: [ticketId], references: [id])
  fromStatus  TicketStatus
  toStatus    TicketStatus
  changedById Int
  changedBy   User         @relation(fields: [changedById], references: [id])
  changedAt   DateTime     @default(now())

  @@index([ticketId, changedAt])
}

// Ticket additions
//   version       Int @default(1)
//   actions       ActionTaken[]
//   statusChanges TicketStatusChange[]
//   @@index([updatedAt]) @@index([itPriority])
```

### Migration `20261104000000_lab4_actions_taken`
1. `CREATE TYPE "ActionStatus"`.
2. `ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1` — fills
   every legacy row with 1, no rewrite of other columns.
3. `CREATE TABLE "ActionTaken"` and `"TicketStatusChange"` with foreign keys
   (`ON DELETE RESTRICT`), plus indexes.
4. New indexes on `Ticket(updatedAt)` and `Ticket(itPriority)`.

Rollback: `server/prisma/migrations/20261104000000_lab4_actions_taken/down.sql`
reverses steps 4→1. Neither direction touches Users, Tickets' existing columns,
Attachments, Public Comments, or Internal Notes (verified by
`server/tests/lab-04/migration.integration.test.ts`).

## 2. Action Taken Endpoints

### Action Taken resource shape
```json
{
  "id": 12,
  "ticketId": 3,
  "actionAt": "2026-11-04T05:30:00.000Z",
  "description": "Re-seated the docking station cable and updated firmware",
  "result": "Monitor detected; keyboard still intermittent",
  "performedBy": { "id": 7, "name": "Priya Nakamura" },
  "assignee": { "id": 7, "name": "Priya Nakamura", "isActive": true },
  "followUpRequired": true,
  "followUpNote": "Swap the dock if the keyboard drops again",
  "attachmentNotes": "See dock-firmware.png in Attachments",
  "status": "OPEN",
  "completedAt": null,
  "cancelledAt": null,
  "version": 1,
  "createdAt": "…",
  "updatedAt": "…"
}
```

### `GET /api/staff/tickets/:id/actions`
`200 { "data": ActionTaken[] }` ordered `actionAt asc, id asc`. `404 TICKET_NOT_FOUND`.

### `POST /api/staff/tickets/:id/actions`
Request:
```json
{
  "actionAt": "2026-11-04T05:30:00.000Z",     // optional, default now
  "description": "string",                    // required
  "result": "string",                         // required
  "assigneeId": 7,                            // optional, default = caller
  "followUpRequired": false,                  // optional, default false
  "followUpNote": "string",                   // required if followUpRequired
  "attachmentNotes": "string"                 // optional
}
```
Any `performedById`, `status`, `version`, or `ticketId` in the body is ignored.

| Status | Code | When |
|---|---|---|
| 201 | — | Created; body `{ data: ActionTaken }`; Ticket `updatedAt` touched |
| 400 | `VALIDATION_ERROR` | `fields` per BR-05/06/07 |
| 400 | `INVALID_ASSIGNEE` | assignee missing, inactive, or a Requester (BR-04) |
| 404 | `TICKET_NOT_FOUND` | unknown Ticket |
| 409 | `TICKET_NOT_ACTIVE` | Ticket is CLOSED or CANCELLED (BR-10) |

### `PATCH /api/staff/actions/:actionId`
Request: any subset of the create fields **plus required** `"version": <int>`.

| Status | Code | When |
|---|---|---|
| 200 | — | Updated; `version` incremented |
| 400 | `VALIDATION_ERROR` / `INVALID_ASSIGNEE` | as above; `version` missing → `fields.version` |
| 404 | `ACTION_NOT_FOUND` | unknown action |
| 409 | `ACTION_NOT_EDITABLE` | action is COMPLETED or CANCELLED (BR-09) |
| 409 | `STALE_UPDATE` | version mismatch; body also has `current: ActionTaken` (BR-11) |

### `POST /api/staff/actions/:actionId/complete` and `/cancel`
Request `{ "version": <int> }`. Sets `status`, `completedAt`/`cancelledAt`,
increments `version`. Same errors as PATCH. Completing does not require the
follow-up to be cleared (the note remains as history).

### `GET /api/staff/assignees`
`200 { "data": [{ "id", "name", "role" }] }` — active IT Staff and Administrators
only, sorted by name. Used for the Assignee select.

### `GET /api/tickets/:id/actions` (Requester)
`200 { "data": ActionTaken[] }` for the caller's own Ticket. Another Requester's
Ticket → `404 TICKET_NOT_FOUND` (no existence leak).

## 3. Changed Ticket Endpoints

### `GET /api/staff/tickets/:id` (extended)
Adds `version`, `actions` (ordered), `statusHistory` (`changedAt asc`, with
`changedBy.name`), and:
```json
"resolutionGate": { "allowed": false, "completedActions": 0, "openActions": 1,
                    "reason": "Complete or cancel the 1 open Action Taken first." }
```
### `GET /api/tickets/:id` (Requester, extended)
Adds `actions` (read-only); still never includes Internal Notes.

### `PATCH /api/staff/tickets/:id/status` (extended)
Request `{ "currentStatus": "RESOLVED", "expectedVersion": 4 }` (`expectedVersion`
optional for Lab 3 compatibility).

| Status | Code | When |
|---|---|---|
| 200 | — | `{ data: { currentStatus, version, appearsResolved } }`; history row appended |
| 400 | `VALIDATION_ERROR` | unknown status |
| 404 | `TICKET_NOT_FOUND` | |
| 409 | `INVALID_TRANSITION` | not in matrix (§9 of specification) |
| 409 | `RESOLUTION_BLOCKED` | gate unmet; `message` names the condition (BR-08) |
| 409 | `STALE_UPDATE` | `expectedVersion` ≠ stored `version` |

The check-and-update runs in one transaction using
`updateMany({ where: { id, version } })` so two concurrent requests cannot both
succeed. Claim, assign, and IT-priority updates also increment `version`.

## 4. Dashboard Endpoints

### `GET /api/dashboard/requester`
```json
{
  "data": {
    "generatedAt": "2026-11-04T05:30:00.000Z",
    "timeZone": "Asia/Bangkok",
    "metrics": {
      "openTickets":   { "count": 3, "filter": { "status": "ACTIVE" } },
      "waitingForMe":  { "count": 1, "filter": { "status": "WAITING_FOR_REQUESTER" } },
      "resolved":      { "count": 2, "filter": { "status": "RESOLVED" } },
      "closed":        { "count": 5, "filter": { "status": "CLOSED" } }
    },
    "needsAttention":   [TicketSummary],
    "recentlyUpdated":  [TicketSummary],
    "recentlyResolved": [TicketSummary]
  }
}
```
`TicketSummary = { id, ticketNumber, summary, currentStatus, itPriority,
requestedPriority, updatedAt }` — never the full ticket, comments, or notes.

### `GET /api/dashboard/staff`
```json
{
  "data": {
    "generatedAt": "…", "timeZone": "Asia/Bangkok",
    "metrics": {
      "unassigned":          { "count": 4, "filter": { "ownerId": "unassigned", "status": "ACTIVE" } },
      "new":                 { "count": 2, "filter": { "status": "NEW" } },
      "inProgress":          { "count": 3, "filter": { "status": "IN_PROGRESS" } },
      "waitingForRequester": { "count": 1, "filter": { "status": "WAITING_FOR_REQUESTER" } },
      "myAssigned":          { "count": 2, "filter": { "ownerId": "7", "status": "ACTIVE" } }
    },
    "byStatus":     { "NEW": 2, "OPEN": 1, "IN_PROGRESS": 3, "WAITING_FOR_REQUESTER": 1,
                      "RESOLVED": 2, "CLOSED": 1, "REOPENED": 0, "CANCELLED": 1 },
    "byItPriority": { "HIGH": 2, "MEDIUM": 3, "LOW": 1, "UNSET": 1 },
    "myOpenActions": { "count": 2, "items": [{ "id", "ticketId", "ticketNumber",
                       "description", "actionAt", "followUpRequired" }] },
    "urgent":          [TicketSummary],
    "recentlyUpdated": [TicketSummary],
    "userCounts": { "REQUESTER": 4, "IT_STAFF": 3, "ADMINISTRATOR": 1 }   // Administrator only
  }
}
```

### Queue/My Tickets filter extension
`status=ACTIVE` is accepted by `GET /api/staff/tickets` and `GET /api/tickets` and
means status ∈ {NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED}, so each
dashboard card drills down to a list with the same count. Unknown values still
fall back to "no filter" (Lab 3 BR-20).

## 5. Safe Errors and Duplicate Protection
- Unexpected errors → `500 INTERNAL_ERROR` with no stack or SQL text.
- Every list is bounded (dashboards ≤ 5 items per list).
- Clients disable submit buttons while a request is in flight; the backend
  additionally makes completion/cancel idempotent-safe through `version` (a retried
  request with the old version gets `STALE_UPDATE`, never a double transition).
