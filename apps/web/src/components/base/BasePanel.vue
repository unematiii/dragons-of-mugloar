<script setup lang="ts">
withDefaults(defineProps<{ as?: 'section' | 'aside' | 'div' }>(), { as: 'section' });
</script>

<template>
  <component :is="as" class="panel"><slot /></component>
</template>

<style scoped>
.panel {
  border: 1px solid #343a43;
  border-radius: 0.8rem;
  background: #1a2029;
  padding: 1.35rem;
}

@media (max-width: 760px) {
  .panel {
    padding: 1rem;
  }
}
</style>
