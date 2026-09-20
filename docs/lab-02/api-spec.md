# Lab 2 API Contract — TokTickIT Requester MVP

All endpoints are prefixed `/api`. All requests/responses are JSON unless noted. The current
Development Requester is passed as `requesterId` (query param on GET, body field on POST) — this is
a Lab 2 stand-in for an authenticated identity (see BR-03, BR-20).

## Reference Data

### GET /api/categories
Returns active Categories.
- Response 200: `{ "data": [{ "id": 1, "name": "Hardware" }, ...] }`

### GET /api/related-systems
Returns active Related Systems.
- Response 200: `{ "data": [{ "id": 1, "name": "Corporate Laptop" }, ...] }`

### GET /api/requesters
Returns active Development Requesters only (BR-04).
- Response 200: `{ "data": [{ "id": 1, "name": "Jennifer Anderson", "email": "..." }, ...] }`
- Response 200 (none active): `{ "data": [] }` → client shows empty state.
- Response 500 (DB failure): `{ "error": { "code": "REQUESTERS_UNAVAILABLE", "message": "..." } }`

## Tickets

### POST /api/tickets
Create a ticket for the current Requester.
- Request body:
```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 5,
  "summary": "Laptop battery drains quickly",
  "description": "The battery drains fast even when idle...",
  "requestedPriority": "MEDIUM"
}
```
- Response 201:
```json
{
  "data": {
    "id": 101,
    "ticketNumber": "TKT-2026-000101",
    "currentStatus": "NEW",
    "ticketDate": "2026-08-24T09:14:00Z",
    "requesterId": 1,
    "categoryId": 2,
    "relatedSystemId": 5,
    "summary": "Laptop battery drains quickly",
    "requestedPriority": "MEDIUM"
  }
}
```
- 400 Validation failure: `{ "error": { "code": "VALIDATION_ERROR", "fields": { "summary": "Summary must be 5–120 characters" } } }`
- 400 Unknown/inactive `categoryId` or `relatedSystemId`: `{ "error": { "code": "INVALID_REFERENCE" } }`
- 404 Unknown `requesterId`: `{ "error": { "code": "REQUESTER_NOT_FOUND" } }`
- 403 Inactive `requesterId` (BR-05): `{ "error": { "code": "REQUESTER_INACTIVE" } }`
- 500: `{ "error": { "code": "INTERNAL_ERROR" } }`

### GET /api/tickets
List the current Requester's tickets with search, filter, sort, pagination (FR-06..FR-10).

Query parameters:
| Param | Values | Default |
|---|---|---|
| `requesterId` | required int | — |
| `search` | free text, matches ticketNumber or summary | none |
| `category` | categoryId | all |
| `requestedPriority` | LOW/MEDIUM/HIGH | all |
| `itPriority` | LOW/MEDIUM/HIGH | all |
| `status` | NEW/OPEN/IN_PROGRESS/PENDING/RESOLVED | all |
| `sortBy` | createdAt / updatedAt / requestedPriority / ticketNumber | createdAt |
| `sortDir` | asc / desc | desc |
| `page` | ≥1 | 1 |
| `pageSize` | 1–50 | 10 |

Invalid values for any filter/sort/page param fall back to the default (BR-19) rather than 400.

- Response 200:
```json
{
  "data": [ { "id": 101, "ticketNumber": "TKT-2026-000101", "summary": "...", "category": "Hardware",
              "requestedPriority": "MEDIUM", "itPriority": null, "currentStatus": "NEW",
              "updatedAt": "..." } ],
  "meta": { "page": 1, "pageSize": 10, "totalItems": 42, "totalPages": 5 }
}
```
- Response 200 (no tickets ever): `{ "data": [], "meta": { "totalItems": 0, ... }, "state": "EMPTY" }`
- Response 200 (filters match nothing): `{ "data": [], "meta": { "totalItems": 0, ... }, "state": "NO_RESULTS" }`

### GET /api/tickets/:id
Return one ticket owned by the current Requester (FR-11, BR-06).
- Query: `?requesterId=1`
- Response 200: full ticket detail incl. category/relatedSystem names and attachment summary count.
- Response 404 (not found OR not owned by this requester — same response, no distinction, per FR-11):
  `{ "error": { "code": "TICKET_NOT_FOUND" } }`

## Attachments

### POST /api/tickets/:id/attachments
Upload one attachment (multipart/form-data: `file`, `requesterId`).
- Response 201: `{ "data": { "id": 55, "fileName": "screenshot.png", "sizeBytes": 240221, "uploadedAt": "..." } }`
- 404 Ticket not owned/found: `{ "error": { "code": "TICKET_NOT_FOUND" } }`
- 400 Unsupported type: `{ "error": { "code": "UNSUPPORTED_FILE_TYPE" } }`
- 413 Oversized (>5MB): `{ "error": { "code": "FILE_TOO_LARGE" } }`
- 409 Already 5 active attachments: `{ "error": { "code": "ATTACHMENT_LIMIT_REACHED" } }`

### GET /api/attachments/:id
Return attachment metadata (active or removed) for the owning Requester.
- Response 200: `{ "data": { "id": 55, "fileName": "screenshot.png", "isRemoved": false, ... } }`
- 404 if not owned/found.

### GET /api/attachments/:id/download
Stream the file if active.
- Response 200: binary file stream.
- 410 Gone if removed (BR-15): `{ "error": { "code": "ATTACHMENT_REMOVED" } }`
- 404 if not owned/found.

### POST /api/attachments/:id/remove
Soft-remove an attachment (BR-15..BR-17).
- Request body: `{ "requesterId": 1, "removalReason": "Uploaded wrong file" }`
- Response 200: `{ "data": { "id": 55, "isRemoved": true, "removedAt": "...", "removalReason": "..." } }`
- 400 Missing/short reason: `{ "error": { "code": "VALIDATION_ERROR", "fields": { "removalReason": "Minimum 5 characters" } } }`
- 404 if not owned/found; 409 if already removed: `{ "error": { "code": "ALREADY_REMOVED" } }`

## Standard HTTP Statuses Used
| Status | Meaning here |
|---|---|
| 200 | Successful retrieval or state-changing success |
| 201 | Resource created |
| 400 | Invalid input / validation error |
| 403 | Requester inactive |
| 404 | Resource missing or not owned (never distinguished, to avoid leaking existence) |
| 409 | Conflict (attachment limit, already removed) |
| 410 | Resource gone (removed attachment download) |
| 413 | Payload too large |
| 500 | Unexpected server error (safe, generic message only) |
