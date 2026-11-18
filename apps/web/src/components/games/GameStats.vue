<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { Game } from '@/api/types.js';
import GoldCoinIcon from '@/components/base/GoldCoinIcon.vue';
import { RecommendationFrame } from '@/components/games/recommendation';

const props = defineProps<{
  game: Game;
  shopSuggested: boolean;
  shopOpen: boolean;
  showShopTrigger: boolean;
}>();
const emit = defineEmits<{ openShop: [] }>();
const shopTrigger = ref<HTMLButtonElement | null>(null);
const lifeChange = ref<'loss' | 'gain' | null>(null);
const scoreMilestone = ref(false);
const scoreProgress = computed(() => Math.min(props.game.score, 1000) / 10);
let milestoneTimer: ReturnType<typeof setTimeout> | undefined;

function clearScoreMilestone() {
  scoreMilestone.value = false;
  if (milestoneTimer !== undefined) clearTimeout(milestoneTimer);

  milestoneTimer = undefined;
}

function celebrateScoreMilestone() {
  clearScoreMilestone();
  scoreMilestone.value = true;
  milestoneTimer = setTimeout(clearScoreMilestone, 1500);
}

watch(
  () => [props.game.id, props.game.lives] as const,
  async ([gameId, lives], [previousGameId, previousLives]) => {
    lifeChange.value = null;
    if (gameId !== previousGameId || lives === previousLives) return;

    await nextTick();
    lifeChange.value = lives < previousLives ? 'loss' : 'gain';
  },
);

watch(
  () => [props.game.id, props.game.score] as const,
  ([gameId, score], [previousGameId, previousScore]) => {
    if (gameId !== previousGameId) {
      clearScoreMilestone();

      return;
    }

    if (previousScore < 1000 && score >= 1000) celebrateScoreMilestone();
  },
);

watch(
  () => props.shopOpen,
  async (open, wasOpen) => {
    if (open || !wasOpen) return;

    await nextTick();
    shopTrigger.value?.focus();
  },
);

onBeforeUnmount(clearScoreMilestone);

function clearLifeChange() {
  lifeChange.value = null;
}
</script>

<template>
  <section class="stats" aria-label="Current game status">
    <div>
      <span>Score</span>
      <div class="score-line">
        <strong class="score-value" :class="{ 'score-value--milestone': scoreMilestone }">
          {{ game.score }} <small>/ 1,000</small>
        </strong>
        <RecommendationFrame
          v-if="showShopTrigger"
          class="shop-trigger-frame"
          :class="{ 'shop-trigger-frame--suggested': shopSuggested }"
          :active="shopSuggested"
          pulse-button
        >
          <button
            ref="shopTrigger"
            class="shop-trigger"
            type="button"
            aria-label="Open shop"
            :aria-expanded="shopOpen"
            @click="emit('openShop')"
          >
            <GoldCoinIcon />
          </button>
        </RecommendationFrame>
      </div>
      <div
        class="score-progress"
        role="progressbar"
        aria-label="Score progress"
        aria-valuemin="0"
        aria-valuemax="1000"
        :aria-valuenow="Math.min(game.score, 1000)"
        :aria-valuetext="`${game.score} of 1,000 points`"
      >
        <span
          class="score-progress__fill"
          :class="{ 'score-progress__fill--milestone': scoreMilestone }"
          :style="{ width: `${scoreProgress}%` }"
        />
      </div>
    </div>
    <div>
      <span>Lives</span>
      <strong
        class="life-count"
        :class="{
          'life-count--loss': lifeChange === 'loss',
          'life-count--gain': lifeChange === 'gain',
        }"
        @animationend="clearLifeChange"
      >
        {{ game.lives }}
      </strong>
    </div>
    <div>
      <span>Gold</span><strong>{{ game.gold }}</strong>
    </div>
    <div>
      <span>Level</span><strong>{{ game.level }}</strong>
    </div>
    <div>
      <span>Turn</span><strong>{{ game.turn }}</strong>
    </div>
  </section>
</template>

<style scoped>
.stats {
  position: sticky;
  top: 0.5rem;
  z-index: 10;
  display: grid;
  grid-template-columns: 2fr repeat(4, 1fr);
  gap: 1px;
  overflow: hidden;
  border: 1px solid #343a43;
  border-radius: 0.8rem;
  background: #343a43;
  box-shadow: 0 0.5rem 1.5rem #11151ccc;
  margin-bottom: 1.5rem;
}

.stats > div {
  display: grid;
  gap: 0.35rem;
  background: #1a2029;
  padding: 1rem;
}

.score-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.shop-trigger-frame {
  display: none;
  flex: none;
  --recommendation-accent: #d6a95f;
  --recommendation-radius: 999px;
  --recommendation-active-background: transparent;
}

.shop-trigger {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border: 1px solid #9b713a;
  border-radius: 50%;
  padding: 0;
  background: radial-gradient(circle at 35% 25%, #34302a, #1a2029 72%);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.shop-trigger:hover {
  border-color: #f0ce88;
  box-shadow: 0 0 0 2px #f0ce8833;
}

.shop-trigger:focus-visible {
  outline: 2px solid #f0ce88;
  outline-offset: 3px;
}

.stats span,
.stats small {
  color: #aeb4bb;
  font-size: 0.8rem;
}

.stats strong {
  font-size: 1.45rem;
}

.life-count {
  display: inline-block;
  transform-origin: left center;
}

.score-value {
  display: inline-block;
  transform-origin: left center;
}

.score-value--milestone {
  animation: score-milestone 800ms cubic-bezier(0.2, 0.8, 0.25, 1);
}

.life-count--loss {
  animation: life-loss 700ms ease-in-out;
}

.life-count--gain {
  animation: life-gain 700ms ease-in-out;
}

@keyframes life-loss {
  25% {
    color: #ff625b;
    transform: scale(1.4);
  }
}

@keyframes life-gain {
  25% {
    color: #72d692;
    transform: scale(1.4);
  }
}

@keyframes score-milestone {
  45% {
    color: #f2d293;
    transform: scale(1.16);
  }
}

.score-progress {
  width: 100%;
  height: 0.4rem;
  overflow: hidden;
  border-radius: 999px;
  background: #343a43;
}

.score-progress__fill {
  position: relative;
  display: block;
  overflow: hidden;
  height: 100%;
  border-radius: inherit;
  background: #d6a95f;
  transition: width 500ms ease;
}

.score-progress__fill--milestone::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, #fff2c9 48%, transparent 76%);
  content: '';
  transform: translateX(-100%);
  animation: score-shine 900ms ease-out 220ms;
}

@keyframes score-shine {
  to {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .life-count--loss,
  .life-count--gain {
    animation: none;
  }

  .score-value--milestone,
  .score-progress__fill--milestone::after {
    animation: none;
  }

  .score-progress__fill {
    transition: none;
  }
}

@media (max-width: 760px) {
  .score-line {
    justify-content: flex-start;
  }

  .stats > div:first-child {
    position: relative;
  }

  .shop-trigger-frame {
    display: inline-flex;
    position: absolute;
    top: 0.55rem;
    right: 0.55rem;
  }

  .shop-trigger {
    width: 2.5rem;
    height: 2.5rem;
  }

  .stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .stats > div:first-child {
    grid-column: 1/-1;
  }

  .stats > div {
    min-width: 0;
    padding: 0.55rem;
  }

  .stats strong {
    font-size: 1.1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shop-trigger {
    transition: none;
  }
}
</style>
