<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  active: boolean;
  pulseButton?: boolean;
}>();

const animationDelayMs = ref(0);
watch(
  () => props.active,
  (active) => {
    if (active) animationDelayMs.value = Math.floor(Math.random() * 240);
  },
  { immediate: true },
);
</script>

<template>
  <article
    class="recommendation-frame"
    :class="{
      'recommendation-frame--active': active,
      'recommendation-frame--pulse-button': pulseButton,
    }"
    :style="{ '--recommendation-animation-delay': `${animationDelayMs}ms` }"
  >
    <slot />
  </article>
</template>

<style>
.recommendation-frame {
  position: relative;
  border: 1px solid var(--recommendation-border, transparent);
  border-radius: var(--recommendation-radius, 0.65rem);
  background-color: var(--recommendation-background, transparent);
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
}

.recommendation-frame::before {
  position: absolute;
  inset: 0;
  offset-path: inset(1px round var(--recommendation-radius, 0.65rem));
  offset-anchor: center;
  offset-rotate: auto;
  offset-distance: 0%;
  width: 1.4rem;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--recommendation-accent, #b88a4c),
    transparent
  );
  box-shadow: 0 0 0.45rem var(--recommendation-accent, #b88a4c);
  content: '';
  opacity: 0;
  pointer-events: none;
}

.recommendation-frame--active {
  border-color: var(--recommendation-accent, #b88a4c);
  background-color: var(--recommendation-active-background, #2a2b29);
  box-shadow: inset 3px 0 var(--recommendation-raised-edge, var(--recommendation-accent, #b88a4c));
}

.recommendation-frame--active::before {
  animation: recommended-frame-orbit 1.8s ease-in var(--recommendation-animation-delay, 0ms) 1;
}

@media (max-width: 760px) {
  .recommendation-frame--active.recommendation-frame--pulse-button > button {
    animation: recommended-button-scale 1.8s ease-in-out var(--recommendation-animation-delay, 0ms)
      1;
  }
}

@keyframes recommended-button-scale {
  0%,
  12%,
  64%,
  to {
    transform: scale(1);
  }

  28%,
  44% {
    transform: scale(1.16);
  }
}

@keyframes recommended-frame-orbit {
  0% {
    offset-distance: 0%;
    opacity: 0;
  }

  3% {
    opacity: 0;
  }

  24%,
  50% {
    opacity: 1;
  }

  to {
    offset-distance: 100%;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recommendation-frame {
    transition: none;
  }

  .recommendation-frame::before {
    display: none;
  }

  .recommendation-frame--pulse-button > button {
    animation: none;
  }
}
</style>
