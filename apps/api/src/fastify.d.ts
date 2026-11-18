import type { Database } from '@mugloar/db';
import type { UpstreamClient } from '@mugloar/game';

import type { GamesService } from './api/games/services/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    services: {
      readonly db: Database;
      readonly upstream: UpstreamClient;
      readonly games: GamesService;
    };
    secureCookies: boolean;
  }
  interface FastifyRequest {
    playerId: string | null;
  }
}
