<script setup lang="ts">
import type { Game, GameAction } from '@/api/types.js';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';

defineProps<{ game: Game; lastAction: GameAction | null; busy: boolean; loading: boolean }>();
const emit = defineEmits<{ startNew: [] }>();
</script>

<template>
  <BasePanel class="game-over" aria-labelledby="game-over-title">
    <BaseEyebrow>Expedition complete</BaseEyebrow>
    <h2 id="game-over-title">Game over</h2>
    <p class="result">
      {{ lastAction?.message ?? 'Your expedition has ended.' }}
    </p>
    <BaseButton :loading="loading" :disabled="busy" @click="emit('startNew')">
      Start new game
    </BaseButton>
  </BasePanel>
</template>

<style scoped>
.game-over {
  padding: clamp(2rem, 7vw, 5rem) 1.5rem;
  text-align: center;
}

.game-over h2 {
  margin: 0.35rem 0 0.75rem;
  font-size: clamp(2.5rem, 8vw, 5rem);
}

.result {
  color: #aeb4bb;
}

.result {
  font-size: 1.15rem;
}
</style>
