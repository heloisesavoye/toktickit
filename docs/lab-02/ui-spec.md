# Lab 2 UI Specification — Zen Green Theme

## 1. Color Tokens
| Token | Value | Use |
|---|---|---|
| `--color-primary` | #006B3C | Header, primary buttons, strong emphasis |
| `--color-secondary` | #0B7A46 | Active tab, focus ring, links, hover |
| `--color-pale` | #EAF6EF | Selected/success background, section emphasis |
| `--color-bg` | #F5F7F6 | Page background |
| `--color-surface` | #FFFFFF | Cards, panels (1px #E2E8E4 border, subtle shadow) |
| `--color-text` | #1F2A24 | Body text (dark charcoal-green, not pure black) |
| `--color-error` | #B3261E | Error text/border |
| `--color-warning` | #B9770E | Warning callouts/badges only |
| `--color-success` | #1E7A46 | Success confirmation |

## 2. Typography & Spacing
- Base font size 16px, headings scale 24/20/16px, line-height 1.5 for body text.
- Spacing scale: 4/8/12/16/24/32px; form fields use 16px vertical rhythm.
- All interactive elements have a minimum 44×44px touch target on mobile.

## 3. Field States
| State | Style |
|---|---|
| Editable | White background, 1px neutral border (#C9D6CE), radius 8px |
| Read-only | Soft gray-green (#F1F4F2) background, same border, not focusable via tab-to-edit |
| Focused | 2px `--color-secondary` outline, no color-only cue |
| Invalid | `--color-error` border + text; message directly below the field |
| Disabled | 50% opacity, `not-allowed` cursor, no hover/focus change |

Required fields show a red asterisk **and** a validation message on blur/submit — the asterisk
never replaces the message.

## 4. Button Hierarchy
- **Primary** (`--color-primary` fill, white text): main action (Submit, Continue).
- **Secondary** (white fill, `--color-secondary` border/text): Cancel, Change Requester.
- **Tertiary** (text-only, `--color-secondary`): Clear Filters, links.
- **Destructive** (`--color-error` border/text on white): Remove Attachment.
- **Disabled**: 50% opacity of its variant, non-interactive.
- **Busy**: spinner + disabled state; label changes to "Submitting…" and button is non-clickable.

## 5. Badges
- Requested/IT Priority: LOW = pale-green pill, MEDIUM = amber pill, HIGH = red-tinted pill —
  always paired with the text label, never color alone.
- Current Status: NEW = gray pill, OPEN = blue-gray pill, IN_PROGRESS = amber pill,
  PENDING = gray-blue pill, RESOLVED = green pill.

## 6. Screen States (all screens)
Every data-driven screen implements: **Loading** (skeleton or spinner, no layout jump), **Empty**
(no data ever, with a call-to-action), **No Results** (filters/search excluded everything, with a
"Clear Filters" action), **Error/Failure** (safe generic message + retry, form values preserved),
**Success** (confirmation banner/inline message).

## 7. Application Shell
- Header: TokTickIT logo/title (left), "My Tickets" / "+ Create Ticket" nav (center), current
  Requester name + "Profile ▾" with a "Change Requester" action (right).
- Active nav item underlined/colored with `--color-secondary`.
- Mobile: nav collapses into a hamburger/menu; header remains sticky, no horizontal scroll.

## 8. Development Requester Selection Screen
- Centered card, max-width ~480px, on `--color-bg`.
- Title "Select Development Requester" + one-line disclaimer: "This is for testing only and is not
  a login screen."
- Single-select dropdown of active Requesters (BR-04), keyboard accessible (arrow keys + Enter).
- Info callout (pale green): "Only active development requesters are shown."
- Secondary callout: "Authentication coming in Lab 3."
- Primary "Continue" button; Secondary "Cancel" (returns to app default/last selection if any).
- States: Loading (dropdown skeleton), Empty (no active Requesters — message + support contact
  text, no Continue), Error (safe retry message).

## 9. Create Ticket Screen
Layout (desktop, 2-column where sensible):
1. **Header row**: page title "Create Ticket", Requester (read-only, from context).
2. **Classification group**: Category, Related System, Requested Priority — grouped side by side.
3. **Content group**: Summary (single line, full width) then Description (textarea, resizable
   vertically only, full width, ~6 rows).
4. **Attachments section**: drag-and-drop/file-picker, list of selected files with size and a
   remove-before-submit control, inline error per invalid file (type/size/count).
5. **Actions**: Primary "Submit Ticket" (busy state while pending), Secondary "Cancel" — bottom
   right, sticky on mobile.

States: initial (blank/defaulted), validation (field-level messages, focus moves to first invalid
field), submitting (Submit busy, all fields disabled), success (banner with the generated Ticket
Number + "View Ticket" / "Create Another" actions), API failure (banner + all entered values
retained), invalid attachment (per-file inline error, valid files unaffected).

## 10. My Tickets Screen
- Header: title, "Create Ticket" primary button (top right), "Clear Filters" tertiary button.
- Filter row: search box (ticket # or summary), Category / Requested Priority / IT Priority /
  Status dropdowns — all in one row on desktop, stacked on mobile.
- **Desktop (≥992px)**: table with columns Ticket No., Created Date, Summary, Category, Requested
  Priority, IT Priority, Current Status, Last Updated — each sortable column shows a sort-direction
  icon; row click opens Ticket Detail.
- **Mobile (<768px)**: one card per ticket showing Ticket No. + Status badge (top row), Summary,
  Category, Requested Priority, Last Updated; entire card is tappable.
- Pagination footer: "Showing X to Y of Z tickets" + Previous/page-numbers/Next, touch-friendly.
- States: Loading (skeleton rows/cards), Empty (never created a ticket — CTA to Create Ticket),
  No Results (search/filter excluded all — "Clear Filters" CTA), Failure (retry banner).

## 11. Requester Ticket Detail (View Mode)
- Breadcrumb: "My Tickets > Ticket Details" with "← Back to My Tickets".
- Read-only info grid (2–4 columns desktop, 1 column mobile): Ticket No., Ticket Date, Category,
  Related System, Requester, Requested Priority, IT Priority, Current Status.
- Summary and Description in full-width read-only panels.
- **Attachments panel**, clearly separated from ticket info: list of active attachments (filename,
  size, uploaded date, Download button) + "Add Attachment" control; removed attachments shown in a
  collapsed/secondary list (filename, removed date, reason) with no download control.
- Remove flow: destructive "Remove" button per active attachment → confirmation dialog requiring a
  removal-reason text field → submit.
- No Public Comments / Internal Notes / Actions Taken sections exist in Lab 2.
- States: Loading, Not Found/Not Owned (safe "ticket not found" message, no leak of existence),
  Failure (retry).

## 12. Responsive Rules
| Viewport | Rule |
|---|---|
| Desktop ≥992px | Multi-column as above; content max-width ~1200px, centered |
| Tablet 768–991px | Two columns where practical; Summary/Description get full row width |
| Mobile <768px | Single column, stacked fields, touch-friendly buttons (≥44px), no horizontal scroll |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, attachment names wrap/truncate with tooltip rather than overflow |

## 13. Accessibility
- Every control has a visible label (icon-only controls get `aria-label` + tooltip).
- Focus ring always visible (2px `--color-secondary`), never removed via CSS reset.
- Color is never the only signal (badges/messages always paired with text).
- Full keyboard operability: dropdown, file picker, pagination, remove-confirmation dialog.

## 14. Visual Inspection Checklist
- [ ] Colors match tokens above on all screens
- [ ] Editable vs read-only fields visually distinct
- [ ] Validation messages appear under the correct field, not only at the top
- [ ] Button hierarchy consistent (Primary/Secondary/Tertiary/Destructive/Disabled/Busy)
- [ ] No clipped text, overlap, or unintended horizontal scroll at 375px, 834px, 1280px widths
- [ ] Priority/Status badges legible and consistent across My Tickets and Ticket Detail
- [ ] Filters, pagination, attachment controls usable at all three breakpoints

## 15. Screenshot Paths (Playwright)
```
artifacts/lab-02/screenshots/create-ticket/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/my-tickets/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/ticket-detail/{desktop,tablet,mobile}.png
```
