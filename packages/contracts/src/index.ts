import { Type, type Static } from '@sinclair/typebox';

export const GameStatusSchema = Type.Union([
  Type.Literal('ready'),
  Type.Literal('running'),
  Type.Literal('pausing'),
  Type.Literal('paused'),
  Type.Literal('finished'),
  Type.Literal('needs-review'),
  Type.Literal('upstream-missing'),
  Type.Literal('error'),
]);

export type GameStatus = Static<typeof GameStatusSchema>;

export const GameStatsSchema = Type.Object({
  lives: Type.Integer({ minimum: 0 }),
  gold: Type.Integer({ minimum: 0 }),
  level: Type.Integer({ minimum: 0 }),
  score: Type.Integer({ minimum: 0 }),
  turn: Type.Integer({ minimum: 0 }),
});

export type GameStats = Static<typeof GameStatsSchema>;

export const ApiErrorSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  message: Type.String({ minLength: 1 }),
  requestId: Type.Optional(Type.String()),
});

export type ApiError = Static<typeof ApiErrorSchema>;

export const DecisionReportSchema = Type.Object({
  revision: Type.Integer(),
  reputationCheckRequired: Type.Boolean(),
  reputationCheckReason: Type.Optional(Type.String()),
  recommendation: Type.Optional(Type.String()),
  alternatives: Type.Array(
    Type.Object({ id: Type.String(), score: Type.Number(), reason: Type.String() }),
  ),
  purchaseAdvice: Type.Object({
    recommendedItemId: Type.Optional(Type.String()),
    alternatives: Type.Array(
      Type.Object({
        id: Type.String(),
        score: Type.Number(),
        action: Type.Union([Type.Literal('buy'), Type.Literal('save'), Type.Literal('skip')]),
        reason: Type.String(),
      }),
    ),
  }),
});
export type DecisionReport = Static<typeof DecisionReportSchema>;
