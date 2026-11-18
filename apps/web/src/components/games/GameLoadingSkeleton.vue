<script setup lang="ts">
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';
import BaseSkeleton from '@/components/base/BaseSkeleton.vue';
import { ShopPanel } from '@/components/games/sidebar/index.js';
</script>

<template>
  <div class="loading-game" role="status" aria-label="Loading game">
    <section class="stats" aria-busy="true" aria-label="Loading game stats">
      <div v-for="index in 5" :key="index" class="stat-placeholder">
        <BaseSkeleton width="3.5rem" height="0.85rem" />
        <BaseSkeleton width="4.5rem" height="1.8rem" />
        <BaseSkeleton v-if="index === 1" height="0.4rem" />
      </div>
    </section>
    <div class="columns">
      <BasePanel class="board" aria-busy="true">
        <div class="panel-heading">
          <div>
            <BaseEyebrow>Available contracts</BaseEyebrow>
            <h2>Choose a task</h2>
          </div>
        </div>
        <div class="task-placeholders">
          <div v-for="index in 3" :key="index" class="task-placeholder">
            <div class="task-copy-placeholder">
              <BaseSkeleton width="6rem" height="0.7rem" />
              <BaseSkeleton width="80%" height="1.2rem" />
              <BaseSkeleton width="55%" height="0.8rem" />
              <BaseSkeleton width="70%" height="0.8rem" />
            </div>
            <BaseSkeleton width="4.5rem" height="2.5rem" />
          </div>
        </div>
      </BasePanel>
      <div class="sidebar">
        <ShopPanel :busy="true" game-status="ready" :loading="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-game,
.columns {
  display: grid;
  gap: 1.25rem;
}

.stats {
  position: sticky;
  top: 0.5rem;
  z-index: 10;
  display: grid;
  grid-template-columns: 2fr repeat(4, 1fr);
  gap: 1px;
  overflow: hidden;
  margin-bottom: 0.25rem;
  border: 1px solid #343a43;
  border-radius: 0.8rem;
  background: #343a43;
  box-shadow: 0 0.5rem 1.5rem #11151ccc;
}

.stat-placeholder {
  display: grid;
  align-content: start;
  gap: 0.35rem;
  min-width: 0;
  padding: 1rem;
  background: #1a2029;
}

.board {
  align-content: start;
}

.panel-heading {
  margin-bottom: 1rem;
}

.panel-heading h2 {
  margin: 0.5rem 0 0;
  font-family: var(--font-display, Georgia, serif);
  font-size: 1.8rem;
}

.task-placeholders,
.history-placeholders {
  display: grid;
  gap: 0.7rem;
}

.columns {
  grid-template-columns: minmax(0, 1.65fr) minmax(18rem, 0.85fr);
  align-items: start;
}

.task-placeholder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #343a43;
  border-radius: 0.65rem;
  background: #171c24;
}

.task-copy-placeholder {
  display: grid;
  flex: 1;
  gap: 0.65rem;
  min-width: 0;
}

@media (max-width: 760px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-placeholder {
    padding: 0.55rem;
  }

  .stat-placeholder:first-child {
    grid-column: 1/-1;
  }

  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
