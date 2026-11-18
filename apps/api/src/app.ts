import cookie from '@fastify/cookie';
import csrfProtection from '@fastify/csrf-protection';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import type { Database } from '@mugloar/db';
import { UpstreamError, UpstreamGameNotFoundError, type UpstreamClient } from '@mugloar/game';

import { gameRoutes } from './api/games/index.js';
import { GamesService } from './api/games/services/index.js';
import { healthRoutes } from './api/health/index.js';
import { authenticateRequest } from './hooks/authenticate-request.js';
import { protectMutatingRequest } from './hooks/protect-mutating-request.js';

export interface AppDependencies {
  readonly logger?: boolean;
  readonly db?: Database;
  readonly upstream?: UpstreamClient;
  readonly secureCookies?: boolean;
}

export function buildApp(dependencies: AppDependencies = {}): FastifyInstance {
  const app = Fastify({
    logger: dependencies.logger ?? true,
    trustProxy: true,
  }).withTypeProvider<TypeBoxTypeProvider>();
  app.register(cookie);
  app.register(csrfProtection, {
    cookieOpts: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: dependencies.secureCookies ?? false,
    },
  });
  app.decorate('secureCookies', dependencies.secureCookies ?? false);
  if (dependencies.db !== undefined && dependencies.upstream !== undefined) {
    const games = new GamesService({
      db: dependencies.db,
      upstream: dependencies.upstream,
      logger: app.log,
    });
    app.decorate('services', {
      db: dependencies.db,
      upstream: dependencies.upstream,
      games,
    });
    app.addHook('onClose', async () => {
      await games.stopAllAutoplay();
    });
    app.decorateRequest('playerId', null);
    app.addHook('onRequest', protectMutatingRequest);
    app.addHook('preHandler', authenticateRequest);
    app.register(gameRoutes);
  }

  app.setErrorHandler((error, request, reply) => {
    const details =
      typeof error === 'object' && error !== null
        ? (error as { statusCode?: unknown; code?: unknown })
        : {};
    const upstreamGameNotFound = error instanceof UpstreamGameNotFoundError;
    const statusCode = upstreamGameNotFound
      ? 502
      : typeof details.statusCode === 'number' &&
          details.statusCode >= 400 &&
          details.statusCode < 600
        ? details.statusCode
        : 500;
    if (error instanceof UpstreamError) {
      request.log.error(
        {
          err: error,
          upstreamRequest: error.request,
          upstreamStatusCode: error.statusCode,
          upstreamResponse: error.raw,
        },
        'Upstream request failed',
      );
    } else if (statusCode >= 500) {
      request.log.error({ err: error }, 'Request failed');
    }

    const message = error instanceof Error ? error.message : 'The request could not be completed';
    reply.code(statusCode).send({
      code: upstreamGameNotFound
        ? 'UPSTREAM_GAME_NOT_FOUND'
        : typeof details.code === 'string'
          ? details.code
          : 'INTERNAL_ERROR',
      message: upstreamGameNotFound
        ? 'The upstream service returned 404 for this game. It may have expired or been removed.'
        : statusCode >= 500
          ? 'The request could not be completed'
          : message,
      requestId: request.id,
    });
  });
  app.register(healthRoutes);

  return app;
}
