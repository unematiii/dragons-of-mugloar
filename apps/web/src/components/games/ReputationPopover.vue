<script setup lang="ts">
import { Dropdown as FloatingDropdown } from 'floating-vue';
import { ref } from 'vue';

import type { Reputation } from '@/api/types.js';
import BaseButton from '@/components/base/BaseButton.vue';
import ReputationIcon from '@/components/base/ReputationIcon.vue';
import { RecommendationFrame } from '@/components/games/recommendation';

const props = defineProps<{
  reputation: Reputation | null;
  currentTurn: number;
  disabled: boolean;
  loading: boolean;
  suggested: boolean;
}>();
const emit = defineEmits<{ investigate: [] }>();
const popoverShown = ref(false);

const factions = [
  { key: 'people', label: 'People' },
  { key: 'state', label: 'State' },
  { key: 'underworld', label: 'Underworld' },
] as const;

function formatValue(value: number | undefined): string {
  return value === undefined
    ? '—'
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
</script>

<template>
  <FloatingDropdown
    v-model:shown="popoverShown"
    :triggers="['click']"
    placement="bottom-end"
    :distance="10"
    :overflow-padding="12"
    popper-class="reputation-popper"
    :flip="true"
    :shift="true"
    :auto-boundary-max-size="true"
    :auto-hide="true"
  >
    <RecommendationFrame
      class="reputation-recommendation"
      :active="suggested"
      pulse-button
      aria-label="Reputation check recommendation"
    >
      <button
        class="reputation-trigger"
        type="button"
        :aria-label="
          suggested ? 'Check reputation before choosing a task' : 'Open reputation stats'
        "
        aria-controls="reputation-popover"
        :aria-expanded="popoverShown"
      >
        <ReputationIcon />
      </button>
    </RecommendationFrame>
    <template #popper>
      <section
        id="reputation-popover"
        class="reputation-popover"
        aria-label="Reputation"
        @keydown.esc.stop.prevent="popoverShown = false"
      >
        <h2 class="reputation-title">Reputation</h2>
        <p class="reputation-age">
          <template v-if="reputation?.observedTurn != null">
            Observed on turn {{ reputation.observedTurn }} ·
            {{ Math.max(0, currentTurn - reputation.observedTurn) }} turns ago
          </template>
          <template v-else-if="reputation">Reading age unknown</template>
          <template v-else>No reading yet</template>
        </p>
        <div class="reputation-factions">
          <div v-for="faction in factions" :key="faction.key" class="reputation-faction">
            <span
              class="reputation-symbol"
              :class="`reputation-symbol--${faction.key}`"
              aria-hidden="true"
            >
              <span />
            </span>
            <span class="reputation-label">{{ faction.label }}</span>
            <strong class="reputation-value">
              {{ formatValue(props.reputation?.[faction.key]) }}
            </strong>
          </div>
        </div>
        <BaseButton
          class="reputation-investigate"
          :loading="loading"
          :disabled="disabled || loading"
          @click="emit('investigate')"
        >
          Investigate
        </BaseButton>
        <p class="reputation-turn-cost">Uses one turn</p>
      </section>
    </template>
  </FloatingDropdown>
</template>

<style scoped>
.reputation-trigger {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid #b88a4c;
  border-radius: 50%;
  padding: 0;
  background: #232933;
  color: #d9ac65;
  font-size: 0.66rem;
  font-weight: 750;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.reputation-recommendation {
  --recommendation-accent: #d6a95f;
  --recommendation-active-background: #2a2b29;
  --recommendation-border: transparent;
  --recommendation-radius: 999px;
  --recommendation-raised-edge: #d6a95f;

  display: inline-grid;
  border-radius: 999px;
}

.reputation-trigger:hover {
  border-color: #d9ac65;
  background: #302a21;
  box-shadow: 0 0 0 2px #f0ce8833;
}

.reputation-trigger:focus-visible {
  outline: 2px solid #f0ce88;
  outline-offset: 2px;
}

:global(.reputation-popper) {
  z-index: 30;
  max-width: calc(100vw - 1.5rem);
}

:global(.reputation-popper .v-popper__wrapper) {
  max-width: calc(100vw - 1.5rem);
}

:global(.reputation-popper.v-popper--theme-dropdown .v-popper__inner) {
  box-sizing: border-box;
  border: 1px solid #b88a4c;
  border-radius: 0.7rem;
  padding: 0;
  background: #1a2029;
  box-shadow: 0 0.8rem 2rem #080a0dcc;
}

:global(.reputation-popper.v-popper--theme-dropdown .v-popper__arrow-outer) {
  border-color: #b88a4c;
}

:global(.reputation-popper.v-popper--theme-dropdown .v-popper__arrow-inner) {
  border-color: #1a2029;
}

.reputation-popover {
  box-sizing: border-box;
  width: 18.5rem;
  max-width: calc(100vw - 1.5rem);
  padding: 0.85rem;
}

.reputation-title {
  margin: 0 0 0.25rem;
  color: #f3eddf;
  font-size: 0.95rem;
}

.reputation-age {
  margin: 0 0 0.8rem;
  color: #aeb4bb;
  font-size: 0.75rem;
}

.reputation-factions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.reputation-faction {
  display: grid;
  justify-items: center;
  gap: 0.12rem;
  min-width: 0;
}

.reputation-symbol {
  display: block;
  position: relative;
  width: 1rem;
  height: 1rem;
  color: #d6a95f;
}

.reputation-symbol--people > span {
  position: absolute;
  inset: 0;
}

.reputation-symbol--people > span::before,
.reputation-symbol--people > span::after {
  position: absolute;
  left: 50%;
  background: currentColor;
  content: '';
  transform: translateX(-50%);
}

.reputation-symbol--people > span::before {
  top: 0;
  width: 0.32rem;
  height: 0.32rem;
  border-radius: 50%;
}

.reputation-symbol--people > span::after {
  bottom: 0;
  width: 0.82rem;
  height: 0.56rem;
  border-radius: 0.35rem 0.35rem 0.08rem 0.08rem;
}

.reputation-symbol--state > span {
  position: absolute;
  inset: 0.22rem 0.16rem 0.05rem;
  border-inline: 0.12rem solid currentColor;
  background: linear-gradient(currentColor 0 0) top / 100% 0.1rem no-repeat;
}

.reputation-symbol--state > span::before,
.reputation-symbol--state > span::after {
  position: absolute;
  left: 50%;
  background: currentColor;
  content: '';
  transform: translateX(-50%);
}

.reputation-symbol--state > span::before {
  top: -0.22rem;
  width: 0.95rem;
  height: 0.16rem;
  background: linear-gradient(
    to right,
    currentColor 0 20%,
    transparent 20% 40%,
    currentColor 40% 60%,
    transparent 60% 80%,
    currentColor 80%
  );
}

.reputation-symbol--state > span::after {
  bottom: -0.05rem;
  width: 0.95rem;
  height: 0.12rem;
}

.reputation-symbol--underworld > span {
  position: absolute;
  top: 0;
  left: 0.08rem;
  width: 0.86rem;
  height: 0.86rem;
  border-radius: 50%;
  background: currentColor;
}

.reputation-symbol--underworld > span::after {
  position: absolute;
  top: -0.12rem;
  right: -0.27rem;
  width: 0.76rem;
  height: 0.76rem;
  border-radius: 50%;
  background: #1a2029;
  content: '';
}

.reputation-label {
  color: #aeb4bb;
  font-size: 0.64rem;
  white-space: nowrap;
}

.reputation-value {
  color: #f3eddf;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}

.reputation-investigate {
  width: 100%;
  padding: 0.5rem 0.75rem;
}

.reputation-turn-cost {
  margin: 0.3rem 0 0;
  color: #aeb4bb;
  font-size: 0.68rem;
  text-align: center;
}

@media (max-width: 760px) {
  .reputation-trigger {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 0.66rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reputation-trigger {
    transition: none;
  }
}
</style>
