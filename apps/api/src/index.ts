import { createDatabase } from '@mugloar/db';
import { createUpstreamClient } from '@mugloar/game';

import { closeGameEventStreams } from './api/games/index.js';
import { buildApp } from './app.js';
import { loadEnvironment } from './env.js';

const environment = loadEnvironment();

const database = createDatabase(environment.DATABASE_URL);
const upstream = createUpstreamClient({ baseUrl: environment.UPSTREAM_BASE_URL });
const app = buildApp({
  db: database.db,
  upstream,
  secureCookies: environment.SESSION_COOKIE_SECURE === 'true',
});

try {
  await app.listen({ host: '0.0.0.0', port: Number(environment.API_PORT ?? 3000) });
  const shutdown = async () => {
    closeGameEventStreams();
    await app.close();
    await database.pool.end();
  };
  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });
} catch (error: unknown) {
  app.log.error({ error }, 'API startup failed');
  await app.close();
  process.exitCode = 1;
}
