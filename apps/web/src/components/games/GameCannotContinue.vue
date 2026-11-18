<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';

defineProps<{ busy: boolean; loading: boolean }>();
const emit = defineEmits<{ startNew: [] }>();
</script>

<template>
  <BasePanel class="game-ended" aria-labelledby="game-ended-title">
    <BaseEyebrow>Expedition ended</BaseEyebrow>
    <h2 id="game-ended-title">This game cannot continue</h2>
    <p class="explanation">
      The result of your last action could not be confirmed. To avoid repeating an action with an
      unknown outcome, this game has been stopped and cannot safely resume. Your local stats and
      action history are still available.
    </p>
    <BaseButton :loading="loading" :disabled="busy" @click="emit('startNew')">
      Start new game
    </BaseButton>
  </BasePanel>
</template>

<style scoped>
.game-ended {
  padding: clamp(2rem, 7vw, 5rem) 1.5rem;
}

.game-ended h2 {
  margin: 0.35rem 0 1rem;
  font-size: clamp(2rem, 5vw, 3.5rem);
}

.explanation {
  max-width: 42rem;
  margin: 0 0 1.75rem;
  color: #aeb4bb;
  line-height: 1.6;
}
</style>
