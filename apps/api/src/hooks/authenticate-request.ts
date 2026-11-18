import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';

import { findValidSession } from '@mugloar/db';

import { SESSION_COOKIE_NAME } from '../constants.js';

export async function authenticateRequest(request: FastifyRequest): Promise<void> {
  const token = request.cookies[SESSION_COOKIE_NAME];
  if (token === undefined) return;

  const session = await findValidSession(
    request.server.services.db,
    createHash('sha256').update(token).digest('hex'),
  );
  if (session !== null) request.playerId = session.playerId;
}
