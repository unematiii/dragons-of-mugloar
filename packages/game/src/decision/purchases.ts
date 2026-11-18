import type { DecisionReport } from '@mugloar/contracts';

import { SHOP_ITEM_IDS } from './shop-item-ids.js';
import { purchaseWouldLoseValuableTask, hasEasyLabel } from './task-schedule.js';
import type { DecisionContext } from './tasks.js';
import type { GameState } from '../model/game-state.js';
import type { NormalizedShopItem, UpstreamMessage } from '../upstream/types.js';

const FALLBACK_HEALING_COST = 50;

// Saved shop and purchase records show the level gain for every upgrade item.
// Use it only to break ties between equal label scores; it is a separate benefit.
const UPGRADE_LEVEL_GAIN: Readonly<Record<string, number>> = {
  [SHOP_ITEM_IDS.clawSharpening]: 1,
  [SHOP_ITEM_IDS.gasoline]: 1,
  [SHOP_ITEM_IDS.copperPlating]: 1,
  [SHOP_ITEM_IDS.bookOfTricks]: 1,
  [SHOP_ITEM_IDS.strongerWings]: 1,
  [SHOP_ITEM_IDS.clawHoning]: 2,
  [SHOP_ITEM_IDS.ironPlating]: 2,
  [SHOP_ITEM_IDS.bookOfMegatricks]: 2,
  [SHOP_ITEM_IDS.rocketFuel]: 2,
  [SHOP_ITEM_IDS.awesomeWings]: 2,
};

interface UpgradeChoice {
  readonly item: NormalizedShopItem;
  readonly levelGain: number;
  readonly labelScore: number;
}

type TaskCategory =
  | 'Create'
  | 'Defend'
  | 'Escort'
  | 'Help'
  | 'Infiltrate'
  | 'Investigate'
  | 'Kill'
  | 'Rescue'
  | 'Steal';
type LabelCounts = readonly [improved: number, matched: number];

// Collected label-transition counts, stored as [improved labels, matched labels].
// Each purchase attempt compares the full board before and after buying, so its
// observed improvements can contribute counts to several task classes.
const ITEM_CATEGORY_LABEL_COUNTS: Readonly<
  Record<string, Partial<Record<TaskCategory, LabelCounts>>>
> = {
  cs: {
    Create: [1, 9],
    Defend: [4, 49],
    Escort: [1, 7],
    Help: [1, 13],
    Infiltrate: [1, 3],
    Investigate: [2, 4],
    Kill: [0, 1],
    Rescue: [6, 27],
    Steal: [1, 19],
  },
  gas: {
    Create: [2, 3],
    Defend: [4, 21],
    Escort: [3, 7],
    Help: [1, 14],
    Infiltrate: [0, 4],
    Investigate: [0, 3],
    Kill: [0, 2],
    Rescue: [2, 9],
    Steal: [1, 14],
  },
  wax: {
    Create: [3, 4],
    Defend: [8, 55],
    Escort: [1, 5],
    Help: [0, 10],
    Investigate: [2, 6],
    Rescue: [1, 12],
    Steal: [0, 64],
  },
  tricks: {
    Create: [6, 43],
    Defend: [2, 21],
    Escort: [3, 14],
    Help: [8, 39],
    Infiltrate: [0, 3],
    Investigate: [0, 3],
    Kill: [0, 1],
    Rescue: [1, 7],
    Steal: [2, 30],
  },
  wingpot: {
    Create: [2, 12],
    Defend: [1, 31],
    Escort: [1, 10],
    Help: [1, 16],
    Infiltrate: [1, 7],
    Investigate: [0, 2],
    Rescue: [1, 12],
    Steal: [1, 21],
  },
  ch: { Defend: [9, 36] },
  rf: { Defend: [5, 21], Steal: [0, 14] },
  iron: {
    Defend: [14, 75],
    Infiltrate: [0, 2],
    Investigate: [0, 1],
    Rescue: [0, 2],
    Steal: [0, 29],
  },
  mtrix: {
    Create: [1, 1],
    Defend: [1, 22],
    Escort: [0, 3],
    Help: [2, 2],
    Infiltrate: [0, 2],
    Investigate: [1, 1],
    Rescue: [2, 3],
    Steal: [0, 11],
  },
  wingpotmax: { Defend: [10, 18], Steal: [0, 18] },
};

function taskCategory(message: string): TaskCategory | undefined {
  if (/^Help defending\b/i.test(message)) return 'Defend';

  if (/^Create\b/i.test(message)) return 'Create';

  if (/^Escort\b/i.test(message)) return 'Escort';

  if (/^Help\b/i.test(message)) return 'Help';

  if (/^Infiltrate\b/i.test(message)) return 'Infiltrate';

  if (/^Investigate\b/i.test(message)) return 'Investigate';

  if (/^Kill\b/i.test(message)) return 'Kill';

  if (/^Rescue\b/i.test(message)) return 'Rescue';

  if (/^Steal\b/i.test(message)) return 'Steal';

  return undefined;
}

function itemCategoryImprovementRate(itemId: string, category: TaskCategory): number | undefined {
  const counts = ITEM_CATEGORY_LABEL_COUNTS[itemId]?.[category];

  // Use only this item's observed transitions. No row means unknown; a recorded
  // zero-improvement row contributes zero rather than borrowing another item's rate.
  return counts === undefined ? undefined : counts[0] / counts[1];
}

function scoreBoardLabels(itemId: string, tasks: readonly UpstreamMessage[]): number {
  return tasks.reduce((score, task) => {
    const category = taskCategory(task.message);
    if (category === undefined) return score;

    // Every visible task counts once, including the current suggestion. A missing
    // item/class observation adds no estimate; it is not treated as a measured zero.
    const observedRate = itemCategoryImprovementRate(itemId, category);

    return score + (observedRate ?? 0);
  }, 0);
}

function chooseUpgrade(
  items: readonly NormalizedShopItem[],
  tasks: readonly UpstreamMessage[],
  spendableGold: number,
): UpgradeChoice | null {
  // Compare every exact item with enough gold left for the healing reserve. Price tiers
  // are not paired or preselected: label evidence ranks the items, then observed levels
  // gained breaks a tie in favor of more training per turn.
  const candidates = items.flatMap((item) => {
    const levelGain = UPGRADE_LEVEL_GAIN[item.id];
    if (
      item.id === SHOP_ITEM_IDS.healingPotion ||
      levelGain === undefined ||
      item.cost > spendableGold
    )
      return [];

    return [{ item, levelGain, labelScore: scoreBoardLabels(item.id, tasks) }];
  });

  return (
    candidates.sort(
      (left, right) =>
        right.labelScore - left.labelScore ||
        right.levelGain - left.levelGain ||
        left.item.cost - right.item.cost ||
        left.item.id.localeCompare(right.item.id),
    )[0] ?? null
  );
}

export function createPurchaseAdvice(
  state: Pick<GameState, 'lives' | 'gold'>,
  items: readonly NormalizedShopItem[],
  tasks: readonly UpstreamMessage[],
  plannedTasks: readonly UpstreamMessage[],
  history: DecisionContext,
): DecisionReport['purchaseAdvice'] {
  const healingItem = items.find((item) => item.id === SHOP_ITEM_IDS.healingPotion);
  const healingReserve = healingItem?.cost ?? FALLBACK_HEALING_COST;
  const needsHealing = state.lives <= 2;
  const taskWouldBeLost = purchaseWouldLoseValuableTask(tasks, plannedTasks);
  const nextTask = plannedTasks[0];
  // At two lives, a relatively easy valuable task can be taken first and healing
  // reconsidered immediately afterward. At one life, the potion still comes first:
  // a failed solve there would end the game before the dragon could heal.
  const healingCanWait =
    state.lives === 2 && taskWouldBeLost && nextTask !== undefined && hasEasyLabel(nextTask);
  const healNow =
    needsHealing && !healingCanWait && healingItem !== undefined && state.gold >= healingItem.cost;
  // Healing restores a life but does not train the dragon. A completed healing buy
  // therefore does not spend the one upgrade choice before returning to tasks.
  const justBoughtUpgrade =
    history.lastActionType === 'buy' && history.lastActionItemId !== SHOP_ITEM_IDS.healingPotion;
  const waitForTask = justBoughtUpgrade || taskWouldBeLost;
  const upgrade =
    healNow || needsHealing || waitForTask
      ? null
      : chooseUpgrade(items, tasks, state.gold - healingReserve);
  const recommendedItemId = healNow ? healingItem.id : upgrade?.item.id;

  const alternatives = items
    .map((item) => {
      let action: 'buy' | 'save' | 'skip' = 'skip';
      let reason: string;

      if (item.id === SHOP_ITEM_IDS.healingPotion && healNow) {
        action = 'buy';
        reason = `You have ${state.lives} lives left. This potion may give you one more life, so we suggest buying it now.`;
      } else if (item.id === SHOP_ITEM_IDS.healingPotion && healingCanWait) {
        reason = `You have two lives left, but a valuable job may disappear if we shop now. Try that job, then check whether to heal.`;
      } else if (item.id === SHOP_ITEM_IDS.healingPotion && needsHealing) {
        action = 'save';
        reason = `You have ${state.lives} lives left. This potion costs ${item.cost} gold. Get enough gold before buying an upgrade.`;
      } else if (item.id === SHOP_ITEM_IDS.healingPotion) {
        reason = `Keep ${healingReserve} gold ready in case you need healing later.`;
      } else if (state.gold < item.cost) {
        action = 'save';
        reason = `You need ${item.cost - state.gold} more gold to buy this.`;
      } else if (item.id === upgrade?.item.id) {
        action = 'buy';
        reason = `This upgrade has the strongest recorded board-wide label improvement chance. It trains your dragon by ${upgrade.levelGain} ${upgrade.levelGain === 1 ? 'level' : 'levels'} and leaves ${healingReserve} gold for healing.`;
      } else if (healingCanWait) {
        reason = 'A valuable job may disappear if we spend a turn shopping. Try it first.';
      } else if (needsHealing) {
        reason = 'Healing comes first when you have two lives or fewer.';
      } else if (taskWouldBeLost) {
        reason = 'A valuable job may disappear if we spend a turn shopping. Try a job first.';
      } else if (justBoughtUpgrade) {
        reason = 'We just bought an item. Try a job before buying another upgrade.';
      } else if (state.gold < item.cost + healingReserve) {
        action = 'save';
        reason = `Save until you can buy this and still keep ${healingReserve} gold for healing.`;
      } else {
        reason =
          'Another affordable upgrade has a stronger recorded board-wide label improvement chance.';
      }

      return { id: item.id, score: 0, action, reason };
    })
    .sort((left, right) => {
      const priority = (action: 'buy' | 'save' | 'skip') =>
        action === 'buy' ? 0 : action === 'save' ? 1 : 2;

      return priority(left.action) - priority(right.action) || left.id.localeCompare(right.id);
    })
    .map((alternative, index) => ({ ...alternative, score: -index }));

  return {
    ...(recommendedItemId === undefined ? {} : { recommendedItemId }),
    alternatives,
  };
}
