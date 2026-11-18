import type { FastifyInstance } from 'fastify';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { UpstreamError, UpstreamGameNotFoundError } from '@mugloar/game';

import { buildApp } from '../src/app.js';

const apps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function createApp() {
  const app = buildApp({ logger: false });
  apps.push(app);

  return app;
}

void test('health endpoint reports the API is ready', async () => {
  const response = await createApp().inject({ method: 'GET', url: '/v1/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

void test('upstream missing-game reads return a stable recovery error', async () => {
  const app = createApp();
  app.get('/test/games/:id/messages', () => {
    throw new UpstreamGameNotFoundError(
      new UpstreamError(
        'Upstream returned 404',
        404,
        { body: 'Not Found' },
        {
          request: { method: 'GET', url: 'https://upstream.test/api/v2/remote-id/messages' },
        },
      ),
    );
  });

  const response = await app.inject({ method: 'GET', url: '/test/games/local-id/messages' });
  const body = response.json<{ code: string; message: string; requestId: string }>();

  assert.equal(response.statusCode, 502);
  assert.equal(body.code, 'UPSTREAM_GAME_NOT_FOUND');
  assert.equal(
    body.message,
    'The upstream service returned 404 for this game. It may have expired or been removed.',
  );
  assert.ok(body.requestId.length > 0);
});

void test('unrelated upstream 404s stay ordinary not-found errors', async () => {
  const app = createApp();
  app.get('/test/other-resource', () => {
    throw new UpstreamError('Resource not found', 404, null, {
      request: { method: 'GET', url: 'https://upstream.test/api/v2/catalog' },
    });
  });

  const response = await app.inject({ method: 'GET', url: '/test/other-resource' });
  const body = response.json<{ code: string; message: string }>();

  assert.equal(response.statusCode, 404);
  assert.equal(body.code, 'INTERNAL_ERROR');
  assert.equal(body.message, 'Resource not found');
});

void test('upstream missing-game writes do not get classified as expired games', async () => {
  const app = createApp();
  app.post('/test/games/:id/solve', () => {
    throw new UpstreamError('Upstream returned 404', 404, null, {
      request: { method: 'POST', url: 'https://upstream.test/api/v2/remote-id/solve' },
    });
  });

  const response = await app.inject({ method: 'POST', url: '/test/games/local-id/solve' });
  const body = response.json<{ code: string; message: string }>();

  assert.equal(response.statusCode, 404);
  assert.equal(body.code, 'INTERNAL_ERROR');
  assert.equal(body.message, 'Upstream returned 404');
});
