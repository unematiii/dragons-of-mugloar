# Project conventions

## Scope and architecture

- Use `docs/GAME_RULES.md` for verified game mechanics, `docs/STRATEGY.md` for the current recommendation policy, and `docs/DATABASE_SCHEMA.md` for the maintained database diagram. Keep hypotheses separate from verified rules and preserve raw evidence when discovering mechanics.
- Use the pnpm workspace, Vue frontend, Fastify backend, PostgreSQL/Drizzle, and Docker Compose.
- Support independent players and games. Authorize every game operation and event subscription; serialize actions per game while allowing different games to progress concurrently.
- Heuristic recommendations, ranked alternatives, and supported explanations are required UI/autoplay features. Reuse one shared decision contract and baseline policy for both; do not label heuristic scores as probabilities.
- Comment non-obvious code to explain its reasoning, constraints, or invariants. Avoid comments that merely restate what the code already says.

## Imports and module entry points

- In the Vue app, use the `@/` alias for imports rooted under `apps/web/src`. When multiple files from a feature or module are imported elsewhere, expose the public API through that folder's `index.ts` and import from the barrel instead of repeating long deep paths.
- Keep aliases aligned between Vite and the frontend TypeScript configuration. Do not use `@/` in the NodeNext API, CLI, or packages unless runtime resolution is configured too; those scopes use package exports and `.js` relative imports as documented below.
- Keep imports grouped and sorted by the ESLint `import/order` rule: external modules, workspace packages, then local modules, with blank lines between groups.
- Define CLI subcommands and options with Commander in `apps/cli/src/index.ts`; do not branch on raw `process.argv` values outside Commander setup.

## Vue component structure

- Keep Vue components focused and self-contained; avoid growing page components into large collections of unrelated markup and behavior.
- Extract repeated UI into reusable components and stateful behavior into composables when that makes responsibilities clearer. Avoid abstractions that only add indirection.
- Split substantial page sections or alternate views into focused components with typed props and events, and switch between them explicitly from a small parent coordinator.
- Keep business decisions and side effects out of templates and computed properties; components should present state and emit user intent.

## Required static checks

- Keep the configured typechecking, ESLint, formatting, and CI checks working as features change. Root scripts are defined in `package.json`; CI runs the formatting, lint, typecheck, test, and build commands.
- Typecheck frontend `.vue` scripts/templates with `vue-tsc --noEmit`; backend, CLI, shared packages, and Node tooling with the appropriate `tsc --noEmit` projects. Do not treat a Vite build as typechecking.
- Use strict TypeScript, checked indexed access, exact optional properties, return/fallthrough checks, and environment-specific tsconfigs. Do not mix browser DOM types into the API or Node globals into browser source.
- Use ESLint flat config with recommended ESLint rules, type-aware typescript-eslint rules, Vue 3 recommended rules, and scoped Node/browser/test configurations. Cover tests and config files as well as application source.
- Enforce handled promises, safe use of unknown values, no explicit `any`, consistent type imports, unused-variable checks, exhaustive union handling, and package boundaries. Vue rules must catch prop mutation, invalid/keyless loops, and computed side effects; do not render upstream game text with `v-html`.
- Keep API logging structured; scope console allowances to CLI/tooling/test needs. Keep exceptions narrow and explained; report unused disable directives and do not weaken global rules to bypass failures.
- Use Prettier with conflicting ESLint formatting rules disabled. Root commands are `pnpm typecheck`, `pnpm lint`, `pnpm lint:fix`, `pnpm format:check`, `pnpm format`, and `pnpm check`; implement them during scaffolding and run relevant checks before reporting code complete.
- The `tooling` profile in `compose.yaml` runs `pnpm check`; keep it available alongside the host commands.

## Fastify conventions

Organize the Fastify HTTP layer into domain modules with explicit routes, thin controllers, runtime schemas, and derived transport types. Keep application services separate from HTTP handling and pure game rules.

Each HTTP domain module under `apps/api/src/api/<domain>/` has:

```text
index.ts
controller.ts
schemas.ts
types.ts
routes.ts
```

- `index.ts` exports the public module API. Composition imports route plugins through it; internal files import siblings directly.
- `routes.ts` exports a `FastifyPluginAsyncTypebox` plugin containing route methods, paths, schemas, hooks/options, and named controller references. No inline handlers or business logic.
- `controller.ts` exports named, thin HTTP handlers. Delegate game behavior to services under the domain module's `services/` directory and pure game rules to `packages/game`. SSE transport handling may remain in controllers; authorization and event sourcing remain in services.
- `schemas.ts` defines TypeBox schemas or imports/re-exports shared schemas from `packages/contracts`.
- `types.ts` derives transport types using `Static<typeof Schema>` or re-exports shared derived types. Do not duplicate schema-defined interfaces.
- `app.ts` provides an injectable `buildApp` factory, configures plugins/hooks/errors, and registers module route plugins. No route declarations, including health endpoints, outside route modules.
- `index.ts` is the process entry point: load validated environment, construct dependencies, listen, and shut down gracefully. Do not listen when importing the app factory.
- Declare typed request/server decorations in `fastify.d.ts`; keep authentication hooks under `src/hooks/`. Never store per-player request identity or a global current game in shared mutable service fields.
- Use TypeBox runtime validation for route schemas. Return consistent structured errors through centralized error handling.
- Use strict TypeScript, ESM/NodeNext, and `.js` extensions in relative server imports. Local API routes use `/v1`; upstream game API uses `/api/v2`.
- Inject services/adapters into the factory for tests; test HTTP behavior using Fastify injection. Keep CLI execution independent of opening an HTTP server.

## Database schema documentation

- Keep the Mermaid ER diagram in `docs/DATABASE_SCHEMA.md` synchronized with `packages/db/src/schema.ts` and the migration SQL.
- Any table, column, key, uniqueness, or foreign-key change must update the diagram in the same change. Reconcile the diagram, Drizzle definitions, and migrations before treating schema work as complete.
