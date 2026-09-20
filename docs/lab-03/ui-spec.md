# Lab 3 UI Specification — Zen Green Theme (Authenticated App)

Reuses every token, field state, button hierarchy, badge rule, and responsive rule
from `docs/lab-02/ui-spec.md` §1–5 and §12–13 unchanged. This document adds the
authenticated shell and the three new/changed screens.

## 1. Additional Badges
- Role badge: Requester = gray-green pill, IT Staff = `--color-secondary` pill,
  Administrator = `--color-primary` pill — shown next to the user's name in the
  header and on the Administrator user list.
- Current Status (extended set): New = gray, Open = blue-gray, In Progress = amber,
  Waiting for Requester = purple-gray, Resolved = green, Closed = dark gray,
  Reopened = amber-red, Cancelled = red-tinted — always paired with the text label.

## 2. Login Screen
- Centered card, max-width ~420px, on `--color-bg`. Replaces the Lab 2 Development
  Requester Selection screen entirely.
- Fields: Email, Password (with a show/hide toggle icon).
- Primary "Sign In" button, busy state while the request is in flight.
- Invalid-credentials feedback: a single inline error banner above the fields
  ("Invalid email or password. Please try again.") — never a field-level error that
  would reveal which field was wrong (BR-06).
- Inactive-account attempt shows the exact same banner as any other failure.
- "Forgot your password?" link is visibly present but disabled/non-functional with a
  tooltip "Contact your Administrator" — email-based reset is explicitly out of
  scope (handout §4.2).

## 3. Change Password Screen (Mandatory First Login)
- Shown immediately after login when `requiresPasswordChange = true`; no navigation
  away from it is possible (no header, no back button) until it succeeds.
- Fields: Current (temporary) Password, New Password, Confirm New Password.
- Live policy checklist below New Password (BR-08): minimum 8 characters, upper +
  lower case, a number, a special character — each item shows a check/cross as the
  user types.
- Primary "Continue" button, disabled until all policy items pass and the two new
  password fields match.
- On success, the user proceeds directly into the application shell for their role.

## 4. Authenticated Application Shell
- Header: TokTickIT logo/title (left); role-specific nav (center) — Requester sees
  "My Tickets" / "+ Create Ticket"; IT Staff/Administrator sees "Ticket Queue"; an
  Administrator additionally sees "Admin" — Profile menu (right) showing the
  current user's name + Role badge, with "Change Password" and "Logout" actions.
- No destination the current role cannot use is ever rendered in the nav (FR-07);
  this is a display convenience only — every route is still enforced server-side
  (FR-08).
- Mobile: nav collapses into a menu; header stays sticky, no horizontal scroll.

## 5. Requester Screens (Lab 2, carried over + one addition)
Create Ticket, My Tickets, and Ticket Detail keep their Lab 2 layout exactly
(`docs/lab-02/ui-spec.md` §9–11), with the Development Requester context replaced by
the authenticated user. Ticket Detail gains:
- A **Public Comments** panel (chronological list: author name + Role badge,
  timestamp, content; a "Post Comment" composer at the bottom, append-only).
- A **"Mark problem as resolved"** secondary action, which shows a confirmation
  ("This lets IT Staff know your issue appears fixed; they'll still confirm and
  close the ticket.") and then a small "You marked this as resolved" indicator next
  to the status badge — never changes the Current Status badge itself (BR-05).
- No Internal Notes panel is ever rendered for a Requester, regardless of the
  Ticket's data (BR-04, AC-13).

## 6. IT Staff Ticket Queue
- Header: title "Ticket Queue", search box (ticket # or summary), "Filters" button
  opening Category / Requested Priority / IT Priority / Status / Owner
  (Unassigned/Me/named users) dropdowns.
- **Desktop (≥992px)**: table — Ticket No., Created Date, Summary, Category, Req.
  Priority, IT Priority, Status, Owner — sortable columns, row click opens Ticket
  Detail. Column set matches the handout's example fields; no mega-grid beyond
  these eight columns.
- **Tablet (768–991px)**: same table with Category and Created Date collapsed into
  an expandable row detail to avoid horizontal scroll.
- **Mobile (<768px)**: one card per ticket — Ticket No. + Status badge (top row),
  Summary, Owner, Req./IT Priority badges, Last Updated; entire card tappable.
- Pagination footer identical pattern to My Tickets.
- States: Loading (skeleton), Empty (no tickets exist system-wide — rare, informational
  only), No Results (filters excluded everything — "Clear Filters"), Forbidden
  (Requester somehow reaches this route client-side — safe redirect to their own My
  Tickets, never a raw 403 page), Failure (retry banner).

## 7. IT Staff Ticket Detail
Extends the Lab 2 Ticket Detail read-only info grid with editable-where-permitted
fields, clearly distinguished by the Lab 2 editable/read-only field style:
- **Ownership row**: Ticket Owner (dropdown of active IT Staff/Administrator +
  "Unassigned"; "Claim" quick-action button when unassigned) — editable.
- **Priority row**: Requested Priority (read-only), IT Priority (editable dropdown).
- **Status control**: dropdown restricted client-side to the transitions valid from
  the current status (server re-validates regardless, per §9 of `specification.md`);
  invalid attempts (e.g., stale client state) show the safe conflict message
  returned by the API.
- **Public Comments** panel: identical to the Requester's, plus visible to IT
  Staff/Administrator, who can also post.
- **Internal Notes** panel: visually distinct background (`--color-pale` with a
  "Internal — not visible to Requester" label in `--color-warning` text) so an
  author never mistakes it for a Public Comment; append-only composer at the
  bottom.
- **Attachments** panel: same as Lab 2, read/download only (no upload/remove by IT
  Staff in Lab 3).
- A small "Requester marked this as resolved" indicator appears near the status
  control when `appearsResolved = true`, prompting IT Staff to confirm/close.
- States: Loading, Not Found (unknown ticket id), Forbidden (Requester reaching this
  route), Failure (retry, all in-progress edits preserved where feasible).

## 8. Administrator User Management
Single screen, two-pane layout on desktop (list left/main, create/edit panel as a
slide-over on the right); stacked (list, then panel below) on tablet/mobile.
- **List pane**: search box (name/email), role filter dropdown ("All roles" default),
  table/cards showing Name, Email, Role badge, Status (Active/Inactive pill), and an
  "Edit" action per row. No pagination, multi-column sort, or multi-filter combo is
  required (handout §8.5) — a single scrollable list is sufficient.
- **Create User panel**: "+ Create User" button opens it. Fields: Full Name, Email,
  Role (single-select: Requester / IT Staff / Administrator), Active toggle
  (defaults on), Initial Password (masked input with a "Generate" helper button that
  fills a policy-compliant random value the Administrator can see and copy — never
  emailed, per handout exclusion list). Primary "Save User"; Secondary "Cancel".
- **Edit User panel**: same fields except Initial Password is replaced by a
  "Set New Initial Password" secondary action that opens a small confirmation
  ("This forces <name> to change their password at next login and signs them out
  everywhere.") before revealing the password field. A "Deactivate" destructive
  button appears here (relabelled "Reactivate" for an inactive user); disabled with
  a tooltip explaining the rule when it would violate the self-deactivation or
  last-Administrator safety rules (BR-24) — the button is disabled as a convenience
  only, since the API enforces the same rule regardless (FR-08).
- Validation: inline field errors (duplicate email, weak password, missing name);
  a top-of-panel banner for a safe API failure.
- States: Loading (list skeleton), Empty (no users — cannot realistically occur once
  seeded, but the empty state is implemented for completeness), No Results (search/
  filter excluded everything), Forbidden (non-Administrator reaching this route —
  safe redirect), Success (inline confirmation banner after save), Failure (retry,
  entered values preserved).

## 9. Visual Inspection Checklist (Lab 3 additions)
- [ ] Role badge colors consistent across header, user list, and comment/note authorship
- [ ] Internal Notes are visually unmistakable from Public Comments at a glance
- [ ] Status dropdown never offers a transition invalid per the matrix in `specification.md` §9
- [ ] Editable vs read-only fields on IT Staff Ticket Detail follow the Lab 2 style exactly
- [ ] Admin panel's disabled Deactivate button shows a clear tooltip, never a silent no-op
- [ ] No clipped text, overlap, or unintended horizontal scroll at 375px, 834px, 1280px widths on
      Login, Ticket Queue, Ticket Detail, and User Management

## 10. Screenshot Paths (Playwright)
```
artifacts/lab-03/screenshots/authentication/{desktop,tablet,mobile}.png
artifacts/lab-03/screenshots/staff-queue/{desktop,tablet,mobile}.png
artifacts/lab-03/screenshots/staff-ticket-detail/{desktop,tablet,mobile}.png
artifacts/lab-03/screenshots/user-management/{desktop,tablet,mobile}.png
```
