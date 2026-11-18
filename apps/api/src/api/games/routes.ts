import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import {
  bootstrapSession,
  createNewGame,
  gameEvents,
  getActions,
  getBoard,
  getGame,
  getReputation,
  getShop,
  investigateReputation,
  issueCsrfToken,
  listGames,
  pauseAutoplay,
  submitCommand,
  startAutoplay,
} from './controller.js';
import { GameError, type GameErrorCode } from './error.js';
import {
  CommandBody,
  AutoplayResponse,
  CsrfTokenResponse,
  CreateGameResponse,
  GameListResponse,
  IdParams,
  ReputationInvestigationBody,
  ReputationResponse,
  ReputationSnapshotResponse,
  SessionResponse,
} from './schemas.js';

const gameErrorStatusCodes: Record<GameErrorCode, number> = {
  COMMAND_UNCERTAIN: 502,
  DUPLICATE_COMMAND: 409,
  GAME_NOT_ACTIVE: 409,
  AUTOPLAY_LIMIT_REACHED: 429,
  GAME_NOT_FOUND: 404,
  UPSTREAM_GAME_NOT_FOUND: 502,
  INVALID_COMMAND: 400,
  SESSION_REQUIRED: 401,
  STALE_REVISION: 409,
};

export const gameRoutes: FastifyPluginAsyncTypebox = (app) => {
  app.setErrorHandler((error) => {
    if (!(error instanceof GameError)) throw error;

    // Attach the HTTP status, then let the root handler format the standard error response.
    throw Object.assign(error, { statusCode: gameErrorStatusCodes[error.code] });
  });

  app.get('/v1/csrf', { schema: { response: { 200: CsrfTokenResponse } } }, issueCsrfToken);
  app.post('/v1/sessions', { schema: { response: { 200: SessionResponse } } }, bootstrapSession);
  app.post('/v1/games', { schema: { response: { 201: CreateGameResponse } } }, createNewGame);
  app.get('/v1/games', { schema: { response: { 200: GameListResponse } } }, listGames);
  app.get('/v1/games/:id', { schema: { params: IdParams } }, getGame);
  app.get('/v1/games/:id/board', { schema: { params: IdParams } }, getBoard);
  app.get('/v1/games/:id/shop', { schema: { params: IdParams } }, getShop);
  app.get(
    '/v1/games/:id/reputation',
    { schema: { params: IdParams, response: { 200: ReputationSnapshotResponse } } },
    getReputation,
  );
  app.get('/v1/games/:id/actions', { schema: { params: IdParams } }, getActions);
  app.post(
    '/v1/games/:id/reputation/investigate',
    {
      schema: {
        params: IdParams,
        body: ReputationInvestigationBody,
        response: { 200: ReputationResponse },
      },
    },
    investigateReputation,
  );
  app.get('/v1/games/:id/events', { schema: { params: IdParams } }, gameEvents);
  app.post(
    '/v1/games/:id/autoplay/start',
    { schema: { params: IdParams, response: { 200: AutoplayResponse } } },
    startAutoplay,
  );
  app.post(
    '/v1/games/:id/autoplay/pause',
    { schema: { params: IdParams, response: { 200: AutoplayResponse } } },
    pauseAutoplay,
  );
  app.post(
    '/v1/games/:id/solve',
    { schema: { params: IdParams, body: CommandBody } },
    submitCommand,
  );
  app.post(
    '/v1/games/:id/purchases',
    { schema: { params: IdParams, body: CommandBody } },
    submitCommand,
  );

  return Promise.resolve();
};
