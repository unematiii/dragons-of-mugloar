import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { Ref } from 'vue';

import { gameKeys } from './useGameQueries.js';

import { GameApiError } from '@/api/client.js';
import type { GameApiClient } from '@/api/client.js';
import type { Game, ShopItem, Task } from '@/api/types.js';

function isUpstreamGameNotFoundError(cause: unknown): cause is GameApiError {
  return cause instanceof GameApiError && cause.code === 'UPSTREAM_GAME_NOT_FOUND';
}

interface GameActionsOptions {
  readonly api: GameApiClient;
  readonly game: Readonly<Ref<Game | null>>;
  readonly selectedGameId: Readonly<Ref<string | null>>;
  readonly refreshGame: (gameId: string) => Promise<void>;
}

export function useGameActions({ api, game, selectedGameId, refreshGame }: GameActionsOptions) {
  const queryClient = useQueryClient();
  const operationError = ref('');
  const autoplayLoading = ref(false);
  const refreshingAfterAction = ref(false);
  const actionMutation = useMutation({
    mutationFn: async (input: {
      readonly game: Game;
      readonly task?: Task;
      readonly item?: ShopItem;
    }) => {
      if (input.task !== undefined) return api.solve(input.game, input.task);

      if (input.item !== undefined) return api.buy(input.game, input.item);

      throw new Error('Choose a task or shop item');
    },
  });
  const reputationMutation = useMutation({
    mutationFn: (currentGame: Game) => api.investigateReputation(currentGame),
  });

  const reputationLoading = computed(() => reputationMutation.isPending.value);
  const solveLoading = computed(
    () => actionMutation.isPending.value && actionMutation.variables.value?.task !== undefined,
  );
  const buyingItemId = computed(() =>
    actionMutation.isPending.value ? (actionMutation.variables.value?.item?.id ?? null) : null,
  );
  async function runAction(gameId: string, action: () => Promise<unknown>) {
    operationError.value = '';
    try {
      await action();
    } catch (cause: unknown) {
      operationError.value = isUpstreamGameNotFoundError(cause)
        ? ''
        : cause instanceof Error
          ? cause.message
          : 'Something went wrong';
    } finally {
      refreshingAfterAction.value = true;
      try {
        await refreshGame(gameId);
      } finally {
        refreshingAfterAction.value = false;
      }
    }
  }

  async function solve(task: Task) {
    const currentGame = game.value;
    if (currentGame === null) return;

    await runAction(currentGame.id, () => actionMutation.mutateAsync({ game: currentGame, task }));
  }

  async function buy(item: ShopItem) {
    const currentGame = game.value;
    if (currentGame === null) return;

    await runAction(currentGame.id, () => actionMutation.mutateAsync({ game: currentGame, item }));
  }

  async function investigateReputation() {
    const currentGame = game.value;
    if (currentGame === null) return;

    await runAction(currentGame.id, async () => {
      const reading = await reputationMutation.mutateAsync(currentGame);
      queryClient.setQueryData(gameKeys.reputation(currentGame.id), reading);
    });
  }

  async function startAutoplay() {
    const gameId = selectedGameId.value;
    if (gameId === null) return;

    autoplayLoading.value = true;
    try {
      await runAction(gameId, () => api.startAutoplay(gameId));
    } finally {
      autoplayLoading.value = false;
    }
  }

  async function pauseAutoplay() {
    const gameId = selectedGameId.value;
    if (gameId === null) return;

    autoplayLoading.value = true;
    try {
      await runAction(gameId, () => api.pauseAutoplay(gameId));
    } finally {
      autoplayLoading.value = false;
    }
  }

  return {
    operationError,
    autoplayLoading,
    refreshingAfterAction,
    actionPending: actionMutation.isPending,
    reputationPending: reputationMutation.isPending,
    reputationLoading,
    solveLoading,
    buyingItemId,
    solve,
    buy,
    investigateReputation,
    startAutoplay,
    pauseAutoplay,
  };
}
