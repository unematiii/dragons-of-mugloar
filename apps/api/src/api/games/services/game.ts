import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';

import type { GameStatus } from '@mugloar/contracts';
import {
  applyCommandResult,
  commands,
  createGame,
  findBoardSnapshotAtRevision,
  findCommand,
  findLatestReputationSnapshot,
  getGameDecisionContext,
  findOwnedGame,
  listGameActions,
  listTaskLabelSnapshots,
  listOwnedGames,
  markCommandUncertain,
  markCommandGameMissing,
  recordBoardSnapshot,
  recordShopSnapshot,
  setGameStatus,
  type Database,
} from '@mugloar/db';
import {
  createTaskDecisionReport,
  getInitialReputationReading,
  getTaskLabelOrder,
  getShopOffers,
  isGameOver,
  isTaskSupported,
  mergeActionState,
  runAutoplayLoop,
  selectAutoplayAction,
  SHOP_ITEM_IDS,
  updateGameStatus,
  type GameState,
  type NormalizedAction,
  type NormalizedShopItem,
  type AutoplayStopReason,
  type UpstreamClient,
  type UpstreamEnvelope,
  type UpstreamReputation,
  UpstreamError,
  UpstreamGameNotFoundError,
} from '@mugloar/game';

import { gameError } from '../error.js';

type ActionType = 'solve' | 'buy' | 'reputation';

interface ReputationSnapshot {
  readonly turn: number;
  readonly people: number;
  readonly state: number;
  readonly underworld: number;
  readonly rawPayload: unknown;
}
type ActionSource = 'manual' | 'autoplay';

interface CommandInputBase {
  readonly gameId: string;
  readonly ownerId: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly source?: ActionSource;
  readonly decisionReason?: string;
}

type SubmitCommandInput =
  | (CommandInputBase & { readonly actionType: 'reputation'; readonly targetId?: never })
  | (CommandInputBase & { readonly actionType: 'solve' | 'buy'; readonly targetId: string });

interface SubmitCommandResult<T> {
  readonly gameId: string;
  readonly revision: number;
  readonly state: GameState;
  readonly result: T;
}

interface AutoplayRun {
  readonly ownerId: string;
  stopRequested: boolean;
  promise: Promise<void>;
}

const MAX_CONCURRENT_AUTOPLAY_RUNS = 2;

function getUpstreamFailureEvidence(error: unknown): Record<string, unknown> {
  if (error instanceof UpstreamError) {
    return {
      error: error.message,
      statusCode: error.statusCode ?? null,
      raw: error.raw ?? null,
    };
  }

  return { error: error instanceof Error ? error.message : 'Unknown upstream failure' };
}

function gameStateOf(game: GameState): GameState {
  return {
    lives: game.lives,
    gold: game.gold,
    level: game.level,
    score: game.score,
    turn: game.turn,
  };
}

export interface GamesServiceDependencies {
  readonly db: Database;
  readonly upstream: UpstreamClient;
  readonly logger?: FastifyBaseLogger;
}

export class GamesService {
  private readonly gameLocks = new Map<string, Promise<void>>();
  private readonly autoplayRuns = new Map<string, AutoplayRun>();
  private readonly gameListeners = new Map<string, Set<(message: unknown) => void>>();
  private readonly shopCatalogs = new Map<
    string,
    Promise<UpstreamEnvelope<readonly NormalizedShopItem[]>>
  >();

  private readonly db: Database;
  private readonly upstream: UpstreamClient;
  private readonly logger: FastifyBaseLogger | undefined;

  constructor({ db, upstream, logger }: GamesServiceDependencies) {
    this.db = db;
    this.upstream = upstream;
    this.logger = logger;
  }

  // Requests can overlap while awaiting I/O; serialize each game so concurrent actions cannot both
  // pass the same revision check. This in-memory lock coordinates this single API process only.
  private async serializeGameAction<T>(gameId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.gameLocks.get(gameId) ?? Promise.resolve();

    // Chain this action after the previous one; keep the queue usable if either action rejects.
    const current = previous.then(action);

    // Discard the result or error in the queue marker so a failed action cannot block later ones.
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.gameLocks.set(gameId, tail);

    try {
      return await current;
    } finally {
      if (this.gameLocks.get(gameId) === tail) this.gameLocks.delete(gameId);
    }
  }

  private async requireOwnedGame(gameId: string, ownerId: string) {
    const game = await findOwnedGame(this.db, gameId, ownerId);
    if (game === null) throw gameError('GAME_NOT_FOUND', 'Game not found');

    return game;
  }

  private async findPurchaseFollowThrough(
    gameId: string,
    revision: number,
    history: Awaited<ReturnType<typeof getGameDecisionContext>>,
  ): Promise<{ followThroughTaskId: string; followThroughItemId: string } | null> {
    const purchase = history.lastAction;
    if (
      purchase?.actionType !== 'buy' ||
      purchase.status !== 'completed' ||
      purchase.sequence !== revision
    )
      return null;

    const purchasedItemId = purchase.request['targetId'];
    const previousRevision = purchase.request['revision'];
    if (
      typeof purchasedItemId !== 'string' ||
      purchasedItemId === SHOP_ITEM_IDS.healingPotion ||
      typeof previousRevision !== 'number'
    )
      return null;

    const snapshot = await findBoardSnapshotAtRevision(this.db, gameId, previousRevision);
    // These IDs were calculated together for the board the player saw. A purchase of
    // any other item does not claim to have been made for that recommended task.
    if (
      snapshot?.recommendedTaskId === null ||
      snapshot?.recommendedTaskId === undefined ||
      snapshot.recommendedItemId !== purchasedItemId
    )
      return null;

    return {
      followThroughTaskId: snapshot.recommendedTaskId,
      followThroughItemId: purchasedItemId,
    };
  }

  subscribeToGame(gameId: string, listener: (message: unknown) => void): () => void {
    const listeners = this.gameListeners.get(gameId) ?? new Set();
    listeners.add(listener);
    this.gameListeners.set(gameId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.gameListeners.delete(gameId);
    };
  }

  private publishGameUpdate(gameId: string, message: unknown): void {
    for (const listener of this.gameListeners.get(gameId) ?? []) listener(message);
  }

  private async updateGameStatus(gameId: string, ownerId: string, status: string): Promise<void> {
    const game = await setGameStatus(this.db, gameId, ownerId, status);
    if (game !== null)
      this.publishGameUpdate(game.id, { id: game.id, revision: game.revision, status });
  }

  private clearShopCatalog(gameId: string): void {
    this.shopCatalogs.delete(gameId);
  }

  private stopAutoplayAndClearShopCatalog(gameId: string): void {
    const run = this.autoplayRuns.get(gameId);
    if (run !== undefined) run.stopRequested = true;

    this.clearShopCatalog(gameId);
  }

  private async markUpstreamGameMissing(gameId: string, ownerId: string): Promise<void> {
    this.stopAutoplayAndClearShopCatalog(gameId);

    await this.serializeGameAction(gameId, async () => {
      const game = await this.requireOwnedGame(gameId, ownerId);
      if (game.status === 'finished' || game.status === 'needs-review') return;

      if (game.status !== 'upstream-missing')
        await this.updateGameStatus(gameId, ownerId, 'upstream-missing');
    });
  }

  private async readUpstream<T>(
    gameId: string,
    ownerId: string,
    read: () => Promise<T>,
  ): Promise<T> {
    try {
      return await read();
    } catch (error: unknown) {
      if (!(error instanceof UpstreamGameNotFoundError)) throw error;

      await this.markUpstreamGameMissing(gameId, ownerId);

      throw gameError(
        'UPSTREAM_GAME_NOT_FOUND',
        'The upstream service returned 404 for this game. It may have expired or been removed.',
        { cause: error },
      );
    }
  }

  private async createPendingCommand(input: {
    readonly gameId: string;
    readonly commandId: string;
    readonly expectedRevision: number;
    readonly actionType: ActionType;
    readonly request: Record<string, unknown>;
  }): Promise<string> {
    if ((await findCommand(this.db, input.gameId, input.commandId)) !== null)
      throw gameError('DUPLICATE_COMMAND', 'Command ID has already been used');

    const [command] = await this.db
      .insert(commands)
      .values({
        gameId: input.gameId,
        clientCommandId: input.commandId,
        expectedRevision: input.expectedRevision,
        actionType: input.actionType,
        status: 'pending',
        request: input.request,
      })
      .returning();
    if (command === undefined) throw new Error('Command insert returned no row');

    return command.id;
  }

  private async failCommand(input: {
    readonly error: unknown;
    readonly gameId: string;
    readonly revision: number;
    readonly commandId: string;
    readonly actionType: ActionType;
    readonly before: GameState;
    readonly request: Record<string, unknown>;
    readonly source?: ActionSource;
  }): Promise<never> {
    const evidence = getUpstreamFailureEvidence(input.error);
    const failure = {
      commandId: input.commandId,
      gameId: input.gameId,
      sequence: input.revision + 1,
      actionType: input.actionType,
      beforeState: { ...input.before },
      request: input.request,
      evidence,
      ...(input.source === undefined ? {} : { source: input.source }),
    };

    if (input.error instanceof UpstreamGameNotFoundError) {
      await markCommandGameMissing(this.db, failure);
      this.stopAutoplayAndClearShopCatalog(input.gameId);
      this.publishGameUpdate(input.gameId, {
        id: input.gameId,
        revision: input.revision,
        status: 'upstream-missing',
      });

      throw gameError(
        'UPSTREAM_GAME_NOT_FOUND',
        'The upstream service returned 404 for this game. It may have expired or been removed.',
        { cause: input.error },
      );
    }

    await markCommandUncertain(this.db, failure);
    this.clearShopCatalog(input.gameId);
    // Background autoplay has no waiting browser request to refresh the game after this throw.
    this.publishGameUpdate(input.gameId, {
      id: input.gameId,
      revision: input.revision,
      status: 'needs-review',
    });

    throw gameError(
      'COMMAND_UNCERTAIN',
      input.actionType === 'reputation'
        ? 'The reputation reading is uncertain. This game cannot safely accept more actions.'
        : 'The upstream result is uncertain. This game cannot safely accept more actions.',
      { cause: input.error },
    );
  }

  private async getShopCatalog(
    game: {
      readonly id: string;
      readonly upstreamGameId: string;
      readonly revision: number;
    },
    ownerId: string,
  ): Promise<UpstreamEnvelope<readonly NormalizedShopItem[]>> {
    const cached = this.shopCatalogs.get(game.id);
    if (cached !== undefined) return cached;

    // Share the per-game catalogue between board and shop requests; observed actions do not change it.
    const loading = (async () => {
      const shop = await this.readUpstream(game.id, ownerId, () =>
        this.upstream.getShop(game.upstreamGameId),
      );
      await recordShopSnapshot(this.db, {
        gameId: game.id,
        revision: game.revision,
        rawPayload: shop.raw,
        items: shop.value.map((item) => ({ ...item })),
      });

      return shop;
    })();
    this.shopCatalogs.set(game.id, loading);

    try {
      return await loading;
    } catch (error: unknown) {
      if (this.shopCatalogs.get(game.id) === loading) this.clearShopCatalog(game.id);

      throw error;
    }
  }

  async startAutoplay(gameId: string, ownerId: string): Promise<void> {
    await this.serializeGameAction(gameId, async () => {
      const game = await this.requireOwnedGame(gameId, ownerId);
      if (game.status !== 'ready' && game.status !== 'paused')
        throw gameError('GAME_NOT_ACTIVE', 'This game cannot start autoplay');

      if (this.autoplayRuns.has(gameId))
        throw gameError('GAME_NOT_ACTIVE', 'Autoplay is already active for this game');

      if ([...this.autoplayRuns.values()].some((run) => run.ownerId === ownerId))
        throw gameError(
          'AUTOPLAY_LIMIT_REACHED',
          'Another game is already running autoplay for this player',
        );

      if (this.autoplayRuns.size >= MAX_CONCURRENT_AUTOPLAY_RUNS)
        throw gameError('AUTOPLAY_LIMIT_REACHED', 'The server has reached its autoplay capacity');

      let settleRun: () => void = () => undefined;
      const runPromise = new Promise<void>((resolve) => {
        settleRun = resolve;
      });
      const run: AutoplayRun = {
        ownerId,
        stopRequested: false,
        promise: runPromise,
      };
      this.autoplayRuns.set(gameId, run);
      try {
        await this.updateGameStatus(gameId, ownerId, 'running');
      } catch (error: unknown) {
        this.autoplayRuns.delete(gameId);
        settleRun();

        throw error;
      }

      void this.runAutoplay(gameId, run).then(settleRun, settleRun);
    });
  }

  async pauseAutoplay(gameId: string, ownerId: string): Promise<void> {
    const game = await this.requireOwnedGame(gameId, ownerId);
    const run = this.autoplayRuns.get(gameId);
    if (run === undefined) {
      if (game.status === 'running' || game.status === 'pausing') {
        await this.updateGameStatus(gameId, ownerId, 'paused');

        return;
      }

      throw gameError('GAME_NOT_ACTIVE', 'This game is not running autoplay');
    }

    if (game.status === 'upstream-missing') {
      run.stopRequested = true;
      await run.promise;

      return;
    }

    run.stopRequested = true;
    await this.updateGameStatus(gameId, ownerId, 'pausing');
    await run.promise;
  }

  async stopAllAutoplay(): Promise<void> {
    const runs = [...this.autoplayRuns.entries()];
    for (const [gameId, run] of runs) {
      run.stopRequested = true;
      const game = await this.requireOwnedGame(gameId, run.ownerId).catch(() => null);
      if (game?.status === 'running' || game?.status === 'pausing')
        await this.updateGameStatus(gameId, run.ownerId, 'pausing').catch(() => undefined);
    }

    await Promise.all(runs.map(([, run]) => run.promise));
  }

  private async runAutoplay(gameId: string, run: AutoplayRun): Promise<void> {
    let stopReason: AutoplayStopReason | 'error' = 'error';

    try {
      const result = await runAutoplayLoop({
        shouldStop: () => run.stopRequested,
        step: async () => {
          // Re-read state before each decision; submitCommand serializes the actual write.
          const game = await this.requireOwnedGame(gameId, run.ownerId);
          if (game.status !== 'running') return 'stopped';

          const board = await this.getBoard(gameId, run.ownerId);
          if (run.stopRequested) return 'stopped';

          const selected = selectAutoplayAction(
            board.decision,
            board.ads.map((item) => item.task),
            board.shopItems,
          );
          if (selected === null) return 'no-supported-action';

          if (selected.actionType === 'reputation') {
            await this.investigateReputation({
              gameId,
              ownerId: run.ownerId,
              commandId: randomUUID(),
              expectedRevision: game.revision,
              source: 'autoplay',
            });

            return 'acted';
          }

          const result = await this.submitCommand({
            gameId,
            ownerId: run.ownerId,
            commandId: randomUUID(),
            expectedRevision: game.revision,
            actionType: selected.actionType,
            targetId: selected.actionType === 'buy' ? selected.item.id : selected.task.adId,
            source: 'autoplay',
            decisionReason: selected.reason,
          });

          return isGameOver(result.state) ? 'finished' : 'acted';
        },
      });
      stopReason = result.reason;
      this.logger?.info({ gameId, ownerId: run.ownerId, ...result }, 'Autoplay stopped');
    } catch (error: unknown) {
      // Uncertain writes already mark needs-review; log all failures for diagnosis.
      this.logger?.error({ err: error, gameId, ownerId: run.ownerId }, 'Autoplay failed');
    } finally {
      this.autoplayRuns.delete(gameId);
      const game = await this.requireOwnedGame(gameId, run.ownerId).catch(() => null);
      if (game?.status === 'running' || game?.status === 'pausing') {
        await this.updateGameStatus(gameId, run.ownerId, 'paused').catch(() => undefined);
      }

      const stopMessages: Partial<Record<AutoplayStopReason | 'error', string>> = {
        'action-cap': 'Autoplay paused after reaching its action limit.',
        'time-cap': 'Autoplay paused after reaching its time limit.',
        'no-supported-action': 'Autoplay paused because no supported action is available.',
        error: 'Autoplay stopped because an error occurred. Check the game state before resuming.',
      };
      const message = stopMessages[stopReason];
      if (message !== undefined)
        this.publishGameUpdate(gameId, { id: gameId, autoplayStopReason: stopReason, message });
    }
  }

  async createGame(ownerId: string) {
    const upstreamGame = await this.upstream.startGame();

    return createGame(this.db, {
      ownerId,
      upstreamGameId: upstreamGame.value.gameId,
      status: 'ready',
      lives: upstreamGame.value.lives,
      gold: upstreamGame.value.gold,
      level: upstreamGame.value.level,
      score: upstreamGame.value.score,
      turn: upstreamGame.value.turn,
      rawState: upstreamGame.raw as Record<string, unknown>,
    });
  }

  listGames(ownerId: string) {
    return listOwnedGames(this.db, ownerId);
  }

  getGame(gameId: string, ownerId: string) {
    return this.requireOwnedGame(gameId, ownerId);
  }

  async getReputation(gameId: string, ownerId: string) {
    const game = await this.requireOwnedGame(gameId, ownerId);
    const snapshot = await findLatestReputationSnapshot(this.db, game.id);

    return snapshot === null
      ? null
      : {
          people: snapshot.people,
          state: snapshot.state,
          underworld: snapshot.underworld,
          observedTurn: snapshot.turn,
        };
  }

  async getBoard(gameId: string, ownerId: string) {
    const game = await this.requireOwnedGame(gameId, ownerId);
    if (game.status === 'upstream-missing')
      throw gameError('UPSTREAM_GAME_NOT_FOUND', 'This upstream game is no longer available');

    const [board, shop, history, reputationSnapshot, actions] = await Promise.all([
      this.readUpstream(gameId, ownerId, () => this.upstream.getMessages(game.upstreamGameId)),
      this.getShopCatalog(game, ownerId),
      getGameDecisionContext(this.db, game.id),
      findLatestReputationSnapshot(this.db, game.id),
      listGameActions(this.db, game.id),
    ]);
    const followThrough = await this.findPurchaseFollowThrough(game.id, game.revision, history);
    const firstActionTurn = actions[0]?.turn;
    const initialObservedTurn =
      firstActionTurn === null || firstActionTurn === undefined
        ? game.turn
        : firstActionTurn - 1;
    const decision = createTaskDecisionReport(
      game.revision,
      board.value,
      {
        lives: game.lives,
        gold: game.gold,
        level: game.level,
      },
      shop.value,
      { ...history, ...(followThrough ?? {}) },
      {
        reading:
          reputationSnapshot === null
            ? getInitialReputationReading(initialObservedTurn)
            : {
                values: {
                  people: reputationSnapshot.people,
                  state: reputationSnapshot.state,
                  underworld: reputationSnapshot.underworld,
                },
                observedTurn: reputationSnapshot.turn,
              },
        currentTurn: game.turn,
        actions: actions.map((action) => ({
          actionType: action.actionType,
          status: action.status,
          turn: action.turn,
          ...(action.targetDescription === null ? {} : { taskMessage: action.targetDescription }),
        })),
      },
    );

    const priorLabels = await listTaskLabelSnapshots(
      this.db,
      game.id,
      game.revision,
      board.value.map((task) => task.adId),
    );
    const labelsByTask = new Map<string, (typeof priorLabels)[number][]>();
    for (const snapshot of priorLabels) {
      const entries = labelsByTask.get(snapshot.adId) ?? [];
      entries.push(snapshot);

      labelsByTask.set(snapshot.adId, entries);
    }

    const labelChangesByTask = new Map<
      string,
      {
        readonly fromTurn: number;
        readonly toTurn: number;
        readonly fromLabel: string;
        readonly toLabel: string;
        readonly fromRank: number | null;
        readonly toRank: number | null;
        readonly delta: number | null;
      }[]
    >();
    for (const task of board.value) {
      const previous = labelsByTask.get(task.adId) ?? [];
      let prior: { turn: number; probability: string } | undefined;
      for (const entry of [...previous, { turn: game.turn, probability: task.probability }]) {
        if (prior !== undefined && prior.probability !== entry.probability) {
          const fromRank = getTaskLabelOrder(prior.probability);
          const toRank = getTaskLabelOrder(entry.probability);
          const changes = labelChangesByTask.get(task.adId) ?? [];
          changes.push({
            fromTurn: prior.turn,
            toTurn: entry.turn,
            fromLabel: prior.probability,
            toLabel: entry.probability,
            fromRank,
            toRank,
            // Lower label ranks are safer; a positive delta therefore means the label improved.
            delta: fromRank === null || toRank === null ? null : fromRank - toRank,
          });
          labelChangesByTask.set(task.adId, changes);
        }

        prior = entry;
      }
    }

    await recordBoardSnapshot(this.db, {
      gameId: game.id,
      turn: game.turn,
      revision: game.revision,
      rawPayload: board.raw,
      normalizedAds: board.value.map((ad) => ({ ...ad })),
      ...(decision.recommendation === undefined
        ? {}
        : { recommendedTaskId: decision.recommendation }),
      ...(decision.purchaseAdvice.recommendedItemId === undefined
        ? {}
        : { recommendedItemId: decision.purchaseAdvice.recommendedItemId }),
    });

    return {
      game,
      shopItems: shop.value,
      ads: board.value.map((task) => ({
        task,
        supported: isTaskSupported(task),
        labelChanges: labelChangesByTask.get(task.adId) ?? [],
      })),
      decision,
    };
  }

  async getShop(gameId: string, ownerId: string) {
    const game = await this.requireOwnedGame(gameId, ownerId);
    if (game.status === 'upstream-missing')
      throw gameError('UPSTREAM_GAME_NOT_FOUND', 'This upstream game is no longer available');

    const shop = await this.getShopCatalog(game, ownerId);

    return {
      revision: game.revision,
      items: getShopOffers(shop.value, game.gold),
    };
  }

  investigateReputation(input: {
    readonly gameId: string;
    readonly ownerId: string;
    readonly commandId: string;
    readonly expectedRevision: number;
    readonly source?: ActionSource;
  }) {
    return this.submitCommand({ ...input, actionType: 'reputation' }).then(({ result, state }) => ({
      ...result,
      observedTurn: state.turn,
    }));
  }

  listActions(gameId: string, ownerId: string) {
    return this.requireOwnedGame(gameId, ownerId).then((game) => listGameActions(this.db, game.id));
  }

  submitCommand(
    input: CommandInputBase & { readonly actionType: 'reputation'; readonly targetId?: never },
  ): Promise<SubmitCommandResult<UpstreamReputation>>;
  submitCommand(
    input: CommandInputBase & { readonly actionType: 'solve' | 'buy'; readonly targetId: string },
  ): Promise<SubmitCommandResult<NormalizedAction>>;
  submitCommand(
    input: SubmitCommandInput,
  ): Promise<SubmitCommandResult<NormalizedAction | UpstreamReputation>> {
    return this.serializeGameAction(input.gameId, async () => {
      const game = await this.requireOwnedGame(input.gameId, input.ownerId);
      if (game.revision !== input.expectedRevision)
        throw gameError('STALE_REVISION', 'The game changed. Refresh before acting.');

      if (
        game.status === 'finished' ||
        game.status === 'needs-review' ||
        game.status === 'upstream-missing' ||
        game.status === 'pausing' ||
        (game.status === 'running' && input.source !== 'autoplay') ||
        (input.source === 'autoplay' && game.status !== 'running')
      )
        throw gameError('GAME_NOT_ACTIVE', 'This game cannot accept actions');

      const before = gameStateOf(game);
      const request = {
        commandId: input.commandId,
        revision: input.expectedRevision,
        ...(input.actionType === 'reputation' ? {} : { targetId: input.targetId }),
        ...(input.decisionReason === undefined ? {} : { decisionReason: input.decisionReason }),
      };
      const commandId = await this.createPendingCommand({
        gameId: game.id,
        commandId: input.commandId,
        expectedRevision: input.expectedRevision,
        actionType: input.actionType,
        request,
      });

      let responseRaw: unknown;
      let responseResult: NormalizedAction | UpstreamReputation;
      let state: GameState;
      let status: GameStatus;
      let reputationSnapshot: ReputationSnapshot | undefined;
      let message: string | undefined;
      let actionStatus: 'completed' | 'failed' = 'completed';
      
      try {
        if (input.actionType === 'reputation') {
          const response = await this.upstream.investigateReputation(game.upstreamGameId);
          responseRaw = response.raw;
          responseResult = response.value;
          state = { ...before, turn: before.turn + 1 };
          status = game.status as GameStatus;
          reputationSnapshot = {
            turn: state.turn,
            ...response.value,
            rawPayload: response.raw,
          };
          message = 'Reputation investigated.';
        } else {
          const response =
            input.actionType === 'solve'
              ? await this.upstream.solve(game.upstreamGameId, input.targetId)
              : await this.upstream.buy(game.upstreamGameId, input.targetId);
          responseRaw = response.raw;
          responseResult = response.value;
          state = mergeActionState(before, response.value);
          status = updateGameStatus(game.status as GameStatus, state);
          message = response.value.message;
          actionStatus = response.value.success === false ? 'failed' : 'completed';
        }
      } catch (error: unknown) {
        return this.failCommand({
          error,
          gameId: game.id,
          revision: game.revision,
          commandId,
          actionType: input.actionType,
          before,
          request,
          ...(input.source === undefined ? {} : { source: input.source }),
        });
      }

      const revision = game.revision + 1;
      await applyCommandResult(this.db, {
        commandId,
        gameId: game.id,
        ownerId: input.ownerId,
        state,
        revision,
        status,
        response: responseRaw as Record<string, unknown>,
        action: {
          actionType: input.actionType,
          status: actionStatus,
          beforeState: { ...before },
          afterState: { ...state },
          request,
          ...(message === undefined ? {} : { message }),
          source: input.source ?? 'manual',
        },
        ...(reputationSnapshot === undefined ? {} : { reputationSnapshot }),
      });

      if (status === 'finished') this.clearShopCatalog(game.id);

      const result = { gameId: game.id, revision, state, result: responseResult };
      this.publishGameUpdate(game.id, result);

      return result;
    });
  }
}
