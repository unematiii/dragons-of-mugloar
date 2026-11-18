import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';

import type { GameApiClient } from '@/api/client.js';
import { GameApiError } from '@/api/client.js';

const gameKeys = {
  list: ['games', 'list'] as const,
  detail: (gameId: string) => ['games', 'detail', gameId] as const,
  board: (gameId: string) => ['games', 'board', gameId] as const,
  shop: (gameId: string) => ['games', 'shop', gameId] as const,
  actions: (gameId: string) => ['games', 'actions', gameId] as const,
  reputation: (gameId: string) => ['games', 'reputation', gameId] as const,
};

function isUpstreamGameNotFoundError(cause: unknown): cause is GameApiError {
  return cause instanceof GameApiError && cause.code === 'UPSTREAM_GAME_NOT_FOUND';
}

export function useGameQueries(
  api: GameApiClient,
  selectedGameId: Readonly<Ref<string | null>>,
  sessionReady: Readonly<Ref<boolean>>,
) {
  const queryClient = useQueryClient();
  function refreshMissingGameStatus(cause: unknown): void {
    const gameId = selectedGameId.value;
    if (gameId === null || !isUpstreamGameNotFoundError(cause)) return;

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
      queryClient.invalidateQueries({ queryKey: gameKeys.list }),
    ]);
  }

  const gamesQuery = useQuery({
    queryKey: gameKeys.list,
    queryFn: () => api.listGames(),
    enabled: sessionReady,
  });
  const gameQuery = useQuery({
    queryKey: computed(() =>
      selectedGameId.value === null
        ? ['games', 'detail', null]
        : gameKeys.detail(selectedGameId.value),
    ),
    queryFn: () => {
      if (selectedGameId.value === null) throw new Error('Select a game first');

      return api.getGame(selectedGameId.value);
    },
    enabled: computed(() => sessionReady.value && selectedGameId.value !== null),
  });
  const actionsQuery = useQuery({
    queryKey: computed(() =>
      selectedGameId.value === null
        ? ['games', 'actions', null]
        : gameKeys.actions(selectedGameId.value),
    ),
    queryFn: () => {
      if (selectedGameId.value === null) throw new Error('Select a game first');

      return api.getActions(selectedGameId.value);
    },
    enabled: computed(() => sessionReady.value && selectedGameId.value !== null),
  });
  const reputationQuery = useQuery({
    queryKey: computed(() =>
      selectedGameId.value === null
        ? ['games', 'reputation', null]
        : gameKeys.reputation(selectedGameId.value),
    ),
    queryFn: () => {
      if (selectedGameId.value === null) throw new Error('Select a game first');

      return api.getReputation(selectedGameId.value);
    },
    enabled: computed(() => sessionReady.value && selectedGameId.value !== null),
  });
  const boardQuery = useQuery({
    queryKey: computed(() =>
      selectedGameId.value === null
        ? ['games', 'board', null]
        : gameKeys.board(selectedGameId.value),
    ),
    queryFn: async () => {
      if (selectedGameId.value === null) throw new Error('Select a game first');

      try {
        return await api.getBoard(selectedGameId.value);
      } catch (cause: unknown) {
        refreshMissingGameStatus(cause);

        throw cause;
      }
    },
    enabled: computed(
      () =>
        sessionReady.value &&
        selectedGameId.value !== null &&
        gameQuery.data.value?.status !== 'finished' &&
        gameQuery.data.value?.status !== 'needs-review' &&
        gameQuery.data.value?.status !== 'upstream-missing',
    ),
  });
  const shopQuery = useQuery({
    queryKey: computed(() =>
      selectedGameId.value === null ? ['games', 'shop', null] : gameKeys.shop(selectedGameId.value),
    ),
    queryFn: async () => {
      if (selectedGameId.value === null) throw new Error('Select a game first');

      try {
        return await api.getShop(selectedGameId.value);
      } catch (cause: unknown) {
        refreshMissingGameStatus(cause);

        throw cause;
      }
    },
    staleTime: Infinity,
    enabled: computed(
      () =>
        sessionReady.value &&
        selectedGameId.value !== null &&
        gameQuery.data.value?.status !== 'finished' &&
        gameQuery.data.value?.status !== 'needs-review' &&
        gameQuery.data.value?.status !== 'upstream-missing',
    ),
  });

  return { gamesQuery, gameQuery, actionsQuery, reputationQuery, boardQuery, shopQuery };
}

export { gameKeys };
