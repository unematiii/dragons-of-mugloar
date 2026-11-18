import type { Game, GameBoard } from '@/api/types.js';

// Advice is useful only when it describes the revision currently shown to the player.
export function currentBoard(
  game: Pick<Game, 'revision'> | null,
  snapshot: GameBoard | undefined,
): GameBoard | null {
  return game !== null && snapshot?.revision === game.revision ? snapshot : null;
}

export function rankTasks(board: GameBoard | null) {
  const alternatives = new Map(
    board?.decision.alternatives.map((alternative, index) => [
      alternative.id,
      { ...alternative, rank: index + 1 },
    ]) ?? [],
  );

  return (board?.ads ?? [])
    .map((task, index) => ({ task, index, alternative: alternatives.get(task.adId) }))
    .sort(
      (left, right) =>
        (left.alternative?.rank ?? Infinity) - (right.alternative?.rank ?? Infinity) ||
        left.index - right.index,
    );
}
