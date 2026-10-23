# Playbook: add an internal app to the prototype platform

Use this when asked to add a new internal tool (app #N) to `prototype/`. The goal is that a new app is
mostly business rules plus screens, and reuses the platform for identity, RBAC, masking, audit and workflow.

## Layout
`prototype/` is an npm-workspaces monorepo: `packages/platform` (shared core), one `packages/<app>` per internal app
(domain rules, schema, tests; no React pages), and `apps/console` (the Next.js host that renders every app's pages).

## Read first
- `packages/platform/src/types.ts`: the `AppModule` contract.
- `packages/platform/src/workflow.ts`: state machine with permission checks, guards, required reasons, optimistic locking, audit.
- `packages/kyc/` and `packages/refunds/`: two reference apps. Copy their shape (package.json `exports`, tsconfig).
- `docs/MOCKED.md`: what is faked. Don't add real external calls; add a mock behind an interface and a row to MOCKED.md.

## Steps
1. Create `packages/<id>/` (copy `package.json` + `tsconfig.json` from `packages/kyc`, rename to `@internal/<id>`). `src/module.ts`: export an `AppModule` with `id`, `name`, `description`, `href`, `navPermission`,
   `roles` (role -> permissions; reuse existing roles where they fit, add new ones if needed), `migrate` (CREATE TABLE IF NOT EXISTS;
   every mutable table needs `version INTEGER NOT NULL DEFAULT 1` and `updated_at`), and deterministic `seed` data.
2. `src/workflow.ts`: a `Workflow<T>` for any record with a lifecycle. Put rules in `guard`s that return
   a human-readable string when blocked (the UI shows it). Use `requiresReason` for anything an auditor would ask "why" about.
3. Data access in `src/data.ts` (or `src/service.ts`). Every function takes `user` and calls `assertCan` first.
   Every mutation goes through `applyTransition` or calls `writeAudit` inside the same DB transaction.
4. Register the app: add `@internal/<id>` to `apps/console/package.json` dependencies and `next.config.ts` `transpilePackages`,
   one line in `apps/console/src/apps.ts`, then `npm install` from `prototype/`. If new roles are needed for demo users, add them in
   `packages/platform/src/demo-users.ts`.
5. Pages in `apps/console/src/app/<id>/` (list, detail with `TransitionForm` + `AuditTimeline`, server actions using `runAndRedirect`).
   Check the permission at the top of each page with `notFound()` like the existing apps.
6. Tests in `packages/<id>/src/<id>.test.ts` using `createTestEnv([yourModule])` from `@internal/platform/testing`: one test per guard/permission rule, plus one asserting the audit entry.
7. Tag any new fake with `// MOCK: ... See docs/MOCKED.md#<anchor>` and add a row to `docs/MOCKED.md`.

## Patterns and gotchas (from building app #3)
- **Approve, then apply something else.** A transition only updates its own record. If approving must also change another
  table (e.g. a flag change request updating the flag), wrap the approve transition and the follow-up write in one outer
  `db.transaction`, as `packages/flags/src/service.ts` and `packages/refunds/src/service.ts` do, and have the UI call the service, not
  `applyTransition` directly.
- **Guards can't query the database.** They only see the record and the user. Rules like "one open request per flag" go in
  the service function, before `applyTransition`.
- **Unit tests don't cover the UI.** They call workflows directly, so a broken form still passes. Click every action in
  `npm run dev` before calling it done.

## Done when
`cd prototype && npm install && npm run typecheck && npm run lint && npm test && npm run build` all pass, and the app works in `npm run dev`
for the right demo users and returns 404 for the wrong ones.
