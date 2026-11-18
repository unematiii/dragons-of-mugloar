import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { getHealth } from './controller.js';
import { HealthResponseSchema } from './schemas.js';

export const healthRoutes: FastifyPluginAsyncTypebox = (app) => {
  app.get('/v1/health', { schema: { response: { 200: HealthResponseSchema } } }, getHealth);

  return Promise.resolve();
};
