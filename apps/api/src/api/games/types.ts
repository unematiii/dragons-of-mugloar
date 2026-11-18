import type { Static } from '@sinclair/typebox';

import type {
  CommandBody,
  CreateGameResponse,
  GameListResponse,
  ReputationInvestigationBody,
} from './schemas.js';
export type CommandInput = Static<typeof CommandBody>;
export type CreateGameOutput = Static<typeof CreateGameResponse>;
export type GameListOutput = Static<typeof GameListResponse>;
export type ReputationInvestigationInput = Static<typeof ReputationInvestigationBody>;
