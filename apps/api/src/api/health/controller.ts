import type { HealthResponse } from './types.js';

export function getHealth(): HealthResponse {
  return { status: 'ok' };
}
