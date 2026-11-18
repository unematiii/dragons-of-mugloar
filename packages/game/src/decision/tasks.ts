import type { DecisionReport } from '@mugloar/contracts';

import { createPurchaseAdvice } from './purchases.js';
import {
  assessReputation,
  partitionTasksByReputationRisk,
  taskRisksReputation,
} from './reputation.js';
import type { ReputationDecisionContext } from './reputation.js';
import { SHOP_ITEM_IDS } from './shop-item-ids.js';
import {
  compareIndividualTasks,
  hasUnknownLabel,
  isDiamondTask,
  planVisibleTasks,
} from './task-schedule.js';
import type { GameState } from '../model/game-state.js';
import type { NormalizedShopItem, UpstreamMessage } from '../upstream/types.js';

export interface DecisionContext {
  readonly lastActionType?: string;
  readonly lastActionItemId?: string;
  readonly followThroughTaskId?: string;
  readonly followThroughItemId?: string;
}

export function isTaskSupported(task: UpstreamMessage): boolean {
  return task.encoding !== 'unsupported' && task.decoding !== 'failed';
}

export function createTaskDecisionReport(
  revision: number,
  tasks: readonly UpstreamMessage[],
  state?: Pick<GameState, 'lives' | 'gold' | 'level'>,
  shop: readonly NormalizedShopItem[] = [],
  history: DecisionContext = {},
  reputationContext?: ReputationDecisionContext,
): DecisionReport {
  const supported = tasks.filter(isTaskSupported);
  const reputation =
    reputationContext === undefined ? undefined : assessReputation(reputationContext);
  const reputationRequiresCheck = reputation?.checkRequired ?? false;
  const checkedReputation = reputation?.values ?? null;
  const plan = planVisibleTasks(supported);
  const plannedIds = new Set(plan.map((task) => task.adId));
  const ordinaryRanking = [
    ...plan,
    ...supported.filter((task) => !plannedIds.has(task.adId)).sort(compareIndividualTasks),
  ];
  let reputationRanked = ordinaryRanking;
  if (checkedReputation !== null) {
    const [saferTasks, riskierTasks] = partitionTasksByReputationRisk(
      ordinaryRanking,
      checkedReputation,
    );
    reputationRanked = [...saferTasks, ...riskierTasks];
  }

  // A recommended purchase used a turn to train for a specific job. For exactly the
  // next board, keep that job first if it survived; then normal ranking resumes.
  const followThroughTask =
    history.lastActionType === 'buy'
      ? supported.find(
          (task) =>
            task.adId === history.followThroughTaskId &&
            task.expiresIn > 0 &&
            !isDiamondTask(task) &&
            (checkedReputation === null ||
              !taskRisksReputation(task, checkedReputation)),
        )
      : undefined;
  const purchasedItemName = shop.find((item) => item.id === history.followThroughItemId)?.name;
  const purchaseAdvice = createPurchaseAdvice(
    state ?? { lives: 3, gold: 0, level: 0 },
    shop,
    supported,
    plan,
    history,
  );
  // Treat a required reputation reading as actionable only after a priority heal.
  const reputationCheckRequired =
    reputationRequiresCheck && purchaseAdvice.recommendedItemId !== SHOP_ITEM_IDS.healingPotion;
  const ranked = reputationCheckRequired
    ? []
    : followThroughTask === undefined
      ? reputationRanked
      : [
          followThroughTask,
          ...reputationRanked.filter((task) => task.adId !== followThroughTask.adId),
        ];
  const safePurchaseAdvice =
    reputationCheckRequired && purchaseAdvice.recommendedItemId !== SHOP_ITEM_IDS.healingPotion
      ? {
          alternatives: purchaseAdvice.alternatives.map((alternative) => ({
            ...alternative,
            action: 'skip' as const,
            reason: 'Check reputation before choosing another action.',
          })),
        }
      : purchaseAdvice;

  return {
    revision,
    reputationCheckRequired,
    ...(reputationCheckRequired && reputation?.reason !== undefined
      ? { reputationCheckReason: reputation.reason }
      : {}),
    ...(ranked[0] === undefined ? {} : { recommendation: ranked[0].adId }),
    alternatives: ranked.map((task, index) => {
      const isDiamond = isDiamondTask(task);
      const isUnknown = hasUnknownLabel(task);
      const isReputationRisk =
        checkedReputation !== null && taskRisksReputation(task, checkedReputation);
      const reason =
        task.adId === followThroughTask?.adId
          ? `Rank 1 of ${ranked.length}. You probably bought ${purchasedItemName ?? 'that upgrade'} for this job. Try solving it now.`
          : isDiamond
            ? `Rank ${index + 1} of ${ranked.length}. This diamond task is likely a trap. Avoid it when possible.`
            : isReputationRisk
              ? `Rank ${index + 1} of ${ranked.length}. This task can lower government reputation toward the Steal-heavy cutoff, so safer options come first.`
              : isUnknown
                ? `Rank ${index + 1} of ${ranked.length}. “${task.probability}” is an unfamiliar difficulty word, so this job comes after ones we can compare.`
                : plannedIds.has(task.adId)
                  ? `Rank ${index + 1} of ${ranked.length}. This job fits our next few turns and helps us try for more points before jobs disappear.`
                  : `Rank ${index + 1} of ${ranked.length}. We compare the difficulty words, turns left, and points offered.`;

      return {
        id: task.adId,
        // Retained for the shared contract; the interface displays the rank, not this number.
        score: ranked.length - index,
        reason,
      };
    }),
    purchaseAdvice: safePurchaseAdvice,
  };
}
