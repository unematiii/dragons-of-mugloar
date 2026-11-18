import { Type } from '@sinclair/typebox';

export const GameStateSchema = Type.Object({
  gameId: Type.String({ minLength: 1 }),
  lives: Type.Number(),
  gold: Type.Number(),
  level: Type.Number(),
  score: Type.Number(),
  highScore: Type.Number(),
  turn: Type.Number(),
});

export const TaskSchema = Type.Object({
  adId: Type.String({ minLength: 1 }),
  message: Type.String(),
  reward: Type.Union([Type.Number(), Type.String()]),
  expiresIn: Type.Number(),
  probability: Type.String(),
  encrypted: Type.Optional(Type.Unknown()),
});

export const TaskListSchema = Type.Union([
  Type.Array(TaskSchema),
  Type.Object({ messages: Type.Array(TaskSchema) }),
]);

export const ShopItemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  name: Type.String(),
  cost: Type.Number(),
});

export const ShopListSchema = Type.Union([
  Type.Array(ShopItemSchema),
  Type.Object({ items: Type.Array(ShopItemSchema) }),
]);

export const PartialActionSchema = Type.Object({
  gameId: Type.Optional(Type.String()),
  success: Type.Optional(Type.Boolean()),
  shoppingSuccess: Type.Optional(Type.Union([Type.Boolean(), Type.String()])),
  lives: Type.Optional(Type.Number()),
  gold: Type.Optional(Type.Number()),
  level: Type.Optional(Type.Number()),
  score: Type.Optional(Type.Number()),
  highScore: Type.Optional(Type.Number()),
  turn: Type.Optional(Type.Number()),
  message: Type.Optional(Type.String()),
});

export const ReputationSchema = Type.Object({
  people: Type.Number(),
  state: Type.Number(),
  underworld: Type.Number(),
});
