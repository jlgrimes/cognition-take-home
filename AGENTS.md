# Agent notes

- The app lives in `prototype/`, an npm-workspaces monorepo (Next.js 15 + TypeScript + SQLite via better-sqlite3). Node 22+.
  `packages/platform` (shared core), `packages/<app>` (one per internal app), `apps/console` (Next.js host).
- Commit directly to `main`; no PRs for this prototype. `git pull --rebase` before pushing; other sessions push too.
- Checks: `cd prototype && npm ci && npm run typecheck && npm run lint && npm test && npm run build`.
- Local DB is `prototype/apps/console/data/app.db`, created and seeded on first request. `npm run db:reset` to start over.
- Adding an internal app: follow `docs/NEW_APP_PLAYBOOK.md`.
- Anything faked is tagged `// MOCK:` and listed in `docs/MOCKED.md`. Keep both in sync.
