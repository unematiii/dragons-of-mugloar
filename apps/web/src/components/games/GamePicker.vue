<script setup lang="ts">
import { computed } from 'vue';

import type { Game } from '@/api/types.js';

const props = withDefaults(
  defineProps<{
    games: readonly Game[];
    selectedGameId: string | undefined;
    disabled?: boolean;
  }>(),
  { disabled: false },
);
const emit = defineEmits<{ select: [gameId: string] }>();
const selectionValue = computed(() =>
  props.games.some((game) => game.id === props.selectedGameId) ? props.selectedGameId : '',
);

function handleChange(event: Event) {
  const select = event.currentTarget;
  if (select instanceof HTMLSelectElement) emit('select', select.value);
}
</script>

<template>
  <section v-if="games.length" class="game-picker">
    <label for="game-picker">Your games</label>
    <select id="game-picker" :value="selectionValue" :disabled="disabled" @change="handleChange">
      <option value="" disabled>Choose a game…</option>
      <option v-for="entry in games" :key="entry.id" :value="entry.id">
        Turn {{ entry.turn }} · {{ entry.score }} points · {{ entry.status }}
      </option>
    </select>
  </section>
</template>

<style scoped>
.game-picker {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  color: #b8c0c8;
  font-size: 0.9rem;
}

select {
  max-width: 24rem;
  border: 1px solid #454d58;
  border-radius: 0.4rem;
  background: #1a2029;
  color: #f3eddf;
  padding: 0.5rem;
  font: inherit;
}

@media (max-width: 760px) {
  .game-picker {
    align-items: flex-start;
    flex-direction: column;
  }

  select {
    width: 100%;
    max-width: none;
  }
}
</style>
