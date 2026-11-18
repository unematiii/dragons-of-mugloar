import {
  index,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('sessions_token_hash_uq').on(table.tokenHash)],
);

export const games = pgTable(
  'games',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => players.id),
    upstreamGameId: varchar('upstream_game_id', { length: 128 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('ready'),
    lives: integer('lives').notNull(),
    gold: integer('gold').notNull(),
    level: integer('level').notNull(),
    score: integer('score').notNull(),
    turn: integer('turn').notNull(),
    revision: integer('revision').notNull().default(0),
    rawState: jsonb('raw_state').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('games_owner_created_idx').on(table.ownerId, table.createdAt)],
);

export const commands = pgTable(
  'commands',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    clientCommandId: varchar('client_command_id', { length: 128 }).notNull(),
    expectedRevision: integer('expected_revision').notNull(),
    actionType: varchar('action_type', { length: 24 }).notNull(),
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    request: jsonb('request').$type<Record<string, unknown>>().notNull(),
    response: jsonb('response').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('commands_game_client_id_uq').on(table.gameId, table.clientCommandId)],
);

export const actions = pgTable(
  'actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    commandId: varchar('command_id', { length: 128 }).notNull(),
    actionType: varchar('action_type', { length: 24 }).notNull(),
    status: varchar('status', { length: 24 }).notNull(),
    source: varchar('source', { length: 24 }).notNull().default('manual'),
    beforeState: jsonb('before_state').$type<Record<string, unknown>>().notNull(),
    afterState: jsonb('after_state').$type<Record<string, unknown>>(),
    request: jsonb('request').$type<Record<string, unknown>>().notNull(),
    response: jsonb('response').$type<Record<string, unknown>>(),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('actions_game_sequence_uq').on(table.gameId, table.sequence),
    uniqueIndex('actions_game_command_uq').on(table.gameId, table.commandId),
  ],
);

export const boardSnapshots = pgTable(
  'board_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    turn: integer('turn').notNull(),
    revision: integer('revision').notNull(),
    rawPayload: jsonb('raw_payload').$type<unknown>().notNull(),
    normalizedAds: jsonb('normalized_ads').$type<readonly Record<string, unknown>[]>().notNull(),
    recommendedTaskId: text('recommended_task_id'),
    recommendedItemId: text('recommended_item_id'),
    observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('board_snapshots_game_revision_idx').on(table.gameId, table.revision)],
);

export const shopSnapshots = pgTable(
  'shop_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    rawPayload: jsonb('raw_payload').$type<unknown>().notNull(),
    items: jsonb('items').$type<readonly Record<string, unknown>[]>().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('shop_snapshots_game_revision_idx').on(table.gameId, table.revision)],
);

export const reputationSnapshots = pgTable(
  'reputation_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    turn: integer('turn'),
    people: doublePrecision('people').notNull(),
    state: doublePrecision('state').notNull(),
    underworld: doublePrecision('underworld').notNull(),
    rawPayload: jsonb('raw_payload').$type<unknown>().notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('reputation_snapshots_game_observed_idx').on(table.gameId, table.observedAt)],
);
