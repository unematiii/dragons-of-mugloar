import type { ApiError, DecisionReport, GameStatus, GameStats } from '@mugloar/contracts';

export type { ApiError, DecisionReport, GameStatus, GameStats };
export type PurchaseAdvice = DecisionReport['purchaseAdvice'];

export interface Reputation {
  readonly people: number;
  readonly state: number;
  readonly underworld: number;
  readonly observedTurn: number | null;
}

export interface Game extends GameStats {
  readonly id: string;
  readonly status: GameStatus;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Task {
  readonly adId: string;
  readonly message: string;
  readonly encoding: 'plain' | 'base64-mode-1' | 'rot13-mode-2' | 'unsupported';
  readonly reward: number;
  readonly expiresIn: number;
  readonly probability: string;
  readonly unsupportedDetails: boolean;
  readonly labelChanges: readonly TaskLabelChange[];
}

export interface TaskLabelChange {
  readonly fromTurn: number;
  readonly toTurn: number;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly fromRank: number | null;
  readonly toRank: number | null;
  /** Easy-to-hard label rank difference; null means one label is unclassified. */
  readonly delta: number | null;
}

export interface ShopItem {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly affordable: boolean;
}

export interface GameBoard {
  readonly revision: number;
  readonly ads: readonly Task[];
  readonly decision: DecisionReport;
}

export interface GameAction {
  readonly actionType: string;
  readonly status: string;
  readonly message: string | null;
  readonly createdAt: string;
  readonly turn?: number;
  readonly targetName?: string;
  readonly targetDescription?: string;
  readonly reputation?: Reputation;
}
