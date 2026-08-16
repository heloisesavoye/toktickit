# Lab 1 — AI Use and Reflection

**LLM/agent used:** Claude (Anthropic)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Explain the whole project and what each Issue requires | Used it to understand the 3 code Issues and docs to fill |
| 2 | Install Node.js and PostgreSQL on Windows | Followed the guide; troubleshot a broken download link and PATH issues |
| 3 | npm/psql not recognized errors | Diagnosed missing installs and PATH configuration |
| 4 | Do the GitHub workflow entirely in browser, no terminal | Learned branch/edit/commit/PR/merge via github.com |
| 5 | Code for Issue 2 (health check route) | Implemented /api/health in app.ts |
| 6 | Code for Issue 3 (idempotent category seed) | Implemented seed.ts with prisma.category.upsert |
| 7 | Code for Issue 4 (categories route + frontend states) | Implemented /api/categories, checkSystem(), and UI states |
| 8 | Prisma migrate fails - shadow database / missing model errors | Diagnosed missing CREATEDB permission and missing Category model in schema.prisma |
| 9 | Tests for categories.test.ts and App.test.tsx | Implemented tests following provided patterns |

## Reflection
Giving the agent precise, step-by-step instructions worked far better than vague requests, especially for GUI steps. One place I had to correct: the schema.prisma file still had an unfilled Category model TODO that I had missed when doing Issue 3 on GitHub directly — this only surfaced once I ran `npx prisma migrate dev` locally, showing the importance of actually running the code, not just writing it.
