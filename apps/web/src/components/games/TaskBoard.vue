<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import type { GameBoard, GameStatus, Reputation, Task } from '@/api/types.js';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';
import BaseSkeleton from '@/components/base/BaseSkeleton.vue';
import GameNotice from '@/components/games/GameNotice.vue';
import ReputationPopover from '@/components/games/ReputationPopover.vue';
import TaskCard from '@/components/games/TaskCard.vue';
import { rankTasks } from '@/utils/game-view.js';

const props = defineProps<{
  board: GameBoard | null;
  loading: boolean;
  busy: boolean;
  solveLoading: boolean;
  gameStatus: GameStatus;
  reputation: Reputation | null;
  currentTurn: number;
  reputationLoading: boolean;
}>();
const emit = defineEmits<{ solve: [task: Task]; investigateReputation: [] }>();
const canSolve = computed(() => props.gameStatus === 'ready' || props.gameStatus === 'paused');
const touchInputQuery =
  typeof window === 'undefined' ? null : window.matchMedia('(hover: none), (pointer: coarse)');
const hasTouchInput = ref(touchInputQuery?.matches ?? false);

function updateTouchInput(event: MediaQueryListEvent) {
  hasTouchInput.value = event.matches;
}

onMounted(() => touchInputQuery?.addEventListener('change', updateTouchInput));
onBeforeUnmount(() => touchInputQuery?.removeEventListener('change', updateTouchInput));

const rankedTasks = computed(() => rankTasks(props.board));
</script>

<template>
  <BasePanel class="board">
    <div class="panel-heading">
      <div>
        <BaseEyebrow>Available contracts</BaseEyebrow>
        <h2>Choose a task</h2>
      </div>
      <div class="panel-heading-actions">
        <span v-if="busy" class="muted">Updating…</span>
        <ReputationPopover
          :reputation="reputation"
          :current-turn="currentTurn"
          :disabled="busy || !canSolve"
          :loading="reputationLoading"
          :suggested="board?.decision.reputationCheckRequired ?? false"
          @investigate="emit('investigateReputation')"
        />
      </div>
    </div>
    <GameNotice v-if="board?.decision.reputationCheckRequired" class="reputation-check-notice">
      {{
        board.decision.reputationCheckReason ??
        'It would be wise to check your standing with the factions before choosing a task.'
      }}
    </GameNotice>
    <Transition name="soft-fade" mode="out-in">
      <div
        v-if="loading"
        key="loading"
        class="task-skeletons"
        role="status"
        aria-label="Loading task board"
      >
        <div v-for="index in 3" :key="index" class="task-skeleton">
          <div>
            <BaseSkeleton width="8rem" height="0.75rem" />
            <BaseSkeleton width="80%" height="1.25rem" />
            <BaseSkeleton width="55%" height="0.85rem" />
          </div>
          <BaseSkeleton width="5rem" height="2.5rem" />
        </div>
      </div>
      <div v-else key="loaded-content">
        <TaskCard
          v-for="{ task, alternative } in rankedTasks"
          :key="task.adId"
          :task="task"
          :alternative="alternative"
          :rank-count="board?.decision.alternatives.length ?? 0"
          :recommended="board?.decision.recommendation === task.adId"
          :busy="busy"
          :has-touch-input="hasTouchInput"
          :can-solve="canSolve"
          :solve-loading="solveLoading"
          @solve="emit('solve', $event)"
        />
        <p v-if="board === null" class="muted">Task board unavailable. Try again shortly.</p>
        <p v-if="board !== null && !board.ads.length" class="muted">
          No tasks are currently available.
        </p>
      </div>
    </Transition>
  </BasePanel>
</template>

<style scoped>
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 1rem;
}

.panel-heading-actions {
  display: flex;
  align-self: flex-start;
  align-items: center;
  gap: 0.65rem;
}

.reputation-check-notice {
  margin: 0 0 1rem;
}

.task-skeletons {
  display: grid;
  gap: 0.7rem;
}

.task-skeleton {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  margin-top: 0.7rem;
  padding: 1rem;
  border: 1px solid #343a43;
  border-radius: 0.65rem;
  background: #171c24;
}

.task-skeleton > div {
  display: grid;
  gap: 0.65rem;
}

.muted {
  color: #9ba3ad;
}
</style>
