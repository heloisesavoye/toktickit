# TokTickIT

## Setup
1. `cd server && npm install && cp .env.example .env`
2. `cd ../client && npm install && cp .env.example .env`
3. In server/: `npx prisma migrate dev --name init` then `npm run prisma:seed`
4. Run: `npm run dev` in server/, then `npm run dev` in client/
5. Tests: `npm test` in server/ and in client/
