import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { and as drizzleAnd, eq as drizzleEq } from 'drizzle-orm';

import type { Database } from './client.js';
import {
  actions,
  boardSnapshots,
  games,
  players,
  reputationSnapshots,
  sessions,
  shopSnapshots,
  commands,
} from './schema.js';

export interface PersistedGameState {
  readonly lives: number;
  readonly gold: number;
  readonly level: number;
  readonly score: number;
  readonly turn: number;
}

export interface RecordStandaloneActionInput {
  readonly gameId: string;
  readonly sequence: number;
  readonly commandId: string;
  readonly actionType: string;
  readonly status: string;
  readonly source?: string;
  readonly beforeState: PersistedGameState;
  readonly afterState: PersistedGameState;
  readonly request: Record<string, unknown>;
  readonly response: Record<string, unknown>;
  readonly rawState: Record<string, unknown>;
  readonly gameStatus: string;
}

export interface CreateSessionInput {
  readonly playerId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface CreateGameInput {
  readonly ownerId: string;
  readonly upstreamGameId: string;
  readonly status: string;
  readonly lives: number;
  readonly gold: number;
  readonly level: number;
  readonly score: number;
  readonly turn: number;
  readonly rawState: Record<string, unknown>;
}

export interface MarkCommandInput {
  readonly commandId: string;
  readonly gameId: string;
  readonly sequence: number;
  readonly actionType: string;
  readonly beforeState: Record<string, unknown>;
  readonly request: Record<string, unknown>;
  readonly evidence: Record<string, unknown>;
  readonly source?: string;
}

export interface ApplyCommandResultInput {
  readonly commandId: string;
  readonly gameId: string;
  readonly ownerId: string;
  readonly state: PersistedGameState;
  readonly revision: number;
  readonly status: string;
  readonly response: Record<string, unknown>;
  readonly gameRawState?: Record<string, unknown>;
  readonly reputationSnapshot?: {
    readonly turn: number;
    readonly people: number;
    readonly state: number;
    readonly underworld: number;
    readonly rawPayload: unknown;
  };
  readonly action: {
    readonly actionType: string;
    readonly status: string;
    readonly beforeState: Record<string, unknown>;
    readonly afterState: Record<string, unknown>;
    readonly request: Record<string, unknown>;
    readonly message?: string;
    readonly source?: string;
  };
}

export interface RecordActionInput {
  readonly gameId: string;
  readonly sequence: number;
  readonly commandId: string;
  readonly actionType: string;
  readonly status: string;
  readonly source?: string;
  readonly beforeState: Record<string, unknown>;
  readonly afterState?: Record<string, unknown>;
  readonly request: Record<string, unknown>;
  readonly response?: Record<string, unknown>;
  readonly message?: string;
}

export interface RecordBoardSnapshotInput {
  readonly gameId: string;
  readonly turn: number;
  readonly revision: number;
  readonly rawPayload: unknown;
  readonly normalizedAds: readonly Record<string, unknown>[];
  readonly recommendedTaskId?: string;
  readonly recommendedItemId?: string;
}

export interface BoardTaskLabelSnapshot {
  readonly turn: number;
  readonly revision: number;
  readonly adId: string;
  readonly probability: string;
}

export interface RecordShopSnapshotInput {
  readonly gameId: string;
  readonly revision: number;
  readonly rawPayload: unknown;
  readonly items: readonly Record<string, unknown>[];
}

export interface RecordReputationSnapshotInput {
  readonly gameId: string;
  readonly turn: number | null;
  readonly people: number;
  readonly state: number;
  readonly underworld: number;
  readonly rawPayload: unknown;
}

export async function createPlayer(db: Database) {
  const [player] = await db.insert(players).values({}).returning();
  if (player === undefined) {
    throw new Error('Player insert returned no row');
  }

  return player;
}

export async function createSession(db: Database, input: CreateSessionInput) {
  const [session] = await db.insert(sessions).values(input).returning();
  if (session === undefined) {
    throw new Error('Session insert returned no row');
  }

  return session;
}

export async function findValidSession(db: Database, tokenHash: string, now = new Date()) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, now),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);

  return session ?? null;
}

export async function createGame(db: Database, input: CreateGameInput) {
  const [game] = await db.insert(games).values(input).returning();
  if (game === undefined) {
    throw new Error('Game insert returned no row');
  }

  return game;
}

export async function findOwnedGame(db: Database, gameId: string, ownerId: string) {
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.ownerId, ownerId)))
    .limit(1);

  return game ?? null;
}

export async function setGameStatus(db: Database, gameId: string, ownerId: string, status: string) {
  const [game] = await db
    .update(games)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(games.id, gameId), eq(games.ownerId, ownerId)))
    .returning();

  return game ?? null;
}

export async function listOwnedGames(db: Database, ownerId: string) {
  return db.select().from(games).where(eq(games.ownerId, ownerId)).orderBy(desc(games.createdAt));
}

export async function findCommand(db: Database, gameId: string, clientCommandId: string) {
  return (
    (
      await db
        .select()
        .from(commands)
        .where(
          drizzleAnd(
            drizzleEq(commands.gameId, gameId),
            drizzleEq(commands.clientCommandId, clientCommandId),
          ),
        )
        .limit(1)
    )[0] ?? null
  );
}

export async function listGameActions(db: Database, gameId: string) {
  type ActionHistoryRow = Record<string, unknown> & {
    readonly actionType: string;
    readonly status: string;
    readonly message: string | null;
    readonly createdAt: Date;
    readonly turn: number | null;
    readonly targetName: string | null;
    readonly targetDescription: string | null;
    readonly reputationPeople: number | null;
    readonly reputationState: number | null;
    readonly reputationUnderworld: number | null;
  };

  const result = await db.execute<ActionHistoryRow>(sql`
    SELECT
      logged_action.action_type AS "actionType",
      logged_action.status,
      logged_action.message,
      logged_action.created_at AS "createdAt",
      COALESCE(
        NULLIF(logged_action.after_state->>'turn', '')::integer,
        NULLIF(logged_action.before_state->>'turn', '')::integer
      ) AS turn,
      COALESCE(logged_action.request->>'targetName', shop_item.name) AS "targetName",
      COALESCE(logged_action.request->>'targetDescription', task.description) AS "targetDescription",
      CASE WHEN logged_action.action_type = 'reputation'
        THEN NULLIF(logged_action.response->>'people', '')::double precision
      END AS "reputationPeople",
      CASE WHEN logged_action.action_type = 'reputation'
        THEN NULLIF(logged_action.response->>'state', '')::double precision
      END AS "reputationState",
      CASE WHEN logged_action.action_type = 'reputation'
        THEN NULLIF(logged_action.response->>'underworld', '')::double precision
      END AS "reputationUnderworld"
    FROM actions AS logged_action
    LEFT JOIN LATERAL (
      SELECT item.value->>'name' AS name
      FROM (
        SELECT items
        FROM shop_snapshots
        WHERE game_id = logged_action.game_id
        ORDER BY observed_at DESC
        LIMIT 1
      ) AS latest_shop
      CROSS JOIN LATERAL jsonb_array_elements(latest_shop.items) AS item(value)
      WHERE item.value->>'id' = logged_action.request->>'targetId'
      LIMIT 1
    ) AS shop_item ON logged_action.action_type = 'buy'
    LEFT JOIN LATERAL (
      SELECT ad.value->>'message' AS description
      FROM board_snapshots AS snapshot
      CROSS JOIN LATERAL jsonb_array_elements(snapshot.normalized_ads) AS ad(value)
      WHERE snapshot.game_id = logged_action.game_id
        AND snapshot.revision = (logged_action.request->>'revision')::integer
        AND ad.value->>'adId' = logged_action.request->>'targetId'
      ORDER BY snapshot.observed_at DESC
      LIMIT 1
    ) AS task ON logged_action.action_type = 'solve'
    WHERE logged_action.game_id = ${gameId}
    ORDER BY logged_action.sequence
  `);

  return result.rows;
}

export async function getGameDecisionContext(db: Database, gameId: string) {
  const [lastAction] = await db
    .select({
      sequence: actions.sequence,
      actionType: actions.actionType,
      status: actions.status,
      request: actions.request,
    })
    .from(actions)
    .where(eq(actions.gameId, gameId))
    .orderBy(desc(actions.sequence))
    .limit(1);

  // The policy uses only the latest action; completed buy IDs come from that row.
  // Earlier purchase counts no longer influence item selection.
  const targetId = lastAction?.request['targetId'];
  const lastActionItemId =
    lastAction?.actionType === 'buy' &&
    lastAction.status === 'completed' &&
    typeof targetId === 'string'
      ? targetId
      : undefined;

  return {
    ...(lastAction === undefined ? {} : { lastActionType: lastAction.actionType }),
    ...(lastActionItemId === undefined ? {} : { lastActionItemId }),
    ...(lastAction === undefined ? {} : { lastAction }),
  };
}

export async function findBoardSnapshotAtRevision(db: Database, gameId: string, revision: number) {
  const [snapshot] = await db
    .select({
      recommendedTaskId: boardSnapshots.recommendedTaskId,
      recommendedItemId: boardSnapshots.recommendedItemId,
    })
    .from(boardSnapshots)
    .where(and(eq(boardSnapshots.gameId, gameId), eq(boardSnapshots.revision, revision)))
    .orderBy(desc(boardSnapshots.observedAt))
    .limit(1);

  return snapshot ?? null;
}

/** Read only prior snapshots containing tasks still present on the current board. */
export async function listTaskLabelSnapshots(
  db: Database,
  gameId: string,
  beforeRevision: number,
  adIds: readonly string[],
): Promise<readonly BoardTaskLabelSnapshot[]> {
  if (adIds.length === 0) return [];

  const idList = sql.join(
    adIds.map((adId) => sql`${adId}`),
    sql`, `,
  );
  const snapshots = await db
    .select({
      turn: boardSnapshots.turn,
      revision: boardSnapshots.revision,
      normalizedAds: boardSnapshots.normalizedAds,
      observedAt: boardSnapshots.observedAt,
    })
    .from(boardSnapshots)
    .where(
      and(
        eq(boardSnapshots.gameId, gameId),
        sql`${boardSnapshots.revision} < ${beforeRevision}`,
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements(${boardSnapshots.normalizedAds}) AS ad
          WHERE ad->>'adId' IN (${idList})
        )`,
      ),
    )
    .orderBy(desc(boardSnapshots.revision), desc(boardSnapshots.observedAt));

  const latestByRevision = new Map<number, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latestByRevision.has(snapshot.revision)) latestByRevision.set(snapshot.revision, snapshot);
  }

  const taskSnapshots: BoardTaskLabelSnapshot[] = [];
  const wanted = new Set(adIds);
  for (const snapshot of [...latestByRevision.values()].reverse()) {
    for (const ad of snapshot.normalizedAds) {
      const adId = ad['adId'];
      const probability = ad['probability'];
      if (typeof adId === 'string' && wanted.has(adId) && typeof probability === 'string') {
        taskSnapshots.push({ turn: snapshot.turn, revision: snapshot.revision, adId, probability });
      }
    }
  }

  return taskSnapshots;
}

export async function markCommandUncertain(db: Database, input: MarkCommandInput) {
  await db.transaction(async (tx) => {
    await tx
      .update(commands)
      .set({ status: 'uncertain', response: input.evidence, completedAt: new Date() })
      .where(drizzleEq(commands.id, input.commandId));
    await tx
      .update(games)
      .set({ status: 'needs-review', updatedAt: new Date() })
      .where(drizzleEq(games.id, input.gameId));
    await tx.insert(actions).values({
      gameId: input.gameId,
      sequence: input.sequence,
      commandId: input.commandId,
      actionType: input.actionType,
      status: 'uncertain',
      source: input.source ?? 'manual',
      beforeState: input.beforeState,
      request: input.request,
      response: input.evidence,
      message: 'The upstream result could not be confirmed. This game cannot safely resume.',
    });
  });
}

export async function markCommandGameMissing(db: Database, input: MarkCommandInput) {
  await db.transaction(async (tx) => {
    await tx
      .update(commands)
      .set({ status: 'failed', response: input.evidence, completedAt: new Date() })
      .where(drizzleEq(commands.id, input.commandId));
    await tx
      .update(games)
      .set({ status: 'upstream-missing', updatedAt: new Date() })
      .where(drizzleEq(games.id, input.gameId));
    await tx.insert(actions).values({
      gameId: input.gameId,
      sequence: input.sequence,
      commandId: input.commandId,
      actionType: input.actionType,
      status: 'failed',
      source: input.source ?? 'manual',
      beforeState: input.beforeState,
      request: input.request,
      response: input.evidence,
      message: 'The upstream game was not found; this command was not accepted.',
    });
  });
}

export async function applyCommandResult(db: Database, input: ApplyCommandResultInput) {
  await db.transaction(async (tx) => {
    await tx
      .update(games)
      .set({
        ...input.state,
        revision: input.revision,
        status: input.status,
        rawState: input.gameRawState ?? input.response,
        updatedAt: new Date(),
      })
      .where(
        drizzleAnd(drizzleEq(games.id, input.gameId), drizzleEq(games.ownerId, input.ownerId)),
      );
    await tx
      .update(commands)
      .set({ status: 'completed', response: input.response, completedAt: new Date() })
      .where(drizzleEq(commands.id, input.commandId));
    await tx.insert(actions).values({
      gameId: input.gameId,
      sequence: input.revision,
      commandId: input.commandId,
      actionType: input.action.actionType,
      status: input.action.status,
      source: input.action.source ?? 'manual',
      beforeState: input.action.beforeState,
      afterState: input.action.afterState,
      request: input.action.request,
      response: input.response,
      ...(input.action.message === undefined ? {} : { message: input.action.message }),
    });
    if (input.reputationSnapshot !== undefined) {
      await tx.insert(reputationSnapshots).values({
        gameId: input.gameId,
        ...input.reputationSnapshot,
      });
    }
  });
}

export async function recordAction(db: Database, input: RecordActionInput) {
  const [action] = await db
    .insert(actions)
    .values({
      gameId: input.gameId,
      sequence: input.sequence,
      commandId: input.commandId,
      actionType: input.actionType,
      status: input.status,
      ...(input.source === undefined ? {} : { source: input.source }),
      beforeState: input.beforeState,
      ...(input.afterState === undefined ? {} : { afterState: input.afterState }),
      request: input.request,
      ...(input.response === undefined ? {} : { response: input.response }),
      ...(input.message === undefined ? {} : { message: input.message }),
    })
    .returning();
  if (action === undefined) {
    throw new Error('Action insert returned no row');
  }

  return action;
}

export async function recordStandaloneAction(db: Database, input: RecordStandaloneActionInput) {
  await db.transaction(async (tx) => {
    await tx
      .update(games)
      .set({
        ...input.afterState,
        revision: input.sequence,
        status: input.gameStatus,
        rawState: input.rawState,
        updatedAt: new Date(),
      })
      .where(eq(games.id, input.gameId));
    await tx.insert(actions).values({
      gameId: input.gameId,
      sequence: input.sequence,
      commandId: input.commandId,
      actionType: input.actionType,
      status: input.status,
      source: input.source ?? 'manual',
      beforeState: { ...input.beforeState },
      afterState: { ...input.afterState },
      request: input.request,
      response: input.response,
    });
  });
}

export async function recordBoardSnapshot(db: Database, input: RecordBoardSnapshotInput) {
  const [snapshot] = await db.insert(boardSnapshots).values(input).returning();
  if (snapshot === undefined) {
    throw new Error('Board snapshot insert returned no row');
  }

  return snapshot;
}

export async function recordShopSnapshot(db: Database, input: RecordShopSnapshotInput) {
  const [snapshot] = await db.insert(shopSnapshots).values(input).returning();
  if (snapshot === undefined) {
    throw new Error('Shop snapshot insert returned no row');
  }

  return snapshot;
}

export async function recordReputationSnapshot(db: Database, input: RecordReputationSnapshotInput) {
  const [snapshot] = await db.insert(reputationSnapshots).values(input).returning();
  if (snapshot === undefined) {
    throw new Error('Reputation snapshot insert returned no row');
  }

  return snapshot;
}

export async function findLatestReputationSnapshot(db: Database, gameId: string) {
  const [snapshot] = await db
    .select()
    .from(reputationSnapshots)
    .where(eq(reputationSnapshots.gameId, gameId))
    .orderBy(desc(reputationSnapshots.observedAt))
    .limit(1);

  return snapshot ?? null;
}
