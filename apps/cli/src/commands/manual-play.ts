import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

import {
  createDatabase,
  createGame,
  createPlayer,
  getGameDecisionContext,
  recordBoardSnapshot,
  recordShopSnapshot,
  recordStandaloneAction,
  setGameStatus,
} from '@mugloar/db';
import {
  createTaskDecisionReport,
  createUpstreamClient,
  isGameOver,
  mergeActionState,
  SHOP_ITEM_IDS,
} from '@mugloar/game';
import type { GameState, NormalizedShopItem, UpstreamMessage } from '@mugloar/game';

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value))
    return value as Record<string, unknown>;

  return { value };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function showBoard(board: readonly UpstreamMessage[], shop: readonly NormalizedShopItem[]): void {
  console.log('\nTasks');
  board.forEach((task, index) => {
    console.log(
      `${index + 1}. [${task.probability}] ${task.message} — reward ${task.reward}, expires ${task.expiresIn}`,
    );
  });
  console.log('\nShop');
  shop.forEach((item, index) => {
    console.log(`b${index + 1}. ${item.name} — ${item.cost} gold`);
  });
  console.log('Enter a task number, b plus a shop number, or q to stop.');
}

function selectAction(
  input: string,
  board: readonly UpstreamMessage[],
  shop: readonly NormalizedShopItem[],
):
  | { readonly type: 'solve'; readonly selected: UpstreamMessage }
  | {
      readonly type: 'buy';
      readonly selected: NormalizedShopItem;
    }
  | undefined {
  const value = input.trim().toLowerCase();
  if (/^b\d+$/.test(value)) {
    const selected = shop[Number(value.slice(1)) - 1];
    if (selected !== undefined) return { type: 'buy', selected };

    return undefined;
  }

  if (/^\d+$/.test(value)) {
    const selected = board[Number(value) - 1];
    if (selected !== undefined) return { type: 'solve', selected };
  }

  return undefined;
}

export async function runManualPlay(): Promise<void> {
  const baseUrl = process.env['UPSTREAM_BASE_URL'];
  const databaseUrl = process.env['DATABASE_URL'];
  if (baseUrl === undefined || baseUrl.length === 0)
    throw new Error('Set UPSTREAM_BASE_URL before starting a game');

  if (databaseUrl === undefined || databaseUrl.length === 0)
    throw new Error('Set DATABASE_URL; manual CLI games are always saved to PostgreSQL');

  const { db, pool } = createDatabase(databaseUrl);
  const prompt = createInterface({ input: stdin, output: stdout });
  let localGameId: string | undefined;
  let ownerId: string | undefined;
  let state: GameState | undefined;
  let revision = 0;
  let status = 'paused';
  let followThroughTaskId: string | undefined;
  let followThroughItemId: string | undefined;

  try {
    const player = await createPlayer(db);
    ownerId = player.id;
    const client = createUpstreamClient({ baseUrl });
    const started = await client.startGame();
    const upstreamGameId = started.value.gameId;
    state = {
      lives: started.value.lives,
      gold: started.value.gold,
      level: started.value.level,
      score: started.value.score,
      turn: started.value.turn,
    };
    const game = await createGame(db, {
      ownerId,
      upstreamGameId,
      status: 'ready',
      ...state,
      rawState: { raw: started.raw, value: started.value },
    });
    localGameId = game.id;
    console.log({ event: 'manual.started', gameId: localGameId, upstreamGameId, state });

    while (!isGameOver(state)) {
      const board = await client.getMessages(upstreamGameId);
      const shop = await client.getShop(upstreamGameId);
      await recordShopSnapshot(db, {
        gameId: localGameId,
        revision,
        rawPayload: shop.raw,
        items: shop.value.map((item) => ({ ...item })),
      });

      const history = await getGameDecisionContext(db, localGameId);
      const report = createTaskDecisionReport(revision, board.value, state, shop.value, {
        ...history,
        ...(followThroughTaskId === undefined ? {} : { followThroughTaskId }),
        ...(followThroughItemId === undefined ? {} : { followThroughItemId }),
      });
      await recordBoardSnapshot(db, {
        gameId: localGameId,
        turn: state.turn,
        revision,
        rawPayload: board.raw,
        normalizedAds: board.value.map((task) => ({ ...task })),
        ...(report.recommendation === undefined
          ? {}
          : { recommendedTaskId: report.recommendation }),
        ...(report.purchaseAdvice.recommendedItemId === undefined
          ? {}
          : { recommendedItemId: report.purchaseAdvice.recommendedItemId }),
      });
      console.log({ event: 'manual.state', gameId: localGameId, state, recommendation: report });
      showBoard(board.value, shop.value);
      const answer = await prompt.question('Choose: ');
      if (answer.trim().toLowerCase() === 'q') break;

      const action = selectAction(answer, board.value, shop.value);
      if (action === undefined) {
        console.log('Invalid selection. Choose a listed task or shop number.');
        continue;
      }

      await sleep(1500);
      const before = state;
      const response =
        action.type === 'solve'
          ? await client.solve(upstreamGameId, action.selected.adId)
          : await client.buy(upstreamGameId, action.selected.id);
      state = mergeActionState(before, response.value);
      if (action.type === 'buy' && response.value.success !== false) {
        followThroughTaskId =
          action.selected.id !== SHOP_ITEM_IDS.healingPotion &&
          report.purchaseAdvice.recommendedItemId === action.selected.id
            ? report.recommendation
            : undefined;
        followThroughItemId = followThroughTaskId === undefined ? undefined : action.selected.id;
      } else {
        followThroughTaskId = undefined;
        followThroughItemId = undefined;
      }

      revision += 1;
      await recordStandaloneAction(db, {
        gameId: localGameId,
        sequence: revision,
        commandId: randomUUID(),
        actionType: action.type,
        status: response.value.success === false ? 'failed' : 'completed',
        beforeState: before,
        afterState: state,
        request: {
          revision: revision - 1,
          targetId: action.type === 'solve' ? action.selected.adId : action.selected.id,
          targetName: action.type === 'solve' ? action.selected.message : action.selected.name,
          decisionReport: report,
        },
        response: asRecord(response.raw),
        rawState: { response: response.raw, state },
        gameStatus: isGameOver(state) ? 'finished' : 'ready',
      });
      console.log({
        event: 'manual.action',
        gameId: localGameId,
        sequence: revision,
        actionType: action.type,
        selected: action.selected,
        success: response.value.success,
        state,
      });
    }

    status = isGameOver(state) ? 'finished' : 'paused';
  } finally {
    if (localGameId !== undefined && ownerId !== undefined)
      await setGameStatus(db, localGameId, ownerId, status);

    prompt.close();
    await pool.end();
  }
}

export const manualPlayCommand = new Command('play').description(
  'Start a game, choose each task or purchase manually, and save every observation',
);
manualPlayCommand.action(runManualPlay);
