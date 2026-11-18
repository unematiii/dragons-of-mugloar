import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTaskDecisionReport,
  runAutoplayLoop,
  selectAutoplayAction,
  type NormalizedShopItem,
  type UpstreamMessage,
} from '../src/index.js';

const task: UpstreamMessage = {
  adId: 'task-1',
  rawAdId: 'task-1',
  message: 'A task',
  rawMessage: 'A task',
  reward: 100,
  expiresIn: 3,
  probability: 'Sure thing',
  rawProbability: 'Sure thing',
  encrypted: null,
  encoding: 'plain',
  decoding: 'not-needed',
  raw: {},
};
const healing: NormalizedShopItem = { id: 'hpot', name: 'Healing potion', cost: 50, raw: {} };

void test('both callers select the policy purchase before its task recommendation', () => {
  const decision = createTaskDecisionReport(4, [task], { lives: 1, gold: 50, level: 0 }, [healing]);

  assert.deepEqual(selectAutoplayAction(decision, [task], [healing]), {
    actionType: 'buy',
    item: healing,
    reason: decision.purchaseAdvice.alternatives.find((item) => item.id === healing.id)?.reason,
  });
  assert.equal(selectAutoplayAction(decision, [task], [])?.actionType, 'solve');
});

void test('a pause during pacing prevents another action', async () => {
  let stopped = false;
  let actions = 0;
  const result = await runAutoplayLoop({
    shouldStop: () => stopped,
    wait: () => {
      stopped = true;

      return Promise.resolve();
    },
    step: () => {
      actions += 1;

      return Promise.resolve('acted');
    },
  });

  assert.deepEqual(result, { actions: 0, reason: 'stopped' });
  assert.equal(actions, 0);
});

void test('the shared runner applies the action cap to completed actions', async () => {
  let actions = 0;
  const result = await runAutoplayLoop({
    actionCap: 2,
    wait: () => Promise.resolve(),
    step: () => {
      actions += 1;

      return Promise.resolve('acted');
    },
  });

  assert.deepEqual(result, { actions: 2, reason: 'action-cap' });
  assert.equal(actions, 2);
});
