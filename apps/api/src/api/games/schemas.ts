import { Type } from '@sinclair/typebox';

export const IdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });
export const CreateGameResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  revision: Type.Integer(),
  state: Type.Unknown(),
});
export const GameListResponse = Type.Array(
  Type.Object({
    id: Type.String(),
    status: Type.String(),
    lives: Type.Integer(),
    gold: Type.Integer(),
    level: Type.Integer(),
    score: Type.Integer(),
    turn: Type.Integer(),
    revision: Type.Integer(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  }),
);
export const CommandBody = Type.Object({
  commandId: Type.String({ minLength: 1, maxLength: 128 }),
  revision: Type.Integer({ minimum: 0 }),
  adId: Type.Optional(Type.String({ minLength: 1 })),
  itemId: Type.Optional(Type.String({ minLength: 1 })),
});
export const SessionResponse = Type.Object({
  playerId: Type.String({ format: 'uuid' }),
});
export const CsrfTokenResponse = Type.Object({ csrfToken: Type.String({ minLength: 1 }) });
export const AutoplayResponse = Type.Object({
  status: Type.Union([Type.Literal('running'), Type.Literal('paused')]),
});
export const ReputationInvestigationBody = Type.Object({
  commandId: Type.String({ minLength: 1, maxLength: 128 }),
  revision: Type.Integer({ minimum: 0 }),
});
export const ReputationResponse = Type.Object({
  people: Type.Number(),
  state: Type.Number(),
  underworld: Type.Number(),
  observedTurn: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
});
export const ReputationSnapshotResponse = Type.Union([ReputationResponse, Type.Null()]);
