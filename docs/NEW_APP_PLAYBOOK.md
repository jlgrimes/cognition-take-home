# Playbook: add an internal app to the prototype platform

Use this when asked to add a new internal tool (app #N) to `prototype/`. The goal is that a new app is
mostly business rules plus screens, and reuses the platform for identity, RBAC, masking, audit and workflow.

## Read first
- `prototype/src/platform/types.ts`: the `AppModule` contract.
- `prototype/src/platform/workflow.ts`: state machine with permission checks, guards, required reasons, optimistic locking, audit.
- `prototype/src/apps/kyc/` and `prototype/src/apps/refunds/`: two reference apps. Copy their shape.
- `docs/MOCKED.md`: what is faked. Don't add real external calls; add a mock behind an interface and a row to MOCKED.md.

## Steps
1. `prototype/src/apps/<id>/module.ts`: export an `AppModule` with `id`, `name`, `description`, `href`, `navPermission`,
   `roles` (role -> permissions; reuse existing roles where they fit, add new ones if needed), `migrate` (CREATE TABLE IF NOT EXISTS;
   every mutable table needs `version INTEGER NOT NULL DEFAULT 1` and `updated_at`), and deterministic `seed` data.
2. `prototype/src/apps/<id>/workflow.ts`: a `Workflow<T>` for any record with a lifecycle. Put rules in `guard`s that return
   a human-readable string when blocked (the UI shows it). Use `requiresReason` for anything an auditor would ask "why" about.
3. Data access in `prototype/src/apps/<id>/data.ts` (or `service.ts`). Every function takes `user` and calls `assertCan` first.
   Every mutation goes through `applyTransition` or calls `writeAudit` inside the same DB transaction.
4. Register the app: one line in `prototype/src/apps/index.ts`. If new roles are needed for demo users, add them in
   `prototype/src/platform/demo-users.ts`.
5. Pages in `prototype/src/app/<id>/` (list, detail with `TransitionForm` + `AuditTimeline`, server actions using `runAndRedirect`).
   Check the permission at the top of each page with `notFound()` like the existing apps.
6. Tests in `prototype/src/test/<id>.test.ts` using `freshEnv()`: one test per guard/permission rule, plus one asserting the audit entry.
7. Tag any new fake with `// MOCK: ... See docs/MOCKED.md#<anchor>` and add a row to `docs/MOCKED.md`.

## Done when
`cd prototype && npm run typecheck && npm run lint && npm test && npm run build` all pass, and the app works in `npm run dev`
for the right demo users and returns 404 for the wrong ones.
