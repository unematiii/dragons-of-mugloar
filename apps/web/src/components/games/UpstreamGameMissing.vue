<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';

defineProps<{ busy: boolean; loading: boolean }>();
const emit = defineEmits<{ startNew: [] }>();
</script>

<template>
  <BasePanel class="unavailable" aria-labelledby="unavailable-title">
    <BaseEyebrow>Remote game unavailable</BaseEyebrow>
    <h2 id="unavailable-title">Game not found</h2>
    <p>
      This game no longer exists on the remote server. It may have expired or been purged. Your
      locally saved stats and action history are still available.
    </p>
    <BaseButton :loading="loading" :disabled="busy" @click="emit('startNew')">
      Start new game
    </BaseButton>
  </BasePanel>
</template>

<style scoped>
.unavailable {
  padding: clamp(2rem, 6vw, 4rem) 1.5rem;
}

.unavailable h2 {
  margin: 0.5rem 0 1rem;
  font-size: clamp(1.8rem, 4vw, 3rem);
}

.unavailable p {
  max-width: 42rem;
  margin-bottom: 1.75rem;
  color: #aeb4bb;
  line-height: 1.6;
}
</style>
