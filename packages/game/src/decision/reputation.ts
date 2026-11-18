import type { UpstreamMessage } from '../upstream/types.js';

export interface ReputationValues {
  readonly people: number;
  readonly state: number;
  readonly underworld: number;
}

export interface ReputationReading {
  readonly values: ReputationValues;
  readonly observedTurn: number | null;
}

export function getInitialReputationReading(observedTurn: number): ReputationReading {
  return {
    values: { people: 0, state: 0, underworld: 0 },
    observedTurn,
  };
}

export interface ReputationActionObservation {
  readonly actionType: string;
  readonly status: string;
  readonly turn: number | null;
  readonly taskMessage?: string;
}

export interface ReputationDecisionContext {
  readonly reading: ReputationReading | null;
  readonly currentTurn: number;
  readonly actions: readonly ReputationActionObservation[];
}

export interface ReputationAssessment {
  readonly values: ReputationValues | null;
  readonly checkRequired: boolean;
  readonly reason?: string;
}

interface ReputationDelta {
  readonly people: number;
  readonly state: number;
  readonly underworld: number;
}

// Average or fixed changes observed in paired readings. A missing task class means its
// reputation effect has not been measured well enough to project from an old reading.
const SUCCESS_DELTAS: Readonly<Record<string, ReputationDelta>> = {
  Help: { people: 0.221, state: 0, underworld: 0 },
  Escort: { people: 0.1, state: 0, underworld: 0 },
  Create: { people: 1, state: 0, underworld: 0 },
  Steal: { people: 1, state: -2, underworld: 0 },
  Investigate: { people: -0.1, state: 1, underworld: 0 },
  Infiltrate: { people: 0, state: 2, underworld: -1 },
  Rescue: { people: 0.1, state: 0, underworld: 0 },
};
const FAILED_DELTA: ReputationDelta = { people: 0, state: 0, underworld: 0 };

type ReputationFaction = keyof ReputationValues;
type RiskDirection = 'lower' | 'higher';

interface FactionRiskRule {
  readonly faction: ReputationFaction;
  readonly threshold: number;
  readonly direction: RiskDirection;
}

const STEAL_HEAVY_STATE_THRESHOLD = -10;
const FACTION_RISK_RULES: readonly FactionRiskRule[] = [
  { faction: 'state', threshold: STEAL_HEAVY_STATE_THRESHOLD, direction: 'lower' },
];

function taskClass(message: string): string | undefined {
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

function deltaForTask(message: string, status: string): ReputationDelta | null {
  if (status === 'failed') return FAILED_DELTA;

  if (status !== 'completed') return null;

  if (/^Steal\s+super awesome diamond\b/i.test(message)) return null;

  const category = taskClass(message);

  return category === undefined ? null : (SUCCESS_DELTAS[category] ?? null);
}

function isOnRiskSide(value: number, threshold: number, direction: RiskDirection): boolean {
  return direction === 'lower' ? value <= threshold : value >= threshold;
}

export function taskRisksReputation(task: UpstreamMessage, values: ReputationValues): boolean {
  const delta = deltaForTask(task.message, 'completed');
  if (delta === null) return false;

  return FACTION_RISK_RULES.some(({ faction, threshold, direction }) => {
    const factionDelta = delta[faction];
    const movesTowardRisk = direction === 'lower' ? factionDelta < 0 : factionDelta > 0;

    return (
      movesTowardRisk &&
      (isOnRiskSide(values[faction], threshold, direction) ||
        isOnRiskSide(values[faction] + factionDelta, threshold, direction))
    );
  });
}

export function partitionTasksByReputationRisk(
  tasks: readonly UpstreamMessage[],
  values: ReputationValues,
): [saferTasks: UpstreamMessage[], riskierTasks: UpstreamMessage[]] {
  const saferTasks: UpstreamMessage[] = [];
  const riskierTasks: UpstreamMessage[] = [];

  for (const task of tasks) {
    (taskRisksReputation(task, values) ? riskierTasks : saferTasks).push(task);
  }

  return [saferTasks, riskierTasks];
}

function factionRecheckReason(
  faction: keyof ReputationValues,
  value: number,
  delta: number | null,
): string | undefined {
  switch (faction) {
    case 'state':
      if (
        delta !== null &&
        delta < 0 &&
        value + delta <= STEAL_HEAVY_STATE_THRESHOLD
      )
        return 'Your standing with the State may have changed. Check reputation again.';

      return undefined;
    case 'people':
    case 'underworld':
    default:
      return undefined;
  }
}

function applyDelta(values: ReputationValues, delta: ReputationDelta): ReputationValues {
  return {
    people: values.people + delta.people,
    state: values.state + delta.state,
    underworld: values.underworld + delta.underworld,
  };
}

export function assessReputation(context: ReputationDecisionContext): ReputationAssessment {
  const reading = context.reading;
  if (reading === null || reading.observedTurn === null)
    return {
      values: null,
      checkRequired: true,
    };

  const observedTurn = reading.observedTurn;
  if (observedTurn > context.currentTurn)
    return {
      values: null,
      checkRequired: true,
      reason: 'The reputation reading does not match the game yet. Check it again.',
    };

  let values = { ...reading.values };
  const afterReading = context.actions.filter(
    (action) => action.turn !== null && action.turn > observedTurn,
  );
  const turnsSinceReading = context.currentTurn - observedTurn;
  const recordedTurns = new Set(afterReading.map((action) => action.turn));
  for (let turn = observedTurn + 1; turn <= context.currentTurn; turn += 1) {
    if (!recordedTurns.has(turn))
      return {
        values: null,
        checkRequired: true,
        reason: 'We do not know how one of your actions changed reputation. Check it again.',
      };
  }

  if (afterReading.length < turnsSinceReading)
    return {
      values: null,
      checkRequired: true,
      reason: 'Some game history is missing, so check reputation again.',
    };

  for (const action of afterReading.sort((left, right) => (left.turn ?? 0) - (right.turn ?? 0))) {
    if (action.actionType !== 'solve') continue;

    // A failed solve has no observed reputation change, even if its task text was not saved.
    if (action.status === 'failed') continue;

    if (action.taskMessage === undefined)
      return {
        values: null,
        checkRequired: true,
        reason: 'We cannot tell what kind of task you solved. Check reputation again.',
      };

    const delta = deltaForTask(action.taskMessage, action.status);
    const stateReason = factionRecheckReason('state', values.state, delta?.state ?? null);
    if (stateReason !== undefined)
      return { values: null, checkRequired: true, reason: stateReason };

    if (delta === null) {
      continue;
    }

    values = applyDelta(values, delta);
  }

  return { values, checkRequired: false };
}
