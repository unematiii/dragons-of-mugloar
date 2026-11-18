<template>
  <p class="game-notice" role="status">
    <slot />
  </p>
</template>

<style scoped>
.game-notice {
  border-left: 2px solid #d6a95f;
  padding: 0.25rem 0 0.25rem 0.75rem;
  color: #d3c29d;
  font-size: 0.9rem;
  line-height: 1.4;
}
</style>
