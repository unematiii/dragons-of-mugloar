import { randomUUID } from 'node:crypto';

import {
  createGame,
  recordBoardSnapshot,
  recordReputationSnapshot,
  recordShopSnapshot,
  recordStandaloneAction,
  setGameStatus,
  type Database,
} from '@mugloar/db';
import {
  createTaskDecisionReport,
  getInitialReputationReading,
  createUpstreamClient,
  isGameOver,
  mergeActionState,
  runAutoplayLoop,
  selectAutoplayAction,
  SHOP_ITEM_IDS,
  UpstreamError,
} from '@mugloar/game';
import type {
  GameState,
  NormalizedShopItem,
  UpstreamEnvelope,
  UpstreamGameState,
  UpstreamMessage,
} from '@mugloar/game';
import type { ReputationActionObservation, ReputationReading } from '@mugloar/game';

import type {
  AutoplayInterruption,
  AutoplayOutcome,
} from './types.js';

type DecisionReport = ReturnType<typeof createTaskDecisionReport>;
type SelectedAction = Exclude<ReturnType<typeof selectAutoplayAction>, null>;

interface AutoplaySession {
  readonly runId: string;
  readonly ownerId: string;
  readonly db: Database;
  readonly client: ReturnType<typeof createUpstreamClient>;
  upstreamGameId: string | undefined;
  localGameId: string | undefined;
  game: UpstreamEnvelope<UpstreamGameState> | undefined;
  state: GameState | undefined;
  readonly reputationActions: ReputationActionObservation[];
  reputationReading: ReputationReading | null;
  lastActionType: 'solve' | 'buy' | 'reputation' | undefined;
  lastActionItemId: string | undefined;
  followThroughTaskId: string | undefined;
  followThroughItemId: string | undefined;
  cachedShop: UpstreamEnvelope<readonly NormalizedShopItem[]> | undefined;
  operation: AutoplayInterruption['operation'];
}

interface StartedAutoplaySession extends AutoplaySession {
  upstreamGameId: string;
  game: UpstreamEnvelope<UpstreamGameState>;
  state: GameState;
}

function getInterruption(
  operation: AutoplayInterruption['operation'],
  error: unknown,
): AutoplayInterruption {
  const upstreamError = error instanceof UpstreamError ? error : undefined;

  return {
    operation,
    message:
      upstreamError?.message ?? (error instanceof Error ? error.message : 'Unexpected CLI failure'),
    ...(upstreamError?.statusCode === undefined ? {} : { statusCode: upstreamError.statusCode }),
    uncertainWrite:
      operation === 'action' &&
      (upstreamError?.statusCode === undefined || upstreamError.statusCode >= 500),
  };
}

function logActionProgress(
  runId: string,
  sequence: number,
  actionType: 'solve' | 'buy' | 'reputation',
  selectedId: string,
  selected: UpstreamMessage | NormalizedShopItem,
  success: boolean | undefined,
  before: GameState,
  after: GameState,
): void {
  // State deltas make each live action's effect visible in the CLI output.
  const selectedDetails =
    'adId' in selected
      ? { task: selected }
      : { shopItem: { id: selected.id, name: selected.name, cost: selected.cost } };

  console.log({
    event: 'autoplay.action',
    runId,
    sequence,
    actionType,
    selectedId,
    ...selectedDetails,
    result: success === false ? 'failed' : 'completed',
    state: {
      before,
      after,
      scoreDelta: after.score - before.score,
      livesDelta: after.lives - before.lives,
      goldDelta: after.gold - before.gold,
      levelDelta: after.level - before.level,
    },
  });
}

function requireSessionGame(session: AutoplaySession): {
  readonly upstreamGameId: string;
  readonly state: GameState;
} {
  if (session.upstreamGameId === undefined || session.state === undefined)
    throw new Error('Autoplay game state is unavailable');

  return { upstreamGameId: session.upstreamGameId, state: session.state };
}

function hasStartedGame(session: AutoplaySession): session is StartedAutoplaySession {
  return (
    session.upstreamGameId !== undefined &&
    session.state !== undefined &&
    session.game !== undefined
  );
}

async function readDecisionForTurn(session: AutoplaySession, sequence: number) {
  const { upstreamGameId, state } = requireSessionGame(session);

  session.operation = 'board-read';
  const board = await session.client.getMessages(upstreamGameId);

  session.operation = 'shop-read';
  if (session.cachedShop === undefined) {
    session.cachedShop = await session.client.getShop(upstreamGameId);
    if (session.localGameId !== undefined)
      await recordShopSnapshot(session.db, {
        gameId: session.localGameId,
        revision: sequence - 1,
        rawPayload: session.cachedShop.raw,
        items: session.cachedShop.value.map((item) => ({ ...item })),
      });
  }

  const shop = session.cachedShop;
  const decision = createTaskDecisionReport(
    sequence - 1,
    board.value,
    state,
    shop.value,
    {
      ...(session.lastActionType === undefined ? {} : { lastActionType: session.lastActionType }),
      ...(session.lastActionItemId === undefined
        ? {}
        : { lastActionItemId: session.lastActionItemId }),
      ...(session.followThroughTaskId === undefined
        ? {}
        : { followThroughTaskId: session.followThroughTaskId }),
      ...(session.followThroughItemId === undefined
        ? {}
        : { followThroughItemId: session.followThroughItemId }),
    },
    {
      reading: session.reputationReading,
      currentTurn: state.turn,
      actions: session.reputationActions,
    },
  );

  if (session.localGameId !== undefined)
    await recordBoardSnapshot(session.db, {
      gameId: session.localGameId,
      turn: state.turn,
      revision: sequence - 1,
      rawPayload: board.raw,
      normalizedAds: board.value.map((task) => ({ ...task })),
      ...(decision.recommendation === undefined
        ? {}
        : { recommendedTaskId: decision.recommendation }),
      ...(decision.purchaseAdvice.recommendedItemId === undefined
        ? {}
        : { recommendedItemId: decision.purchaseAdvice.recommendedItemId }),
    });

  return { board, shop, decision };
}

async function performReputationAction(
  session: AutoplaySession,
  sequence: number,
  decision: DecisionReport,
  selected: Extract<SelectedAction, { actionType: 'reputation' }>,
): Promise<'acted'> {
  const { upstreamGameId, state: before } = requireSessionGame(session);
  session.operation = 'action';
  const response = await session.client.investigateReputation(upstreamGameId);
  const after = { ...before, turn: before.turn + 1 };
  session.state = after;
  session.reputationReading = { values: response.value, observedTurn: after.turn };
  session.reputationActions.push({ actionType: 'reputation', status: 'completed', turn: after.turn });
  session.followThroughTaskId = undefined;
  session.followThroughItemId = undefined;
  session.lastActionType = 'reputation';
  session.lastActionItemId = undefined;

  if (session.localGameId !== undefined) {
    await recordReputationSnapshot(session.db, {
      gameId: session.localGameId,
      turn: after.turn,
      ...response.value,
      rawPayload: response.raw,
    });
    await recordStandaloneAction(session.db, {
      gameId: session.localGameId,
      sequence,
      commandId: randomUUID(),
      actionType: 'reputation',
      status: 'completed',
      source: 'autoplay',
      beforeState: before,
      afterState: after,
      request: { revision: sequence - 1, reason: selected.reason },
      response: { raw: response.raw, decision },
      rawState: { response: response.raw, state: after },
      gameStatus: isGameOver(after) ? 'finished' : 'ready',
    });
  }

  console.log({
    event: 'autoplay.reputation-checked',
    runId: session.runId,
    sequence,
    reputation: response.value,
    turn: after.turn,
  });

  return 'acted';
}

async function performTaskOrPurchase(
  session: AutoplaySession,
  sequence: number,
  decision: DecisionReport,
  selected: Exclude<SelectedAction, { actionType: 'reputation' }>,
): Promise<'acted' | 'finished'> {
  const { upstreamGameId, state: before } = requireSessionGame(session);
  session.operation = 'action';
  const actionType = selected.actionType;
  const selectedTarget = actionType === 'buy' ? selected.item : selected.task;
  const selectedId = actionType === 'buy' ? selected.item.id : selected.task.adId;
  const response =
    actionType === 'buy'
      ? await session.client.buy(upstreamGameId, selectedId)
      : await session.client.solve(upstreamGameId, selectedId);
  const after = mergeActionState(before, response.value);
  session.state = after;
  session.reputationActions.push({
    actionType,
    status: response.value.success === false ? 'failed' : 'completed',
    turn: after.turn,
    ...(actionType === 'solve' ? { taskMessage: selected.task.message } : {}),
  });

  if (actionType === 'buy' && response.value.success !== false) {
    session.followThroughTaskId =
      selectedId !== SHOP_ITEM_IDS.healingPotion &&
      decision.purchaseAdvice.recommendedItemId === selectedId
        ? decision.recommendation
        : undefined;
    session.followThroughItemId =
      session.followThroughTaskId === undefined ? undefined : selectedId;
  } else {
    session.followThroughTaskId = undefined;
    session.followThroughItemId = undefined;
  }

  session.lastActionType = actionType;
  session.lastActionItemId =
    actionType === 'buy' && response.value.success !== false ? selectedId : undefined;
  if (session.localGameId !== undefined)
    await recordStandaloneAction(session.db, {
      gameId: session.localGameId,
      sequence,
      commandId: randomUUID(),
      actionType,
      status: response.value.success === false ? 'failed' : 'completed',
      source: 'autoplay',
      beforeState: before,
      afterState: after,
      request: { revision: sequence - 1, targetId: selectedId, reason: selected.reason },
      response: { raw: response.raw, decision },
      rawState: { response: response.raw, state: after },
      gameStatus: isGameOver(after) ? 'finished' : 'ready',
    });

  logActionProgress(
    session.runId,
    sequence,
    actionType,
    selectedId,
    selectedTarget,
    response.value.success,
    before,
    after,
  );

  return isGameOver(after) ? 'finished' : 'acted';
}

async function performSelectedAction(
  session: AutoplaySession,
  sequence: number,
  decision: DecisionReport,
  selected: SelectedAction,
): Promise<'acted' | 'finished'> {
  if (selected.actionType === 'reputation')
    return performReputationAction(session, sequence, decision, selected);

  return performTaskOrPurchase(session, sequence, decision, selected);
}

async function runAutoplayTurn(
  session: AutoplaySession,
  sequence: number,
): Promise<'acted' | 'finished' | 'no-supported-action'> {
  const { board, shop, decision } = await readDecisionForTurn(session, sequence);
  const selected = selectAutoplayAction(decision, board.value, shop.value);
  if (selected === null) return 'no-supported-action';

  return performSelectedAction(session, sequence, decision, selected);
}

async function runAutoplay(
  session: AutoplaySession,
  startedAt: number,
): Promise<{ outcome: AutoplayOutcome; interruption: AutoplayInterruption | undefined }> {
  const { upstreamGameId, state } = session;
  if (upstreamGameId === undefined || state === undefined)
    return { outcome: 'capped', interruption: undefined };

  try {
    const result = await runAutoplayLoop({
      startedAt,
      isFinished: () => session.state !== undefined && isGameOver(session.state),
      step: (sequence) => runAutoplayTurn(session, sequence),
    });
    const outcome: AutoplayOutcome =
      result.reason === 'finished'
        ? 'dead'
        : result.reason === 'no-supported-action'
          ? 'no-supported-task'
          : 'capped';

    return { outcome, interruption: undefined };
  } catch (error: unknown) {
    const interruption = getInterruption(session.operation, error);

    return {
      outcome: interruption.uncertainWrite ? 'uncertain' : 'read-error',
      interruption,
    };
  }
}

async function completeAutoplayGame(
  session: AutoplaySession,
  outcome: AutoplayOutcome,
  interruption: AutoplayInterruption | undefined,
): Promise<void> {
  if (session.state !== undefined && isGameOver(session.state)) outcome = 'dead';

  if (session.localGameId !== undefined) {
    const gameStatus =
      outcome === 'dead'
        ? 'finished'
        : outcome === 'uncertain'
          ? 'needs-review'
          : 'paused';
    await setGameStatus(session.db, session.localGameId, session.ownerId, gameStatus);
  }

  console.log({
    event: 'autoplay.completed',
    runId: session.runId,
    outcome,
    ...(session.state === undefined ? {} : { finalState: session.state }),
    ...(interruption === undefined ? {} : { interruption }),
  });
}

export async function runAutoplayGame(
  baseUrl: string,
  db: Database,
  ownerId: string,
): Promise<void> {
  const runId = randomUUID();
  const session: AutoplaySession = {
    runId,
    ownerId,
    db,
    client: createUpstreamClient({ baseUrl }),
    upstreamGameId: undefined,
    localGameId: undefined,
    game: undefined,
    state: undefined,
    reputationActions: [],
    reputationReading: null,
    lastActionType: undefined,
    lastActionItemId: undefined,
    followThroughTaskId: undefined,
    followThroughItemId: undefined,
    cachedShop: undefined,
    operation: 'start',
  };
  let outcome: AutoplayOutcome = 'capped';
  let interruption: AutoplayInterruption | undefined;
  const gameStartedAt = Date.now();

  try {
    session.game = await session.client.startGame();
    session.upstreamGameId = session.game.value.gameId;
    session.state = {
      lives: session.game.value.lives,
      gold: session.game.value.gold,
      level: session.game.value.level,
      score: session.game.value.score,
      turn: session.game.value.turn,
    };
    session.reputationReading = getInitialReputationReading(session.state.turn);
  } catch (error: unknown) {
    interruption = getInterruption('start', error);
    outcome = 'start-error';
  }

  if (hasStartedGame(session)) {
    const savedGame = await createGame(session.db, {
      ownerId,
      upstreamGameId: session.upstreamGameId,
      status: 'ready',
      ...session.state,
      rawState: { raw: session.game.raw, value: session.game.value },
    });
    session.localGameId = savedGame.id;
    console.log({ event: 'autoplay.started', runId, upstreamGameId: session.upstreamGameId });
  }

  const autoplay = await runAutoplay(session, gameStartedAt);
  if (outcome !== 'start-error') outcome = autoplay.outcome;

  interruption ??= autoplay.interruption;

  await completeAutoplayGame(session, outcome, interruption);
}
