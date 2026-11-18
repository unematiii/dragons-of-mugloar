import type { Static } from '@sinclair/typebox';

import type { HealthResponseSchema } from './schemas.js';

export type HealthResponse = Static<typeof HealthResponseSchema>;
