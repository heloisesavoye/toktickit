# Lab 4 UI Specification — Dashboards, Actions Taken, Workflow, Final Polish

Extends `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md`. Every new screen
reuses the Zen Green tokens in `client/src/theme/tokens.css` and the existing
`Badge`, `Button`, `.card`, `.field`, `.callout` components. No new colors are
introduced except the two status-badge tints listed in §6.

## 1. Navigation (all roles)

| Role | Nav entries (in order) | Landing page |
|---|---|---|
| Requester | Dashboard · My Tickets · + Create Ticket | Dashboard |
| IT Staff | Dashboard · Ticket Queue | Dashboard |
| Administrator | Dashboard · Ticket Queue · Admin | Dashboard |

- Active page: white bold text **and** a 3 px underline, plus `aria-current="page"`
  (not color alone).
- Detail screens keep their parent entry active (Ticket Detail → My Tickets or
  Ticket Queue).
- On < 768 px the header wraps into two rows; nav buttons stay ≥ 44 px tall.

## 2. Requester Dashboard
```
┌ Welcome, Jennifer! ───────────────────────────── [Refresh] ┐
│ Here's the latest on your requests.                        │
├──────────────┬──────────────┬──────────────┬──────────────┤
│ My Open      │ Waiting for  │ Resolved     │ Closed       │
│ Tickets  3   │ Me       1   │          2   │          5   │
│ View all →   │ View all →   │ View all →   │ View all →   │
├──────────────┴──────────────┼──────────────┴──────────────┤
│ Needs your attention        │ Quick Actions                │
│ TKT-… summary  [Waiting…]   │ [+ Create Ticket]            │
│ Recently updated            │ [View My Tickets]            │
│ TKT-… summary  [In Prog.] date                             │
└─────────────────────────────┴──────────────────────────────┘
```
- Each metric card is a `<button>` whose accessible name is
  "`<label>`: `<count>`, view list" and opens My Tickets with the card's filter.
- List rows are buttons opening Requester Ticket Detail.
- Empty states: lists show "Nothing needs your attention right now." /
  "No updates in the last 7 days."; cards show 0 with "Nothing here".
- Requester with no tickets at all: callout "You haven't raised any tickets yet"
  with a "Create Ticket" button.

## 3. IT Staff Dashboard
- Header "Welcome back, `<name>`!" + "Here's what's happening with your queue
  today." + Refresh button.
- Five metric cards: Unassigned, New, In Progress, Waiting for Requester,
  My Assigned → each opens the Ticket Queue with filters applied (the Queue shows
  a "Filtered from dashboard: … [Clear]" chip).
- Left column: **My open Actions Taken** (ticket number, description, action
  date, "Follow-up" badge when required) then **Recently updated** tickets.
- Right column: **Urgent tickets** (High IT priority, active), **Tickets by
  status** (8 rows: label, count, small bar — bar has the count as text so color is
  not needed), **Quick Actions** (Ticket Queue, Unassigned, My Queue).
- Administrator only: **Active users** card (Requesters / IT Staff /
  Administrators) linking to User Management.
- Grid: 5 cards per row ≥ 1024 px, 2 per row 768–1023 px, 1 per row < 768 px.

## 4. Actions Taken (IT Staff Ticket Detail)
Placed between the Ticket summary card and Attachments.

### List mode
| Date/Time | Description | Result | Performed by | Assignee | Follow-up | Status | |
|---|---|---|---|---|---|---|---|
| 4 Nov 2026 12:30 | Re-seated dock… | Monitor OK… | Priya N. | Priya N. | Yes ⚑ | Open | View / Edit |

- Ordered by date/time then id (stable). Long text truncated with an ellipsis in
  the table; full text in view mode.
- < 768 px: each action becomes a stacked card (label: value rows).
- Empty: "No actions recorded yet. Add the first action to start tracking work."

### Create mode ("+ Add action" button, disabled when Ticket is Closed/Cancelled
with the reason shown)
Fields: Action Date/Time (`datetime-local`, default now), Action Description*
(textarea), Result* (textarea), Assignee (select of active IT Staff/Admins,
default me), Follow-Up Required? (Yes/No radio), Follow-up Note (shown and
required only when Yes), Attachment Notes (input, hint "Which file to look at,
e.g. screenshot.png"). Performed by is shown read-only as the current user.
Buttons: Save action (primary) · Cancel (tertiary).

### View/Edit mode
Opens the same form pre-filled. Open actions are editable; Completed and
Cancelled actions are read-only (`data-readonly`, grey background) and show the
completion/cancellation time. Open actions also show **Mark completed** (primary)
and **Cancel action** (destructive, confirmation dialog with focus trapped and
Escape to close).

### Feedback
- Validation errors under each field (`.field-error`, `aria-describedby`) and a
  summary at the top of the form; first invalid field receives focus.
- Save button shows "Saving…" and is disabled while in flight (no duplicates).
- Success: inline "Action saved" status message, list refreshes.
- `STALE_UPDATE`: warning callout "Someone else changed this action. Your text
  is kept below — reload to see their version." with a Reload button. Entered
  values are preserved.
- Network/500: "Couldn't save. Your entries are kept — try again." Values kept.

## 5. Ticket Workflow on Ticket Detail
- Status select lists the current status and only the §9 transitions.
- If "Resolved" is a matrix option but the gate is unmet, it is shown
  `disabled` with the text "(complete an action first)" and a hint under the
  select explaining the reason from `resolutionGate.reason`.
- `RESOLUTION_BLOCKED`, `INVALID_TRANSITION`, `STALE_UPDATE` responses show the
  server message in an alert callout; the summary reloads.
- **Status history** list under the summary: "4 Nov 12:31 — Priya N. changed
  In Progress → Resolved", oldest first.
- Requester "appears resolved" flag shown as a success-colored text label.

## 6. Status and Priority Badges
Status badges always show the human label ("Waiting for Requester") plus color:
New/Open/Reopened = pale green, In Progress = amber tint, Waiting = blue-grey,
Resolved = green, Closed/Cancelled = neutral grey. Priority badges unchanged.
Action status: Open = amber "Open", Completed = green "Completed", Cancelled =
grey "Cancelled".

## 7. Requester Ticket Detail
Adds a read-only "Actions Taken by IT Support" section listing date/time,
description, result, performed by, follow-up note, attachment notes, and status.
No edit controls, no assignee select, no Internal Notes.

## 8. Loading, Empty, Forbidden, Safe-Failure States (all Lab 4 screens)
| State | Presentation |
|---|---|
| Loading | `role="status"` text "Loading dashboard…" / skeleton cards |
| Empty | Card counts 0 + list hint text |
| Forbidden (403) | Callout "You don't have access to this page." + link to own dashboard |
| Not found (404) | Callout "Ticket not found." + Back button |
| Safe failure (5xx/network) | Callout "Couldn't load … Try again." + Retry button |

## 9. Responsive and Accessibility (same rules as Labs 2–3)
Breakpoints 1024 / 768. Touch targets ≥ 44 px. No horizontal page scroll; wide
tables scroll inside their own container or become cards. Visible focus ring
(`outline: 2px solid var(--color-secondary)`). Every input has a `<label>`.
Dialogs use `role="dialog"`, `aria-modal`, trap focus, restore focus on close.

## 10. Visual and Accessibility Checklist (completed at release)
| # | Check | Desktop | Tablet | Mobile |
|---|---|---|---|---|
| V-01 | Zen Green header, tokens, card style identical across all screens | ☐ | ☐ | ☐ |
| V-02 | Dashboard cards: label, value, drill-down link, no clipping | ☐ | ☐ | ☐ |
| V-03 | Actions Taken table/cards readable, no overlap | ☐ | ☐ | ☐ |
| V-04 | Editable vs read-only fields visibly different | ☐ | ☐ | ☐ |
| V-05 | Validation messages placed under their field | ☐ | ☐ | ☐ |
| V-06 | Status/priority shown with text + color | ☐ | ☐ | ☐ |
| V-07 | Private (Internal Notes) vs shared content visually distinct | ☐ | ☐ | ☐ |
| A-01 | Keyboard reaches every control in logical order; focus visible | ☐ | ☐ | ☐ |
| A-02 | Active nav has `aria-current` | ☐ | ☐ | ☐ |
| A-03 | Confirmation dialog traps focus, Escape closes | ☐ | ☐ | ☐ |
| R-01 | No horizontal page scroll at 1280 / 768 / 375 | ☐ | ☐ | ☐ |
| R-02 | No leftover placeholder text, debug UI, or console errors | ☐ | ☐ | ☐ |

Screenshots: `artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken}/{desktop,tablet,mobile}.png`
(captured by `e2e/lab-04/dashboards.spec.ts` and `actions-taken-flow.spec.ts`).
