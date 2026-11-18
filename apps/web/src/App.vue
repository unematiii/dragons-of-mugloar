<script setup lang="ts">
import { ref, watch } from 'vue';

import type { ShopItem } from '@/api/types.js';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';
import GameCannotContinue from '@/components/games/GameCannotContinue.vue';
import GameLoadingSkeleton from '@/components/games/GameLoadingSkeleton.vue';
import GameNotFound from '@/components/games/GameNotFound.vue';
import GameOver from '@/components/games/GameOver.vue';
import GamePicker from '@/components/games/GamePicker.vue';
import GameStats from '@/components/games/GameStats.vue';
import { ActionHistoryPanel, ShopPanel } from '@/components/games/sidebar/index.js';
import TaskBoard from '@/components/games/TaskBoard.vue';
import UpstreamGameMissing from '@/components/games/UpstreamGameMissing.vue';
import { useAutoplay } from '@/composables/useAutoplay.js';
import { useGames } from '@/composables/useGames.js';

const {
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
} = useGames();

const {
  control: autoplayControl,
  autoplayActive,
  handleClick: handleAutoplayClick,
} = useAutoplay({
  game,
  busy,
  start: startAutoplay,
  pause: pauseAutoplay,
});
const shopOpen = ref(false);

watch(
  () => game.value?.id,
  () => {
    shopOpen.value = false;
  },
);

watch(
  () => game.value?.status,
  (status) => {
    if (status === 'finished' || status === 'needs-review' || status === 'upstream-missing')
      shopOpen.value = false;
  },
);

function buyFromShop(item: ShopItem) {
  shopOpen.value = false;

  return buy(item);
}
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <BaseEyebrow>Dragon guild · field operations</BaseEyebrow>
        <h1>Dragons of Mugloar</h1>
      </div>
      <div class="header-actions">
        <BaseButton v-if="game && !autoplayActive" :loading="newGameLoading" @click="start">
          Start new game
        </BaseButton>
        <BaseButton
          v-if="autoplayControl"
          :loading="autoplayLoading"
          :disabled="autoplayControl.disabled"
          @click="handleAutoplayClick"
        >
          {{ autoplayControl.label }}
        </BaseButton>
      </div>
    </header>

    <p v-if="error && !gameNotFound" class="error" role="alert">{{ error }}</p>
    <GamePicker :games="games" :selected-game-id="game?.id" :disabled="busy" @select="choose" />

    <Transition name="soft-fade" mode="out-in">
      <div v-if="game" key="selected-game" class="game-view">
        <GameStats
          :game="game"
          :shop-suggested="purchaseAdvice?.recommendedItemId != null"
          :shop-open="shopOpen"
          :show-shop-trigger="
            game.status !== 'finished' &&
            game.status !== 'needs-review' &&
            game.status !== 'upstream-missing'
          "
          @open-shop="shopOpen = true"
        />
        <div v-if="game.status === 'finished'" class="single-column">
          <GameOver
            :game="game"
            :last-action="actions.at(-1) ?? null"
            :busy="busy"
            :loading="newGameLoading"
            @start-new="start"
          />
        </div>
        <div v-else-if="game.status === 'needs-review'" class="single-column">
          <GameCannotContinue :busy="busy" :loading="newGameLoading" @start-new="start" />
        </div>
        <div v-else-if="game.status === 'upstream-missing'" class="single-column">
          <UpstreamGameMissing :busy="busy" :loading="newGameLoading" @start-new="start" />
        </div>
        <div v-else class="columns">
          <TaskBoard
            :board="board"
            :loading="boardLoading"
            :busy="busy"
            :solve-loading="solveLoading"
            :game-status="game.status"
            :reputation="reputation"
            :current-turn="game.turn"
            :reputation-loading="reputationLoading"
            @solve="solve"
            @investigate-reputation="investigateReputation"
          />
          <ShopPanel
            :shop="shop"
            :purchase-advice="purchaseAdvice"
            :busy="busy"
            :buying-item-id="buyingItemId"
            :game-status="game.status"
            :loading="shopLoading"
            :open="shopOpen"
            @buy="buyFromShop"
            @close="shopOpen = false"
          />
        </div>
      </div>

      <GameLoadingSkeleton v-else-if="gameLoading" key="loading" />

      <GameNotFound
        v-else-if="gameNotFound"
        key="game-not-found"
        :busy="busy"
        :loading="newGameLoading"
        :has-games="games.length > 0"
        @start-new="start"
      />

      <BasePanel v-else key="empty" class="empty">
        <h2>Ready for your first expedition?</h2>
        <p>Start a game to see contracts, supplies, and live results.</p>
        <BaseButton :loading="newGameLoading" :disabled="busy" @click="start">
          Start game
        </BaseButton>
      </BasePanel>
    </Transition>
    <ActionHistoryPanel
      v-show="game !== null || gameLoading"
      :actions="actions"
      :loading="actionsLoading"
    />
  </main>
</template>

<style scoped>
.shell {
  --game-stats-sticky-offset: 7.25rem;

  width: min(76rem, calc(100% - 2.5rem));
  margin: 0 auto;
  padding: 3rem 0 5rem;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.columns {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(18rem, 0.85fr);
  align-items: start;
  gap: 1.25rem;
}

.game-view {
  display: grid;
  gap: 1.25rem;
}

.single-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.error {
  margin: 0 0 1rem;
  padding: 0.8rem 1rem;
  border: 1px solid #a95750;
  border-radius: 0.5rem;
  background: #381f22;
  color: #ffd7d1;
}

.empty {
  display: grid;
  min-height: 24rem;
  align-content: center;
  justify-items: center;
  gap: 0.9rem;
  background-color: rgb(26 32 41 / 88%);
  margin-top: 3rem;
  padding: clamp(3rem, 8vw, 6rem) 1.5rem;
  text-align: center;
}

.empty h2 {
  margin: 0;
  font-size: clamp(1.75rem, 3.5vw, 2.6rem);
}

.empty p {
  max-width: 38rem;
  margin: 0;
  color: #aeb4bb;
  font-size: 1.1rem;
  line-height: 1.55;
}

.empty :deep(.base-button) {
  margin-top: 0.4rem;
  padding: 0.9rem 1.5rem;
  font-size: 1.05rem;
}

@media (max-width: 760px) {
  .shell {
    width: calc(100% - 1.25rem);
    margin: 0 auto;
    padding: calc(1.25rem + env(safe-area-inset-top)) 0
      calc(var(--action-history-collapsed-height) + 0.75rem + env(safe-area-inset-bottom));
  }

  .topbar {
    align-items: stretch;
    flex-direction: column;
    min-height: 125px;
  }

  .topbar h1 {
    font-size: clamp(1.65rem, 7.4vw, 3rem);
  }

  .header-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    align-items: stretch;
    width: 100%;
  }

  .header-actions :deep(.base-button) {
    width: 100%;
  }

  .topbar :deep(.base-button) {
    padding: 0.6rem;
    font-size: 0.83rem;
  }

  .columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 420px) {
  .header-actions {
    grid-template-columns: 1fr;
  }

  .topbar :deep(.base-button) {
    padding: 0.65rem 0.85rem;
    font-size: 0.9rem;
  }
}
</style>
