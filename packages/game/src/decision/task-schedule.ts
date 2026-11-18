import type { UpstreamMessage } from '../upstream/types.js';

// Plan only tasks visible on this board. We cannot assume what replacement tasks will appear,
// but stopping after three visible jobs can discard a fourth urgent job that fits before them.
const EASY_LABEL_LAST_ORDER = 3;
const LARGE_REWARD_RATIO = 2;
const LARGE_REWARD_GAP = 10;
const DIAMOND_TASK = /steal\s+super\s+awesome\s+diamond\b/i;
const LABEL_ORDER: readonly RegExp[] = [
  /^sure thing$/i,
  /^piece of cake$/i,
  /^walk in the park$/i,
  /^quite likely$/i,
  /^hmmm/i,
  /^gamble$/i,
  /^risky$/i,
  /^rather detrimental$/i,
  /^playing with fire$/i,
  /^suicide mission$/i,
];

export function taskLabelOrder(task: UpstreamMessage): number {
  if (DIAMOND_TASK.test(task.message)) return LABEL_ORDER.length + 1;

  const order = getTaskLabelOrder(task.probability);

  // "Impossible" and other unknown labels have no supported place in the observed order.
  return order === null ? LABEL_ORDER.length : order - 1;
}

/** Return the observed easy-to-hard order, or null when the label is not classified. */
export function getTaskLabelOrder(label: string): number | null {
  // The upstream label is ordered after the supported recommendation labels. Keeping that
  // distinction here lets history describe changes without making the label policy-eligible.
  if (/^impossible$/i.test(label.trim())) return LABEL_ORDER.length + 1;

  const index = LABEL_ORDER.findIndex((pattern) => pattern.test(label.trim()));

  return index < 0 ? null : index + 1;
}

export function isDiamondTask(task: UpstreamMessage): boolean {
  return DIAMOND_TASK.test(task.message);
}

export function hasUnknownLabel(task: UpstreamMessage): boolean {
  return !isDiamondTask(task) && taskLabelOrder(task) === LABEL_ORDER.length;
}

export function hasEasyLabel(task: UpstreamMessage): boolean {
  return taskLabelOrder(task) <= EASY_LABEL_LAST_ORDER;
}

/**
 * Fallback order for tasks left outside the scheduled plan. A negative result puts
 * `left` first; a positive result puts `right` first. Compare difficulty wording,
 * then expiry, then reward, then ID for a stable tie-break. Each `||` uses the next
 * criterion only when the previous difference is zero. Equal tasks are not removed.
 */
export function compareIndividualTasks(left: UpstreamMessage, right: UpstreamMessage): number {
  return (
    taskLabelOrder(left) - taskLabelOrder(right) ||
    left.expiresIn - right.expiresIn ||
    right.reward - left.reward ||
    left.adId.localeCompare(right.adId)
  );
}

/**
 * Return the unsorted tasks allowed to compete in the reward-and-expiry planner.
 * Exclude diamond tasks while any other task exists. Among the remaining tasks,
 * include all four favorable labels when one is present; otherwise include the
 * best available harder label and the next harder label. Other tasks are ranked
 * later by compareIndividualTasks, not discarded from the board.
 */
function comparableTasks(tasks: readonly UpstreamMessage[]): readonly UpstreamMessage[] {
  // Preserve the known diamond trap as a last resort even when all other labels are
  // unfamiliar. A high diamond reward must never pull it into a normal task plan.
  const nonDiamond = tasks.filter((task) => !isDiamondTask(task));
  const eligible = nonDiamond.length > 0 ? nonDiamond : tasks;
  if (eligible.length === 0) return [];

  // Sure thing through Quite likely are all favorable wording. Let reward and expiry
  // decide among those four; the earlier one-step band hid valuable Quite likely jobs.
  // For harder wording, keep the original narrow band until we have a reason to widen it.
  const bestOrder = Math.min(...eligible.map((task) => taskLabelOrder(task)));
  const lastIncludedOrder =
    bestOrder <= EASY_LABEL_LAST_ORDER ? EASY_LABEL_LAST_ORDER : bestOrder + 1;

  return eligible.filter((task) => taskLabelOrder(task) <= lastIncludedOrder);
}

function hasLargeRewardLead(left: UpstreamMessage, right: UpstreamMessage): boolean {
  if (taskLabelOrder(left) > EASY_LABEL_LAST_ORDER || taskLabelOrder(right) > EASY_LABEL_LAST_ORDER)
    return false;

  const high = Math.max(left.reward, right.reward);
  const low = Math.min(left.reward, right.reward);

  // This is a conservative preference threshold, not a probability conversion.
  // A 58-point Quite likely job can beat a 1-point Piece of cake job, while a
  // tiny reward difference still leaves the easier wording ahead.
  return high - low >= LARGE_REWARD_GAP && high >= LARGE_REWARD_RATIO * low;
}

function comparePlanOrder(
  left: readonly UpstreamMessage[],
  right: readonly UpstreamMessage[],
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const leftTask = left[index];
    const rightTask = right[index];
    if (leftTask === undefined || rightTask === undefined) break;

    // For equally valuable feasible plans, try a sooner-expiring task first. If
    // deadlines tie, a much larger reward can beat a slightly easier label.
    const order =
      leftTask.expiresIn - rightTask.expiresIn ||
      (hasLargeRewardLead(leftTask, rightTask) ? rightTask.reward - leftTask.reward : 0) ||
      taskLabelOrder(leftTask) - taskLabelOrder(rightTask) ||
      rightTask.reward - leftTask.reward ||
      leftTask.adId.localeCompare(rightTask.adId);
    if (order !== 0) return order;
  }

  return 0;
}

interface Plan {
  readonly tasks: readonly UpstreamMessage[];
  readonly reward: number;
  readonly labelTotal: number;
}

function isBetterPlan(left: Plan, right: Plan): boolean {
  // More visible reward is useful only among tasks with comparable difficulty clues.
  // Equal rewards favor the longer plan and stronger labels. When two orders contain
  // the same value and labels, expiry/reward determines their actual action order.
  return (
    left.reward > right.reward ||
    (left.reward === right.reward &&
      (left.tasks.length > right.tasks.length ||
        (left.tasks.length === right.tasks.length &&
          (left.labelTotal < right.labelTotal ||
            (left.labelTotal === right.labelTotal &&
              comparePlanOrder(left.tasks, right.tasks) < 0)))))
  );
}

/**
 * Try each feasible next task, find the best full plan after that choice, then
 * compare those complete plans. The winning first task is the one that leads to
 * the best overall plan. Different branches reuse the cached result for the same
 * remaining tasks. `turnsSpentFirst` models an action such as shopping before
 * solving. Replan after each real action because replacement tasks are unknown.
 */
export function planVisibleTasks(
  tasks: readonly UpstreamMessage[],
  turnsSpentFirst = 0,
): readonly UpstreamMessage[] {
  const choices = comparableTasks(tasks);
  const memo = new Map<string, Plan>();

  function bestFrom(remaining: readonly UpstreamMessage[]): Plan {
    // Different task orders can reach the same remaining set. Every path to that set
    // has used the same number of turns, so its best tail can be calculated once and
    // reused. The cache stores the best suffix for a set, not a full permutation.
    const key = remaining.map((task) => task.adId).join('|');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const turnsUsed = choices.length - remaining.length;
    // The empty plan is the base case when no remaining task can be reached in time.
    let best: Plan = { tasks: [], reward: 0, labelTotal: 0 };
    for (const task of remaining) {
      // Each earlier action uses one turn. Schedule this task only while its
      // listed expiry is still positive when we reach it.
      if (task.expiresIn <= turnsSpentFirst + turnsUsed) continue;

      // Try this task as the next move. The recursive call finds the best complete
      // continuation after it; only then do we compare this branch with the others.
      const tail = bestFrom(remaining.filter((candidate) => candidate.adId !== task.adId));
      const candidate: Plan = {
        tasks: [task, ...tail.tasks],
        reward: task.reward + tail.reward,
        labelTotal: taskLabelOrder(task) + tail.labelTotal,
      };
      if (isBetterPlan(candidate, best)) best = candidate;
    }

    memo.set(key, best);

    return best;
  }

  return bestFrom(choices).tasks;
}

/**
 * `tasks` is the current set of supported board tasks, used to plan again after
 * spending one turn in the shop. `before` is the already-computed, ordered plan
 * for those same tasks without shopping; its order comes from our planner, not
 * from the upstream board.
 */
export function purchaseWouldLoseValuableTask(
  tasks: readonly UpstreamMessage[],
  before: readonly UpstreamMessage[],
): boolean {
  // Only a near-term task can trigger this shop deferral rule. When neither of
  // the first two planned tasks has at most two turns left, shopping cannot
  // displace a task that this rule protects, so skip the second planning search.
  const urgent = before.slice(0, 2).filter((task) => task.expiresIn <= 2);
  if (urgent.length === 0) return false;

  const after = planVisibleTasks(tasks, 1);
  const afterIds = new Set(after.map((task) => task.adId));

  // Shopping is a training action, so do not postpone it merely because some task
  // much later in the visible plan might eventually be displaced. Defer only when
  // the shop turn breaks one of the first two planned tasks with at most two turns
  // left. This catches an expiry-1 job and the second job in a 2/2 deadline pair.
  return urgent.some((task) => !afterIds.has(task.adId));
}
