# Dragons of Mugloar

A full stack implementation of the Dragons of Mugloar assignment. The pnpm workspace contains a Vue frontend, Fastify API, PostgreSQL persistence layer, shared game policy, and CLI. The application supports manual play, recommendations, and bounded autoplay.

## Run with Docker Compose

Copy `.env.example` to `.env`, then run:

```sh
docker compose up --build
```

Open <http://localhost:8080>. The web service proxies API and server-sent event traffic to Fastify. PostgreSQL data remains in a named volume when the stack stops. To remove that data, run `docker compose down --volumes`.

## Local development

Copy `.env.example` to `.env`, install dependencies, start PostgreSQL, apply migrations, and run the app:

```sh
pnpm install
docker compose -f compose.dev.yaml up -d
pnpm --filter @mugloar/db migrate:local
pnpm dev
```

The Vue app runs at <http://localhost:5173> and the API at <http://localhost:3000>.

## CLI

The CLI reads `UPSTREAM_BASE_URL` and `DATABASE_URL` from `.env`:

Build the workspace packages first; the CLI loads their compiled `dist` entry points. Rerun `pnpm build` after changing package code.

```sh
pnpm build
pnpm --filter @mugloar/cli start -- play
pnpm --filter @mugloar/cli start -- autoplay
pnpm --filter @mugloar/cli start -- autoplay --games 20
```

Manual play accepts a task number, `b` plus a shop number, or `q` to quit. Autoplay runs 1–100 independent games sequentially (default 1), using the same decision policy as manual recommendations. Each game stops at death, after 100 actions, after ten minutes, or when no supported task is available. Game state and actions are persisted to PostgreSQL.

To run either CLI command in Docker, use the Compose `cli` profile. Compose starts PostgreSQL and applies migrations before launching the CLI container:

```sh
docker compose --profile cli run --build --rm cli pnpm --filter @mugloar/cli start -- play
docker compose --profile cli run --build --rm cli pnpm --filter @mugloar/cli start -- autoplay --games 20
```

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm check
pnpm clean
```

`pnpm clean` removes generated `dist` directories from the workspace apps and packages.

Containerized checks are available with `docker compose --profile tooling run --build --rm tooling`.

## Project docs

- [Game rules](docs/GAME_RULES.md): the upstream interface and mechanics used by the application.
- [Strategy](docs/STRATEGY.md): the current shared recommendation and autoplay policy.
- [Database schema](docs/DATABASE_SCHEMA.md): Mermaid diagram aligned with Drizzle definitions and migrations.
