export type GameErrorCode =
  | 'COMMAND_UNCERTAIN'
  | 'DUPLICATE_COMMAND'
  | 'GAME_NOT_ACTIVE'
  | 'AUTOPLAY_LIMIT_REACHED'
  | 'GAME_NOT_FOUND'
  | 'UPSTREAM_GAME_NOT_FOUND'
  | 'INVALID_COMMAND'
  | 'SESSION_REQUIRED'
  | 'STALE_REVISION';

export class GameError extends Error {
  constructor(
    readonly code: GameErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GameError';
  }
}

export function gameError(code: GameErrorCode, message: string, options?: ErrorOptions): GameError {
  return new GameError(code, message, options);
}
