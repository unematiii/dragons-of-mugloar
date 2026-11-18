import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useGameActions } from './useGameActions.js';
import { useGameEvents } from './useGameEvents.js';
import { gameKeys, useGameQueries } from './useGameQueries.js';

import { GameApiClient, GameApiError } from '@/api/client.js';
import type { Game, GameAction, Reputation } from '@/api/types.js';
import { currentBoard } from '@/utils/game-view.js';

type BusyState =
  | 'idle'
  | 'game-loading'
  | 'action-pending'
  | 'refreshing-after-action'
  | 'refreshing-board'
  | 'board-out-of-date';

function isUpstreamGameNotFoundError(cause: unknown): cause is GameApiError {
  return cause instanceof GameApiError && cause.code === 'UPSTREAM_GAME_NOT_FOUND';
}

export function useGames() {
  const api = new GameApiClient();
  const queryClient = useQueryClient();
  const route = useRoute();
  const router = useRouter();
  const sessionReady = ref(false);
  const initializing = ref(true);
  const selectedGameId = computed(() => {
    const routeGameId = route.params['gameId'];

    return typeof routeGameId === 'string' ? routeGameId : null;
  });
  const startupError = ref('');

  const { gamesQuery, gameQuery, actionsQuery, reputationQuery, boardQuery, shopQuery } =
    useGameQueries(api, selectedGameId, sessionReady);

  const createGameMutation = useMutation({
    mutationFn: () => api.createGame(),
  });
  const games = computed(() => gamesQuery.data.value ?? []);
  const game = computed(() => gameQuery.data.value ?? null);

  const {
    operationError,
    autoplayLoading,
    refreshingAfterAction,
    actionPending,
    reputationPending,
    reputationLoading,
    solveLoading,
    buyingItemId,
    solve,
    buy,
    investigateReputation,
    startAutoplay,
    pauseAutoplay,
  } = useGameActions({ api, game, selectedGameId, refreshGame });

  const { connectionError } = useGameEvents({
    api,
    selectedGameId,
    sessionReady,
    refreshGame,
    onAutoplayStop: (message) => {
      operationError.value = message;
    },
  });

  const gameLoading = computed(
    () =>
      initializing.value ||
      createGameMutation.isPending.value ||
      (selectedGameId.value !== null && gameQuery.isPending.value),
  );
  const newGameLoading = computed(() => createGameMutation.isPending.value);
  const shopLoading = computed(
    () => shopQuery.data.value === undefined && shopQuery.isFetching.value,
  );
  const actionsLoading = computed(
    () => actionsQuery.data.value === undefined && actionsQuery.isFetching.value,
  );

  const board = computed(() => currentBoard(game.value, boardQuery.data.value));
  // A revision change can precede the board refetch. Keep that gap in a loading state.
  const boardLoading = computed(
    () => board.value === null && (boardQuery.isFetching.value || !boardQuery.isError.value),
  );

  const purchaseAdvice = computed(() => board.value?.decision.purchaseAdvice ?? null);
  const shop = computed(() => {
    const snapshot = shopQuery.data.value;
    const currentGame = game.value;
    if (snapshot === undefined || currentGame === null) return [];

    // The shop catalogue stays local for this game; affordability follows the live gold value.
    return snapshot.items.map((item) => ({ ...item, affordable: currentGame.gold >= item.cost }));
  });

  const actions = computed<readonly GameAction[]>(() => actionsQuery.data.value ?? []);
  const reputation = computed<Reputation | null>(() => reputationQuery.data.value ?? null);
  const gameNotFound = computed(
    () =>
      gameQuery.error.value instanceof GameApiError &&
      gameQuery.error.value.code === 'GAME_NOT_FOUND',
  );

  const busyState = computed<BusyState>(() => {
    if (gameLoading.value) return 'game-loading';

    if (actionPending.value) return 'action-pending';

    if (reputationPending.value) return 'action-pending';

    if (autoplayLoading.value) return 'action-pending';

    if (refreshingAfterAction.value) return 'refreshing-after-action';

    const currentGame = game.value;
    const boardIsRelevant =
      currentGame !== null &&
      currentGame.status !== 'finished' &&
      currentGame.status !== 'needs-review' &&
      currentGame.status !== 'upstream-missing';
    if (!boardIsRelevant) return 'idle';

    if (boardQuery.isFetching.value) return 'refreshing-board';

    if (boardQuery.data.value !== undefined && board.value === null) {
      return 'board-out-of-date';
    }

    return 'idle';
  });
  const busy = computed(() => busyState.value !== 'idle');

  const readError = computed(() => {
    if (game.value?.status === 'upstream-missing') return '';

    const apiErrors = [
      gameQuery.error.value,
      game.value?.status !== 'finished' && boardQuery.error.value,
      game.value?.status !== 'finished' && shopQuery.error.value,
      actionsQuery.error.value,
      gamesQuery.error.value,
    ].filter((cause) => !isUpstreamGameNotFoundError(cause));
    const specificApiError = apiErrors.find(
      (cause): cause is GameApiError =>
        cause instanceof GameApiError && cause.code !== 'INTERNAL_ERROR',
    );
    if (specificApiError !== undefined) return specificApiError.message;

    const failed = [
      gameQuery.isError.value && 'game status',
      game.value?.status !== 'finished' &&
        boardQuery.isError.value &&
        !isUpstreamGameNotFoundError(boardQuery.error.value) &&
        'task board',
      game.value?.status !== 'finished' &&
        shopQuery.isError.value &&
        !isUpstreamGameNotFoundError(shopQuery.error.value) &&
        'shop',
      actionsQuery.isError.value && 'action history',
      gamesQuery.isError.value && 'game list',
    ].filter((name): name is string => typeof name === 'string');

    return failed.length ? `Could not load ${failed.join(', ')}. Try again shortly.` : '';
  });
  const error = computed(
    () =>
      startupError.value ||
      (game.value?.status === 'needs-review'
        ? connectionError.value
        : operationError.value || readError.value || connectionError.value),
  );

  async function refreshGame(gameId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) }),
      queryClient.invalidateQueries({ queryKey: gameKeys.actions(gameId) }),
      queryClient.invalidateQueries({ queryKey: gameKeys.list }),
    ]);
    const latest = queryClient.getQueryData<Game>(gameKeys.detail(gameId));
    if (
      latest?.status === 'finished' ||
      latest?.status === 'needs-review' ||
      latest?.status === 'upstream-missing'
    ) {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: gameKeys.board(gameId) }),
        queryClient.cancelQueries({ queryKey: gameKeys.shop(gameId) }),
      ]);

      return;
    }

    await Promise.all([queryClient.invalidateQueries({ queryKey: gameKeys.board(gameId) })]);
  }

  async function start() {
    operationError.value = '';
    try {
      const created = await createGameMutation.mutateAsync();
      await router.push({ name: 'game', params: { gameId: created.id } });
      await queryClient.invalidateQueries({ queryKey: gameKeys.list });
    } catch (cause: unknown) {
      operationError.value = cause instanceof Error ? cause.message : 'Something went wrong';
    }
  }

  async function choose(gameId: string) {
    operationError.value = '';
    await router.push({ name: 'game', params: { gameId } });
  }

  onMounted(async () => {
    try {
      await api.initializeSession();
      sessionReady.value = true;

      const result = await gamesQuery.refetch();
      if (selectedGameId.value === null && result.data?.[0] !== undefined) {
        await router.replace({ name: 'game', params: { gameId: result.data[0].id } });
      }
    } catch (cause: unknown) {
      startupError.value = cause instanceof Error ? cause.message : 'Could not initialize session';
    } finally {
      initializing.value = false;
    }
  });

  return {
    games,
    game,
    board,
    purchaseAdvice,
    shop,
    actions,
    reputation,
    reputationLoading,
    solveLoading,
    buyingItemId,
    busy,
    error,
    gameLoading,
    newGameLoading,
    autoplayLoading,
    boardLoading,
    shopLoading,
    actionsLoading,
    gameNotFound,
    start,
    choose,
    solve,
    buy,
    investigateReputation,
    startAutoplay,
    pauseAutoplay,
  };
}
