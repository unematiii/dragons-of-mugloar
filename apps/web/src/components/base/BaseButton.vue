<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }>(),
  { disabled: false, loading: false, type: 'button' },
);
</script>

<template>
  <button class="base-button" :type="type" :disabled="disabled || loading" :aria-busy="loading">
    <span v-if="loading" class="base-button__loading-dots" aria-hidden="true">
      <span v-for="dot in 3" :key="dot" class="base-button__loading-dot" />
    </span>
    <span v-if="loading" class="base-button__sr-only">Loading</span>
    <span class="base-button__content" :class="{ 'base-button__content--loading': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px solid #ba8e4e;
  border-radius: 0.55rem;
  background: #d6a95f;
  color: #201a12;
  padding: 0.7rem 1rem;
  font: inherit;
  font-weight: 750;
  cursor: pointer;
  transition: background-color 180ms ease;
}

.base-button__loading-dots {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.18rem;
}

.base-button__content--loading {
  visibility: hidden;
}

.base-button__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

.base-button__loading-dot {
  width: 0.28rem;
  height: 0.28rem;
  border-radius: 50%;
  background: currentColor;
  animation: base-button-dot-pulse 900ms ease-in-out infinite;
}

.base-button__loading-dot:nth-child(2) {
  animation-delay: 150ms;
}

.base-button__loading-dot:nth-child(3) {
  animation-delay: 300ms;
}

@keyframes base-button-dot-pulse {
  0%,
  60%,
  100% {
    opacity: 0.55;
    transform: scale(0.72);
  }

  30% {
    opacity: 1;
    transform: scale(1.35);
  }
}

.base-button:hover {
  background: #e6bd7d;
}

.base-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.base-button--compact {
  padding: 0.5rem 0.75rem;
}

@media (prefers-reduced-motion: reduce) {
  .base-button {
    transition: none;
  }

  .base-button__loading-dot {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
