# Lab 2 GitHub Issues Breakdown

Kanban statuses: Backlog → Specified → Started → PR Review → Fixing → Done.
Branch off `lab2-staging`; every Issue = one feature branch = one PR into `lab2-staging`.

| # | Issue | Branch | Scope | Depends on |
|---|---|---|---|---|
| 1 | Sprint specification and test plan | `spec-and-tests` | specification.md, tests.md, ui-spec.md, api-spec.md | — |
| 2 | Database schema and seed | `db-schema-and-seed` | Prisma schema, migration, idempotent seed | #1 |
| 3 | Development Requester context | `dev-requester-context` | /api/requesters, selector screen, RequesterContext, Change Requester | #2 |
| 4 | Create Ticket | `create-ticket` | POST /api/tickets, /api/categories, /api/related-systems, CreateTicket.tsx, API+UI tests | #3 |
| 5 | My Tickets | `my-tickets` | GET /api/tickets (search/filter/sort/pagination), MyTickets.tsx, API+UI tests | #4 |
| 6 | Ticket Detail and Attachments | `ticket-detail-and-attachments` | GET /api/tickets/:id, attachment upload/download/remove endpoints, RequesterTicketDetail.tsx, AttachmentSection.tsx | #4 |
| 7 | UI style and responsive evidence | `ui-style-and-responsive` | Zen Green polish, Playwright screenshots (desktop/tablet/mobile), visual checklist | #5, #6 |
| 8 | E2E and release integration | `e2e-and-integration` | Playwright E2E specs, integration test pass on `lab2-staging`, release PR to `main` | #7 |

Each Issue's PR description should link back to the FR/BR/AC it satisfies (see
`specification.md`) and to the test IDs in `tests.md` that now pass.
