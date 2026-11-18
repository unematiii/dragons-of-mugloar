<script setup lang="ts">
import { Dropdown as FloatingDropdown } from 'floating-vue';
import { computed } from 'vue';

import type { DecisionReport, Task } from '@/api/types.js';
import BaseButton from '@/components/base/BaseButton.vue';
import GoldCoinIcon from '@/components/base/GoldCoinIcon.vue';
import SandTimerIcon from '@/components/base/SandTimerIcon.vue';
import { RecommendationFrame } from '@/components/games/recommendation';
import { getTaskEncodingLabel } from '@/utils/task-encoding.js';

type RankedAlternative = DecisionReport['alternatives'][number] & { readonly rank: number };
const props = defineProps<{
  task: Task;
  alternative: RankedAlternative | undefined;
  rankCount: number;
  recommended: boolean;
  busy: boolean;
  hasTouchInput: boolean;
  canSolve: boolean;
  solveLoading: boolean;
}>();
const emit = defineEmits<{ solve: [task: Task] }>();
const encodingLabel = computed(() => getTaskEncodingLabel(props.task.encoding));

type AdviceTrigger = 'click' | 'focus' | 'hover';
const adviceTriggers = computed<AdviceTrigger[]>(() =>
  props.hasTouchInput ? ['click'] : ['hover', 'focus', 'click'],
);
const labelHistoryPopperTriggers = computed<AdviceTrigger[]>(() =>
  props.hasTouchInput ? [] : ['hover'],
);

function trendClass(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || delta === 0) return 'label-change-trend--neutral';

  return delta > 0 ? 'label-change-trend--up' : 'label-change-trend--down';
}
</script>

<template>
  <RecommendationFrame :active="recommended" class="task">
    <div class="task-copy">
      <p v-if="alternative" class="rank">Rank {{ alternative.rank }} of {{ rankCount }}</p>
      <div class="task-title" role="heading" aria-level="3">
        {{ task.message }}
        <FloatingDropdown
          class="task-advice-inline"
          :triggers="adviceTriggers"
          placement="bottom"
          :distance="8"
          :arrow-padding="12"
          :overflow-padding="12"
          popper-class="task-reason-popper"
          :flip="true"
          :shift="true"
          :auto-boundary-max-size="true"
          :auto-hide="true"
          show-group="task-recommendation-advice"
          :delay="{ show: 100, hide: 80 }"
        >
          <button class="task-advice-trigger" type="button" aria-label="Recommendation info">
            <span aria-hidden="true">i</span>
          </button>
          <template #popper>
            <div class="task-reason-popover">
              {{ alternative?.reason ?? 'No supported recommendation for this task.' }}
            </div>
          </template>
        </FloatingDropdown>
      </div>
      <div class="task-details">
        <span class="task-label">{{ task.probability }}</span>
        <FloatingDropdown
          v-if="task.labelChanges.length"
          class="label-change-tooltip"
          :triggers="adviceTriggers"
          :popper-triggers="labelHistoryPopperTriggers"
          placement="bottom-start"
          :distance="8"
          :arrow-padding="12"
          :overflow-padding="12"
          popper-class="task-reason-popper"
          :flip="true"
          :shift="true"
          :auto-hide="true"
        >
          <button
            class="label-change-trigger"
            type="button"
            :aria-label="`Show ${task.labelChanges.length} success outlook changes for ${task.probability}`"
          >
            <span :class="trendClass(task.labelChanges.at(-1)?.delta)" aria-hidden="true">{{
              task.labelChanges.at(-1)?.delta === null
                ? '↕'
                : (task.labelChanges.at(-1)?.delta ?? 0) > 0
                  ? '↑'
                  : '↓'
            }}</span>
          </button>
          <template #popper>
            <div class="label-change-popover">
              <strong>History</strong>
              <div
                v-for="(change, changeIndex) in task.labelChanges"
                :key="`${change.fromTurn}-${change.toTurn}-${changeIndex}`"
                class="label-change-entry"
              >
                <div class="label-change-heading">
                  <span>Turn {{ change.fromTurn }} → {{ change.toTurn }}</span>
                  <span class="label-change-delta">
                    <span :class="trendClass(change.delta)" aria-hidden="true">{{
                      change.delta === null ? '↕' : change.delta > 0 ? '↑' : '↓'
                    }}</span>
                    {{
                      change.delta === null
                        ? 'unranked'
                        : `${change.delta > 0 ? '+' : ''}${change.delta}`
                    }}
                  </span>
                </div>
                <p>
                  “{{ change.fromLabel }}”<template v-if="change.fromRank !== null">
                    ({{ change.fromRank }})</template
                  >
                  → “{{ change.toLabel }}”<template v-if="change.toRank !== null">
                    ({{ change.toRank }})</template
                  >
                </p>
              </div>
            </div>
          </template>
        </FloatingDropdown>
        <span class="task-detail-separator" aria-hidden="true">·</span>
        <span class="task-reward"><GoldCoinIcon /> {{ task.reward }}</span>
        <span class="task-detail-separator" aria-hidden="true">·</span>
        <span class="task-expiry"><SandTimerIcon /> {{ task.expiresIn }} turns</span>
      </div>
      <p v-if="encodingLabel" class="encoding-note">{{ encodingLabel }}</p>
      <p v-if="task.unsupportedDetails" class="muted">
        Task details could not be decoded; recommendation unavailable.
      </p>
    </div>
    <BaseButton
      :loading="solveLoading"
      :disabled="busy || !canSolve || task.unsupportedDetails"
      @click="emit('solve', task)"
    >
      Solve
    </BaseButton>
  </RecommendationFrame>
</template>

<style scoped>
.task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  margin-top: 0.7rem;
  padding: 1rem;
  --recommendation-border: #343a43;
  --recommendation-background: #171c24;
  --recommendation-accent: #b88a4c;
  --recommendation-active-background: #171c24;
  --recommendation-raised-edge: #b88a4c;
  --recommendation-radius: 0.65rem;
}

.task-copy {
  min-width: 0;
}

.task-title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
  font-weight: 700;
}

.task-advice-inline {
  display: inline-flex;
  align-items: center;
  margin-left: 0.25rem;
  vertical-align: middle;
}

.task p {
  margin: 0 0 0.35rem;
  color: #b9c0c8;
  font-size: 0.84rem;
}

.task-details {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  color: #b9c0c8;
  font-size: 0.84rem;
}

.task-label {
  color: #f2d293;
  font-weight: 650;
}

.task-detail-separator {
  color: #68717c;
}

.task-reward,
.task-expiry {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.task-reward :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.label-change-tooltip {
  display: inline-flex;
}

.label-change-trigger {
  display: inline-grid;
  width: auto;
  height: auto;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #f2d293;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.label-change-trigger:focus-visible {
  outline: 2px solid #f0ce88;
  outline-offset: 2px;
}

.task .rank {
  color: #f2d293;
  font-size: 0.75rem;
  font-weight: 700;
}

.task .encoding-note {
  margin-top: 0.3rem;
  color: #aeb4bb;
  font-size: 0.74rem;
}

.task :deep(.base-button) {
  flex: none;
}

.task-advice-trigger {
  display: inline-grid;
  width: 0.9rem;
  height: 0.9rem;
  flex: none;
  place-items: center;
  border: 1px solid #d6a95f;
  border-radius: 50%;
  padding: 0;
  background: transparent;
  color: #d6a95f;
  font: inherit;
  font-size: 0.68rem;
  line-height: 1;
  cursor: pointer;
}

.task-advice-trigger:focus-visible {
  outline: 2px solid #f0ce88;
  outline-offset: 2px;
}

.muted {
  color: #9ba3ad;
}

@media (max-width: 760px) {
  .task {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }

  .task :deep(.base-button) {
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.6rem;
  }
}
</style>

<style>
.task-reason-popper {
  z-index: 60;
  max-width: min(300px, calc(100vw - 2rem));
}

.task-reason-popper.v-popper--theme-dropdown .v-popper__inner {
  box-sizing: border-box;
  max-width: min(300px, calc(100vw - 2rem));
  border: 1px solid #b88a4c;
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: #1a2029;
  color: #dec18f;
  font-size: 0.8rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  box-shadow: 0 0.5rem 1.25rem rgb(0 0 0 / 35%);
}

.task-reason-popper.v-popper--theme-dropdown .v-popper__arrow-outer {
  border-color: #b88a4c;
}

.task-reason-popper.v-popper--theme-dropdown .v-popper__arrow-inner {
  border-color: #1a2029;
}

.task-reason-popover {
  max-width: min(300px, calc(100vw - 2rem));
}

.label-change-popover {
  box-sizing: border-box;
  width: 16rem;
  max-width: calc(100vw - 3.5rem);
  min-width: 0;
  padding: 0.1rem;
  max-height: min(60vh, 24rem);
  overflow-y: auto;
  overflow-x: hidden;
  overflow-wrap: anywhere;
}

.label-change-popover > strong {
  display: block;
  margin-bottom: 0.35rem;
  color: #f2d293;
}

.label-change-entry {
  padding: 0.45rem 0;
  border-top: 1px solid #343a43;
}

.label-change-heading {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: #f3eddf;
  font-weight: 650;
}

.label-change-delta {
  flex: none;
  color: #f2d293;
}

.label-change-trend--up {
  color: #86d69a;
}

.label-change-trend--down {
  color: #ef8585;
}

.label-change-trend--neutral {
  color: #f2d293;
}

.label-change-entry p {
  margin: 0.2rem 0 0;
  color: #c8cdd3;
}
</style>
