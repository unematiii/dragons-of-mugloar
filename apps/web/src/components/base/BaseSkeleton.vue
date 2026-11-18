<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    round?: boolean;
  }>(),
  { width: '100%', height: '1rem', round: false },
);
</script>

<template>
  <span class="skeleton" :class="{ round }" :style="{ width, height }" aria-hidden="true" />
</template>

<style scoped>
.skeleton {
  display: block;
  max-width: 100%;
  border-radius: 0.35rem;
  background: linear-gradient(90deg, #252c35 25%, #343d48 50%, #252c35 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.round {
  border-radius: 999px;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>
