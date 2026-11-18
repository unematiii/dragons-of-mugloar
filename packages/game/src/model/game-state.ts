import type { GameStatus } from '@mugloar/contracts';

import type { NormalizedAction } from '../upstream/types.js';

export interface GameState {
  readonly lives: number;
  readonly gold: number;
  readonly level: number;
  readonly score: number;
  readonly turn: number;
}

export interface GameSnapshot {
  readonly revision: number;
  readonly status: GameStatus;
  readonly state: GameState;
}

export function mergeActionState(current: GameState, action: NormalizedAction): GameState {
  return {
    lives: action.lives ?? current.lives,
    gold: action.gold ?? current.gold,
    level: action.level ?? current.level,
    score: action.score ?? current.score,
    // Solve and purchase consume one turn; infer this only when an action response omits it.
    turn: action.turn ?? current.turn + 1,
  };
}

export function isGameOver(state: GameState): boolean {
  return state.lives <= 0;
}

export function updateGameStatus(status: GameStatus, state: GameState): GameStatus {
  return isGameOver(state) ? 'finished' : status;
}
