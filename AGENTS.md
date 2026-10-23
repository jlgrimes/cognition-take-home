# Agent notes

- The app lives in `prototype/` (Next.js 15 + TypeScript + SQLite via better-sqlite3). Node 22+.
- Checks: `cd prototype && npm ci && npm run typecheck && npm run lint && npm test && npm run build`.
- Local DB is `prototype/data/app.db`, created and seeded on first request. `npm run db:reset` to start over.
- Adding an internal app: follow `docs/NEW_APP_PLAYBOOK.md`.
- Anything faked is tagged `// MOCK:` and listed in `docs/MOCKED.md`. Keep both in sync.
