import assert from 'node:assert/strict';
import test from 'node:test';

import type { GameBoard, Task } from '../src/api/types.js';
import { currentBoard, rankTasks } from '../src/utils/game-view.js';

function task(adId: string): Task {
  return {
    adId,
    message: adId,
    encoding: 'plain',
    reward: 10,
    expiresIn: 2,
    probability: 'Likely',
    unsupportedDetails: false,
    labelChanges: [],
  };
}

const board: GameBoard = {
  revision: 4,
  ads: [task('unranked-a'), task('second'), task('unranked-b'), task('first')],
  decision: {
    revision: 4,
    reputationCheckRequired: false,
    recommendation: 'first',
    alternatives: [
      { id: 'first', score: 10, reason: 'Best choice' },
      { id: 'second', score: 5, reason: 'Next choice' },
    ],
    purchaseAdvice: {
      recommendedItemId: 'item-a',
      alternatives: [{ id: 'item-a', score: 2, action: 'buy', reason: 'Useful now' }],
    },
  },
};

void test('advice is unavailable until the board matches the visible game revision', () => {
  assert.equal(currentBoard(null, board), null);
  assert.equal(currentBoard({ revision: 5 }, board), null);
  assert.equal(
    currentBoard({ revision: 4 }, board)?.decision.purchaseAdvice.recommendedItemId,
    'item-a',
  );
});

void test('tasks follow advice rank, with unranked tasks in original order', () => {
  assert.deepEqual(
    rankTasks(board).map(({ task: entry }) => entry.adId),
    ['first', 'second', 'unranked-a', 'unranked-b'],
  );
  assert.deepEqual(rankTasks(null), []);
});
