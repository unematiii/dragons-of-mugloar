<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';

defineProps<{
  busy: boolean;
  loading: boolean;
  hasGames: boolean;
}>();
const emit = defineEmits<{ startNew: [] }>();
</script>

<template>
  <BasePanel class="not-found" aria-labelledby="game-not-found-title">
    <BaseEyebrow>Expedition unavailable</BaseEyebrow>
    <h2 id="game-not-found-title">This game isn’t available</h2>
    <p v-if="hasGames">
      We couldn’t find this game in your history. Choose another game above, or start a new one.
    </p>
    <p v-else>We couldn’t find a game at this link. It may be invalid or no longer available.</p>
    <BaseButton :loading="loading" :disabled="busy" @click="emit('startNew')">
      Start a new game
    </BaseButton>
  </BasePanel>
</template>

<style scoped>
.not-found {
  padding: clamp(2rem, 6vw, 4rem) 1.5rem;
  text-align: center;
}

.not-found h2 {
  margin: 0.5rem 0 1rem;
}

.not-found p {
  max-width: 42rem;
  margin: 0 auto 1.75rem;
  color: #aeb4bb;
  line-height: 1.6;
}
</style>
