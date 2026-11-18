import type { DecisionReport } from '@mugloar/contracts';

import type { NormalizedShopItem, UpstreamMessage } from '../upstream/types.js';

export const DEFAULT_AUTOPLAY_LIMITS = {
  actionCap: 100,
  pacingMs: 1_500,
  timeCapMs: 10 * 60 * 1_000,
} as const;

export type AutoplaySelection =
  | { readonly actionType: 'buy'; readonly item: NormalizedShopItem; readonly reason: string }
  | { readonly actionType: 'reputation'; readonly reason: string }
  | { readonly actionType: 'solve'; readonly task: UpstreamMessage; readonly reason: string };

export function selectAutoplayAction(
  decision: DecisionReport,
  tasks: readonly UpstreamMessage[],
  shop: readonly NormalizedShopItem[],
): AutoplaySelection | null {
  const purchaseId = decision.purchaseAdvice.recommendedItemId;
  if (decision.reputationCheckRequired)
    return {
      actionType: 'reputation',
      reason: decision.reputationCheckReason ?? 'Check reputation before choosing a task.',
    };

  const purchase = decision.purchaseAdvice.alternatives.find((item) => item.id === purchaseId);
  const shopItem = shop.find((item) => item.id === purchaseId);
  if (purchase?.action === 'buy' && shopItem !== undefined)
    return { actionType: 'buy', item: shopItem, reason: purchase.reason };

  const taskId = decision.recommendation;
  const task = tasks.find((item) => item.adId === taskId);
  if (task === undefined) return null;

  const reason =
    decision.alternatives.find((item) => item.id === taskId)?.reason ??
    'Shared baseline task recommendation.';

  return { actionType: 'solve', task, reason };
}

export type AutoplayStepResult = 'acted' | 'finished' | 'no-supported-action' | 'stopped';
export type AutoplayStopReason =
  'stopped' | 'action-cap' | 'time-cap' | 'finished' | 'no-supported-action';

export interface AutoplayLoopOptions {
  readonly actionCap?: number;
  readonly pacingMs?: number;
  readonly timeCapMs?: number;
  readonly startedAt?: number;
  readonly now?: () => number;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly shouldStop?: () => boolean;
  readonly isFinished?: () => boolean;
  readonly step: (sequence: number) => Promise<AutoplayStepResult>;
}

export interface AutoplayLoopResult {
  readonly actions: number;
  readonly reason: AutoplayStopReason;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Check limits on both sides of pacing so a pause or elapsed budget cannot start another action.
export async function runAutoplayLoop(options: AutoplayLoopOptions): Promise<AutoplayLoopResult> {
  const actionCap = options.actionCap ?? DEFAULT_AUTOPLAY_LIMITS.actionCap;
  const pacingMs = options.pacingMs ?? DEFAULT_AUTOPLAY_LIMITS.pacingMs;
  const timeCapMs = options.timeCapMs ?? DEFAULT_AUTOPLAY_LIMITS.timeCapMs;
  const now = options.now ?? Date.now;
  const startedAt = options.startedAt ?? now();
  const waitForTurn = options.wait ?? wait;
  let actions = 0;

  while (true) {
    if (options.shouldStop?.()) return { actions, reason: 'stopped' };

    if (options.isFinished?.()) return { actions, reason: 'finished' };

    if (actions >= actionCap) return { actions, reason: 'action-cap' };

    if (now() - startedAt >= timeCapMs) return { actions, reason: 'time-cap' };

    await waitForTurn(pacingMs);
    if (options.shouldStop?.()) return { actions, reason: 'stopped' };

    if (now() - startedAt >= timeCapMs) return { actions, reason: 'time-cap' };

    const result = await options.step(actions + 1);
    if (result === 'stopped') return { actions, reason: 'stopped' };

    if (result === 'no-supported-action') return { actions, reason: 'no-supported-action' };

    actions += 1;
    if (result === 'finished') return { actions, reason: 'finished' };
  }
}
