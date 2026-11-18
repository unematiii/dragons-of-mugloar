import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';

import { createPlayer as insertPlayer, createSession as insertSession } from '@mugloar/db';

import { gameError } from './error.js';
import type { CommandInput, ReputationInvestigationInput } from './types.js';
import { SESSION_COOKIE_NAME } from '../../constants.js';

const heartbeatTimers = new Map<ServerResponse, NodeJS.Timeout>();
const eventStreams = new Set<ServerResponse>();

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function closeGameEventStreams() {
  for (const [response, timer] of heartbeatTimers) {
    clearInterval(timer);
    response.end();
  }

  heartbeatTimers.clear();
  for (const response of eventStreams) response.end();

  eventStreams.clear();
}

function requirePlayerId(request: FastifyRequest): string {
  if (request.playerId === null)
    throw gameError('SESSION_REQUIRED', 'Create or restore a session first');

  return request.playerId;
}

export async function bootstrapSession(request: FastifyRequest, reply: FastifyReply) {
  let playerId = request.playerId;
  let token: string | undefined;
  if (playerId === null) {
    const player = await insertPlayer(request.server.services.db);
    playerId = player.id;
    token = randomBytes(32).toString('base64url');
    await insertSession(request.server.services.db, {
      playerId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
    });
  }

  if (token !== undefined) {
    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.server.secureCookies,
      path: '/',
      maxAge: SESSION_LIFETIME_MS / 1000,
    });
  }

  if (playerId === null) throw new Error('Session bootstrap did not assign a player');

  return { playerId };
}

export function issueCsrfToken(_request: FastifyRequest, reply: FastifyReply) {
  return { csrfToken: reply.generateCsrf() };
}

export async function createNewGame(request: FastifyRequest, reply: FastifyReply) {
  const game = await request.server.services.games.createGame(requirePlayerId(request));
  reply.code(201);

  return {
    id: game.id,
    revision: game.revision,
    state: {
      lives: game.lives,
      gold: game.gold,
      level: game.level,
      score: game.score,
      turn: game.turn,
    },
  };
}

export async function listGames(request: FastifyRequest) {
  const games = await request.server.services.games.listGames(requirePlayerId(request));

  return games.map(
    ({ id, status, lives, gold, level, score, turn, revision, createdAt, updatedAt }) => ({
      id,
      status,
      lives,
      gold,
      level,
      score,
      turn,
      revision,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    }),
  );
}

export async function getGame(request: FastifyRequest<{ Params: { id: string } }>) {
  const game = await request.server.services.games.getGame(
    request.params.id,
    requirePlayerId(request),
  );

  return {
    id: game.id,
    status: game.status,
    lives: game.lives,
    gold: game.gold,
    level: game.level,
    score: game.score,
    turn: game.turn,
    revision: game.revision,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

export async function getBoard(request: FastifyRequest<{ Params: { id: string } }>) {
  const board = await request.server.services.games.getBoard(
    request.params.id,
    requirePlayerId(request),
  );

  return {
    revision: board.game.revision,
    ads: board.ads.map(({ task: message, supported, labelChanges }) => ({
      adId: message.adId,
      rawAdId: message.rawAdId,
      ...(message.decodedAdId === undefined ? {} : { decodedAdId: message.decodedAdId }),
      message: message.message,
      rawMessage: message.rawMessage,
      reward: message.reward,
      expiresIn: message.expiresIn,
      probability: message.probability,
      rawProbability: message.rawProbability,
      encoding: message.encoding,
      decoding: message.decoding,
      ...(message.decodeIssue === undefined ? {} : { decodeIssue: message.decodeIssue }),
      unsupportedDetails: !supported,
      labelChanges,
    })),
    decision: board.decision,
  };
}

export async function getShop(request: FastifyRequest<{ Params: { id: string } }>) {
  return request.server.services.games.getShop(request.params.id, requirePlayerId(request));
}

export async function getReputation(request: FastifyRequest<{ Params: { id: string } }>) {
  return request.server.services.games.getReputation(request.params.id, requirePlayerId(request));
}

export async function investigateReputation(
  request: FastifyRequest<{
    Params: { id: string };
    Body: ReputationInvestigationInput;
  }>,
) {
  return request.server.services.games.investigateReputation({
    gameId: request.params.id,
    ownerId: requirePlayerId(request),
    commandId: request.body.commandId,
    expectedRevision: request.body.revision,
  });
}

export async function submitCommand(
  request: FastifyRequest<{ Params: { id: string }; Body: CommandInput }>,
  reply: FastifyReply,
) {
  const actionType = request.routeOptions.url?.endsWith('/purchases') === true ? 'buy' : 'solve';
  const targetId = actionType === 'solve' ? request.body.adId : request.body.itemId;
  if (targetId === undefined)
    throw gameError('INVALID_COMMAND', `${actionType === 'solve' ? 'adId' : 'itemId'} is required`);

  const result = await request.server.services.games.submitCommand({
    gameId: request.params.id,
    ownerId: requirePlayerId(request),
    commandId: request.body.commandId,
    expectedRevision: request.body.revision,
    actionType,
    targetId,
  });
  reply.code(200);

  return { revision: result.revision, state: result.state, result: result.result };
}

export async function getActions(request: FastifyRequest<{ Params: { id: string } }>) {
  const actions = await request.server.services.games.listActions(
    request.params.id,
    requirePlayerId(request),
  );

  return actions.map(
    ({
      actionType,
      status,
      message,
      createdAt,
      turn,
      targetName,
      targetDescription,
      reputationPeople,
      reputationState,
      reputationUnderworld,
    }) => ({
      actionType,
      status,
      message,
      createdAt,
      ...(typeof turn === 'number' ? { turn } : {}),
      ...(typeof targetName === 'string' ? { targetName } : {}),
      ...(typeof targetDescription === 'string' ? { targetDescription } : {}),
      ...(typeof reputationPeople === 'number' &&
      typeof reputationState === 'number' &&
      typeof reputationUnderworld === 'number'
        ? {
            reputation: {
              people: reputationPeople,
              state: reputationState,
              underworld: reputationUnderworld,
            },
          }
        : {}),
    }),
  );
}

export async function startAutoplay(request: FastifyRequest<{ Params: { id: string } }>) {
  await request.server.services.games.startAutoplay(request.params.id, requirePlayerId(request));

  return { status: 'running' as const };
}

export async function pauseAutoplay(request: FastifyRequest<{ Params: { id: string } }>) {
  await request.server.services.games.pauseAutoplay(request.params.id, requirePlayerId(request));

  return { status: 'paused' as const };
}

export async function gameEvents(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const game = await request.server.services.games.getGame(
    request.params.id,
    requirePlayerId(request),
  );
  reply.raw.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  reply.hijack();
  eventStreams.add(reply.raw);

  const snapshot = {
    id: game.id,
    revision: game.revision,
    state: {
      lives: game.lives,
      gold: game.gold,
      level: game.level,
      score: game.score,
      turn: game.turn,
      status: game.status,
    },
  };
  reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

  const unsubscribe = request.server.services.games.subscribeToGame(game.id, (message) => {
    if (!reply.raw.destroyed && reply.raw.writable)
      reply.raw.write(`event: update\ndata: ${JSON.stringify(message)}\n\n`);
  });

  const timer = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15000);
  heartbeatTimers.set(reply.raw, timer);
  request.raw.on('close', () => {
    clearInterval(timer);
    heartbeatTimers.delete(reply.raw);
    unsubscribe();
    eventStreams.delete(reply.raw);
  });

  return reply;
}
