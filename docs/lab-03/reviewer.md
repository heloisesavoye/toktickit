# Lab 3 Peer Review Log

## Reviewer Identity
- Reviewer: yosko91 (GitHub handle; classmate on CPE 334)
- Author: Héloïse Savoye, 695404618

## Pull Requests

| PR # | Branch → Target | Description | Reviewer | Comments Given | Comments Received | Status |
|---|---|---|---|---|---|---|
| [#11](https://github.com/heloisesavoye/toktickit/pull/11) | lab3/implementation → main | Session auth, RBAC, IT Staff ticketing workflow, Admin user management, full Lab 3 test suite (172/172 server, 35/35 client, 72/72 E2E passing) | yosko91 | 5 line comments + 1 overall review | 4 replies | **Approved**, merged into `main` |

## Review Comments and Responses

**1. `client/src/components/UserManagement.tsx`, line ~23 (`randomPassword`)**
> Good catch fixing this to guarantee one char from each required class — I actually hit this exact issue testing locally last week (create-user kept silently failing) but didn't have time to dig into why. Nice root-cause fix instead of just retrying until a valid password comes out.

*Response:* Thanks! Yeah, this one was sneaky since it fails silently client-side — good to know you'd hit the same thing locally. Glad the fix confirms the root cause.

**2. `client/src/components/StaffTicketQueue.tsx`, the `cancelled` flag in the fetch effect**
> Makes sense as a race-condition guard. Slight nit: might be simpler/more idiomatic to use an AbortController and pass `signal` into `api.listStaffTickets()` so the actual HTTP request gets cancelled too, not just its effect on state — right now the stale request still completes on the server even though we ignore the response. Not blocking, just a thought for later.

*Response:* Good point, and you're right that the stale request still hits the server even though we ignore its response. I kept it simple with just the `cancelled` flag for now since the app doesn't have heavy traffic, but wiring an `AbortController` + `signal` into `api.listStaffTickets()` would be the more correct fix — noting it as a follow-up.

**3. `e2e/lab-03/staff-ticket-flow.spec.ts`, the `openUnassignedTicket` / claim test**
> Smart fix making this idempotent instead of assuming a fresh DB. One question: since all 3 Playwright projects share one dev DB and one staff account, is there a risk two projects claim/comment on the same ticket concurrently and one test's assertion reads the other's data? Might be worth each project using a different seeded ticket number if this gets flaky again.

*Response:* Yes, that risk is real in theory, but in practice each project claims/asserts through its own browser context and the test only checks the ticket it just claimed (not a specific pre-seeded number), so there's no cross-project read of shared state right now. If it does get flaky again, giving each project its own seeded ticket number is exactly the fix I'd reach for first.

**4. `server/src/routes/auth.ts`**
> LGTM — the generic 401 message correctly doesn't leak whether the account exists or the password was wrong (BR-06). Confirmed via the E2E "Invalid password" and "Inactive account" tests.

*Response:* Thanks for double-checking against the E2E tests.

**5. `docs/lab-03/ai-use.md`, prompt #11**
> Minor: this is a great writeup of the debugging process — good transparency on what the AI got wrong at first (env var theories) before finding the real bug.

*Response:* Glad the debugging writeup was useful — wanted to keep it honest about the dead ends, not just the final fix.

## Approvals

- **Initial review** (7 hours before merge): *"Your work is good, i see no problem in it. I approve the merging."*
- **Follow-up detailed review** (46 minutes before merge): 5 line comments as above, overall verdict: *"Approving with the AbortController comment as a non-blocking suggestion."*
- PR #11 was approved twice by yosko91 and merged into `main`.
