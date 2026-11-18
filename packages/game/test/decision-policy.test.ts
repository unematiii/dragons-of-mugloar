import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTaskDecisionReport,
  getTaskLabelOrder,
  selectAutoplayAction,
  type NormalizedShopItem,
  type UpstreamMessage,
} from '../src/index.js';

function task(
  id: string,
  message: string,
  probability: string,
  reward: number,
  expiresIn: number,
): UpstreamMessage {
  return {
    adId: id,
    rawAdId: id,
    message,
    rawMessage: message,
    probability,
    rawProbability: probability,
    reward,
    expiresIn,
    encrypted: null,
    encoding: 'plain',
    decoding: 'not-needed',
    raw: {},
  };
}

const healing: NormalizedShopItem = { id: 'hpot', name: 'Healing potion', cost: 50, raw: {} };
const wings: NormalizedShopItem = {
  id: 'wingpot',
  name: 'Potion of Stronger Wings',
  cost: 100,
  raw: {},
};
const book: NormalizedShopItem = { id: 'tricks', name: 'Book of Tricks', cost: 100, raw: {} };

void test('Impossible ranks below Suicide mission in history without changing recommendations', () => {
  const impossible = task('impossible', 'Impossible task', 'Impossible', 100, 2);
  const suicide = task('suicide', 'Suicide task', 'Suicide mission', 100, 2);
  const tasks = [impossible, suicide];

  assert.equal(getTaskLabelOrder('Suicide mission'), 10);
  assert.equal(getTaskLabelOrder('Impossible'), 11);

  const report = createTaskDecisionReport(1, tasks);
  assert.equal(report.recommendation, suicide.adId);
  assert.match(report.alternatives[1]?.reason ?? '', /unfamiliar difficulty word/);
  const selection = selectAutoplayAction(report, tasks, []);
  assert.equal(selection?.actionType, 'solve');
  if (selection?.actionType === 'solve') assert.equal(selection.task.adId, suicide.adId);
});

void test('a reputation check becomes the autoplay action when the reading is missing', () => {
  const job = task('help', 'Help someone sell a horse', 'Piece of cake', 50, 5);
  const decision = createTaskDecisionReport(
    1,
    [job],
    undefined,
    [],
    {},
    {
      reading: null,
      currentTurn: 1,
      actions: [],
    },
  );

  assert.equal(decision.reputationCheckRequired, true);
  assert.equal(decision.reputationCheckReason, undefined);
  assert.equal(selectAutoplayAction(decision, [job], [])?.actionType, 'reputation');
});

void test('a reputation-balancing task ranks before a task that could cross the Steal cutoff', () => {
  const steal = task('steal', 'Steal a bucket delivery', 'Piece of cake', 80, 5);
  const help = task('help', 'Help someone sell a horse', 'Piece of cake', 50, 5);
  const decision = createTaskDecisionReport(
    1,
    [steal, help],
    undefined,
    [],
    {},
    {
      reading: {
        values: { people: 0, state: -9, underworld: 0 },
        observedTurn: 1,
      },
      currentTurn: 1,
      actions: [],
    },
  );

  assert.equal(decision.recommendation, help.adId);
  assert.match(decision.alternatives[1]?.reason ?? '', /government reputation/);
});

void test('the screenshot deadline beats shopping, then training resumes after that task', () => {
  const expiring = task(
    'novel',
    'Help Hudson Comstock to write their biographical novel about their difficulties with a deranged pot',
    'Walk in the park',
    43,
    1,
  );
  const otherTasks = [
    task(
      'escort',
      'Escort Milford Stanton to pasture in Darkmountain where they can meet with their long lost potatoes',
      'Quite likely',
      78,
      6,
    ),
    task(
      'defend',
      'Help defending grassland in Bleakmountain from the intruders',
      'Sure thing',
      142,
      7,
    ),
    task(
      'dog',
      'Escort Lotus Rathbone to thrift shoppe in Towercawl where they can meet with their long lost dog',
      'Walk in the park',
      60,
      7,
    ),
  ];
  const board = [otherTasks[0]!, otherTasks[1]!, otherTasks[2]!, expiring];
  const state = { lives: 3, gold: 250, level: 2 };
  const shop = [healing, wings];

  const now = createTaskDecisionReport(10, board, state, shop);
  assert.equal(now.recommendation, expiring.adId);
  assert.equal(now.alternatives[0]?.id, expiring.adId);
  assert.equal(now.purchaseAdvice.recommendedItemId, undefined);
  assert.deepEqual(selectAutoplayAction(now, board, shop)?.actionType, 'solve');

  const afterSolve = createTaskDecisionReport(11, otherTasks, state, shop);
  assert.equal(afterSolve.purchaseAdvice.recommendedItemId, wings.id);
  assert.deepEqual(selectAutoplayAction(afterSolve, otherTasks, shop)?.actionType, 'buy');
});

void test('shopping proceeds when an expiring task survives the purchase turn', () => {
  const expiring = task(
    'soon',
    'Escort someone to pasture in Darkmountain where they can meet with their long lost dog',
    'Walk in the park',
    43,
    2,
  );
  const decision = createTaskDecisionReport(10, [expiring], { lives: 3, gold: 250, level: 2 }, [
    healing,
    wings,
  ]);

  assert.equal(decision.purchaseAdvice.recommendedItemId, wings.id);
});

void test('two rewarding two-turn jobs can outrank a small one-turn job', () => {
  const small = task('small', 'Small errand', 'Walk in the park', 1, 1);
  const highA = task('high-a', 'Rewarding errand A', 'Walk in the park', 40, 2);
  const highB = task('high-b', 'Rewarding errand B', 'Walk in the park', 35, 2);
  const later = task('later', 'Later errand', 'Walk in the park', 70, 7);
  const decision = createTaskDecisionReport(4, [small, highA, highB, later]);

  assert.deepEqual(
    decision.alternatives.slice(0, 3).map((alternative) => alternative.id),
    [highA.adId, highB.adId, later.adId],
  );
});

void test('a Book of Tricks purchase keeps its intended agreement job first for one board', () => {
  const beforeAgreement = task(
    '6iqgTUVQ',
    'Help Urijah Hulduson to reach an agreement with Aeneas Brigham on the matters of disputed turnips',
    'Walk in the park',
    12,
    2,
  );
  const beforePurchase = createTaskDecisionReport(12, [
    beforeAgreement,
    task('UHhu6kFS', 'Another job', 'Quite likely', 12, 2),
    task('dhD0Y6XG', 'Another job', 'Piece of cake', 41, 5),
    task('Rz4Jr5vs', 'Another job', 'Piece of cake', 40, 6),
  ]);
  assert.equal(beforePurchase.recommendation, beforeAgreement.adId);

  const agreement = task(
    '6iqgTUVQ',
    'Help Urijah Hulduson to reach an agreement with Aeneas Brigham on the matters of disputed turnips',
    'Walk in the park',
    12,
    1,
  );
  const tasks = [
    agreement,
    task('better', 'Better job', 'Sure thing', 100, 1),
    task('later', 'Later job', 'Piece of cake', 40, 6),
  ];
  const state = { lives: 3, gold: 150, level: 3 };
  const usual = createTaskDecisionReport(13, tasks, state, [healing, book]);
  assert.equal(usual.recommendation, 'better');

  const afterPurchase = createTaskDecisionReport(13, tasks, state, [healing, book], {
    lastActionType: 'buy',
    followThroughTaskId: agreement.adId,
    followThroughItemId: book.id,
  });
  assert.equal(afterPurchase.recommendation, agreement.adId);
  assert.match(
    afterPurchase.alternatives[0]?.reason ?? '',
    /You probably bought Book of Tricks for this job\. Try solving it now\./,
  );
  assert.equal(afterPurchase.purchaseAdvice.recommendedItemId, undefined);

  const afterNextAction = createTaskDecisionReport(14, tasks, state, [healing, book], {
    lastActionType: 'solve',
    followThroughTaskId: agreement.adId,
    followThroughItemId: book.id,
  });
  assert.equal(afterNextAction.recommendation, usual.recommendation);
});

void test('at two lives, an easy one-turn job can precede healing', () => {
  const urgent = task('urgent', 'Urgent job', 'Piece of cake', 43, 1);
  const shop = [healing, wings];
  const decision = createTaskDecisionReport(5, [urgent], { lives: 2, gold: 250, level: 3 }, shop);

  assert.equal(decision.recommendation, urgent.adId);
  assert.equal(decision.purchaseAdvice.recommendedItemId, undefined);
  assert.equal(selectAutoplayAction(decision, [urgent], shop)?.actionType, 'solve');
});

void test('a healing purchase does not prevent training on the next turn', () => {
  const tasks = [
    task(
      'peninsula',
      'Help defending peninsula in Doveville from the intruders',
      'Piece of cake',
      174,
      3,
    ),
    task(
      'grassland',
      'Help defending grassland in Dornwhyte from the intruders',
      'Piece of cake',
      194,
      4,
    ),
  ];
  const shop = [
    healing,
    { id: 'cs', name: 'Claw Sharpening', cost: 100, raw: {} },
    { id: 'wax', name: 'Copper Plating', cost: 100, raw: {} },
  ];
  const decision = createTaskDecisionReport(46, tasks, { lives: 3, gold: 770, level: 11 }, shop, {
    lastActionType: 'buy',
    lastActionItemId: healing.id,
  });

  assert.ok(decision.purchaseAdvice.recommendedItemId);
  assert.equal(selectAutoplayAction(decision, tasks, shop)?.actionType, 'buy');
});

void test('an affordable expensive item is compared using its own label observations', () => {
  const defend = task(
    'defend',
    'Help defending stronghold in Redgarden from the intruders',
    'Gamble',
    217,
    5,
  );
  const iron = { id: 'iron', name: 'Iron Plating', cost: 300, raw: {} };
  const copper = { id: 'wax', name: 'Copper Plating', cost: 100, raw: {} };
  const shop = [healing, copper, iron];
  const history = {
    lastActionType: 'solve',
  };
  const wealthy = createTaskDecisionReport(
    72,
    [defend],
    { lives: 3, gold: 1067, level: 22 },
    shop,
    history,
  );
  assert.equal(wealthy.purchaseAdvice.recommendedItemId, iron.id);

  const tighter = createTaskDecisionReport(
    72,
    [defend],
    { lives: 3, gold: 450, level: 22 },
    shop,
    history,
  );
  assert.equal(tighter.purchaseAdvice.recommendedItemId, iron.id);

  const justBought = createTaskDecisionReport(
    73,
    [defend],
    { lives: 3, gold: 767, level: 24 },
    shop,
    { lastActionType: 'buy', lastActionItemId: iron.id },
  );
  assert.equal(justBought.purchaseAdvice.recommendedItemId, undefined);
});

void test('shop advice scores label improvements across the whole board', () => {
  const next = task(
    'create',
    'Create an advertisement campaign for a pottery business',
    'Piece of cake',
    80,
    3,
  );
  const later = [
    task(
      'defend-a',
      'Help defending stronghold in Redgarden from the intruders',
      'Piece of cake',
      200,
      7,
    ),
    task(
      'defend-b',
      'Help defending keep in Redgarden from the intruders',
      'Piece of cake',
      190,
      8,
    ),
    task(
      'defend-c',
      'Help defending fort in Redgarden from the intruders',
      'Piece of cake',
      180,
      9,
    ),
  ];
  const copper = { id: 'wax', name: 'Copper Plating', cost: 100, raw: {} };
  const shop = [healing, book, copper];
  const decision = createTaskDecisionReport(
    10,
    [next, ...later],
    { lives: 3, gold: 250, level: 2 },
    shop,
  );

  assert.equal(decision.recommendation, next.adId);
  assert.equal(decision.purchaseAdvice.recommendedItemId, copper.id);
});

void test('without label observations, level gain breaks ties between affordable upgrades', () => {
  const job = task('errand', 'Deliver a sealed letter', 'Piece of cake', 50, 5);
  const iron = { id: 'iron', name: 'Iron Plating', cost: 300, raw: {} };
  const decision = createTaskDecisionReport(3, [job], { lives: 3, gold: 1067, level: 22 }, [
    healing,
    iron,
    book,
  ]);

  assert.equal(decision.purchaseAdvice.recommendedItemId, iron.id);
});

void test('an unaffordable upgrade tooltip says how much more gold is needed', () => {
  const job = task(
    'defend',
    'Help defending stronghold in Redgarden from the intruders',
    'Piece of cake',
    80,
    5,
  );
  const iron = { id: 'iron', name: 'Iron Plating', cost: 300, raw: {} };
  const decision = createTaskDecisionReport(4, [job], { lives: 3, gold: 80, level: 2 }, [
    healing,
    iron,
  ]);
  const advice = decision.purchaseAdvice.alternatives.find((item) => item.id === iron.id);

  assert.ok(advice);
  assert.equal(advice.action, 'save');
  assert.equal(advice.reason, 'You need 220 more gold to buy this.');
});
