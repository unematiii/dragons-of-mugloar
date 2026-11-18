import type { FastifyReply, FastifyRequest } from 'fastify';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function protectMutatingRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (error?: Error) => void,
): void {
  if (!MUTATING_METHODS.has(request.method)) {
    done();

    return;
  }

  request.server.csrfProtection(request, reply, done);
}
