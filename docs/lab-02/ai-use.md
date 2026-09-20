# Lab 2 AI Use and Reflection

## LLM Used
Claude (Anthropic) — used as both the AI specification agent (drafting/refining
`specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`) and the AI coding agent
(implementing routes, components, and tests against that contract).

## Key Prompts

| # | Prompt (summary) | Purpose | Outcome |
|---|---|---|---|
| 1 | "Turn the Lab 2 handout into specification.md with numbered FR/BR/AC" | Spec-DD drafting | Draft spec generated, then reviewed/edited by student |
| 2 | "List ambiguities and conflicts in the contract before writing code" | Contract review | Surfaced ownership-error status code question (404 vs 403), resolved as 404 |
| 3 | "Implement the planned API tests first; confirm they fail for the expected reason" | TDD | Generated failing tests for create-ticket before route existed |
| 4 | "Implement only the Create Ticket screen and reusable Zen Green components" | Scoped implementation | Component built without touching My Tickets/Detail |
| 5 | "Implement My Tickets: owned, paginated list with search/filter/sort/loading/empty/no-results/failure states" | Scoped implementation | MyTickets.tsx + API route generated together |
| 6 | "Implement the Development Requester context: seed, selector, active-requester API, Change Requester" | Scoped implementation | RequesterContext + selection screen + /api/requesters |
| 7 | "Implement Requester Ticket Detail and attachment lifecycle; ownership enforced server-side" | Scoped implementation | Detail screen + attachment upload/download/soft-remove |
| 8 | "Audit the implementation against every acceptance criterion and planned test; report missing evidence" | Completion review | Used to catch AC-17 not yet mapped to a test |
| 9 | "Do not accept 'done' when tests are skipped or unrelated to the acceptance criteria" | QA gate | Applied before merging each PR |
| 10 | "Explain the ownership-check design decision so I can defend it" | Understanding, not just output | Enabled explaining 404-vs-403 choice in review |

## My Reflection
_[2–4 sentences, in your own words: what worked well using an AI agent under Spec-DD/TDD, what
you had to correct or push back on, and one thing you understood better by writing the spec
yourself before handing it to the coding agent.]_
