<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import type { GameAction } from '@/api/types.js';
import BasePanel from '@/components/base/BasePanel.vue';
import BaseSkeleton from '@/components/base/BaseSkeleton.vue';

const props = defineProps<{
  actions: readonly GameAction[];
  loading: boolean;
}>();

const historyWindow = ref<HTMLDivElement | null>(null);
const historyPanel = ref<HTMLElement | null>(null);
const historyCollapsed = ref(true);
const historyHeight = ref<number | null>(null);
let historyHasLoaded = false;
let shouldFollowHistory = true;
let resizeStartY = 0;
let resizeStartHeight = 0;

function setHistoryHeight(height: number) {
  historyHeight.value = Math.min(Math.floor(window.innerHeight * 0.8), Math.max(160, height));
}

function resizeHistory(event: PointerEvent) {
  setHistoryHeight(resizeStartHeight + resizeStartY - event.clientY);
}

function stopResizing() {
  window.removeEventListener('pointermove', resizeHistory);
  window.removeEventListener('pointerup', stopResizing);
  window.removeEventListener('pointercancel', stopResizing);
}

function startResizing(event: PointerEvent) {
  const panel = historyPanel.value;
  if (panel === null) return;

  event.preventDefault();
  (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
  resizeStartY = event.clientY;
  resizeStartHeight = panel.getBoundingClientRect().height;
  window.addEventListener('pointermove', resizeHistory);
  window.addEventListener('pointerup', stopResizing);
  window.addEventListener('pointercancel', stopResizing);
}

function resizeWithKeyboard(delta: number) {
  const panel = historyPanel.value;
  if (panel !== null) setHistoryHeight(panel.getBoundingClientRect().height + delta);
}

function scrollHistoryToBottom() {
  const viewport = historyWindow.value;
  if (viewport !== null) {
    const top = viewport.scrollHeight;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      viewport.scrollTop = top;
    } else {
      viewport.scrollTo({ top, behavior: 'smooth' });
    }

    shouldFollowHistory = true;
  }
}

function updateHistoryFollowState() {
  const viewport = historyWindow.value;
  if (viewport === null) return;

  const isAtTop = viewport.scrollTop <= 1;
  const isAtBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 40;
  shouldFollowHistory = isAtTop || isAtBottom;
}

function finishHistoryContentTransition() {
  if (shouldFollowHistory) scrollHistoryToBottom();
}

function actionTitle(actionType: string): string {
  return actionType.toUpperCase();
}

function statusTitle(status: string): string {
  return status.length === 0 ? status : status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: string): string {
  if (status === 'completed') return 'history-status--completed';

  if (status === 'failed') return 'history-status--failed';

  if (status === 'uncertain') return 'history-status--uncertain';

  return '';
}

function actionTarget(action: GameAction): string | undefined {
  if (action.actionType === 'solve') return action.targetDescription;

  if (action.actionType === 'buy') return action.targetName;

  return undefined;
}

function actionResult(action: GameAction): string {
  if (action.actionType === 'reputation' && action.reputation !== undefined) {
    const reputation = action.reputation;
    const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const factions = [
      ['people', 'People'],
      ['state', 'State'],
      ['underworld', 'Underworld'],
    ] as const;

    return factions.map(([key, label]) => `${label} ${format.format(reputation[key])}`).join(' · ');
  }

  if (action.message?.trim()) return action.message;

  if (action.actionType === 'buy')
    return action.status === 'failed' ? 'Purchase failed' : 'Purchase completed';

  return action.status === 'failed' ? 'Action failed' : 'Action completed';
}

watch(
  () => [props.actions.length, props.loading] as const,
  async () => {
    if (props.loading) return;

    await nextTick();
    const viewport = historyWindow.value;
    if (viewport === null) return;

    if (!historyHasLoaded || shouldFollowHistory) scrollHistoryToBottom();

    historyHasLoaded = true;
  },
  { flush: 'post', immediate: true },
);

watch(historyCollapsed, async (collapsed) => {
  if (collapsed) return;

  await nextTick();
  scrollHistoryToBottom();
});

onBeforeUnmount(stopResizing);
</script>

<template>
  <aside
    ref="historyPanel"
    class="history-panel"
    :class="{ 'history-panel--collapsed': historyCollapsed }"
    :style="
      !historyCollapsed && historyHeight !== null ? { height: `${historyHeight}px` } : undefined
    "
  >
    <BasePanel as="div" class="history-surface">
      <button
        v-if="!historyCollapsed"
        class="history-resize-handle"
        type="button"
        aria-label="Resize action history panel"
        @pointerdown="startResizing"
        @keydown.up.prevent="resizeWithKeyboard(-32)"
        @keydown.down.prevent="resizeWithKeyboard(32)"
      >
        <span aria-hidden="true"></span>
      </button>
      <div class="history-heading">
        <h2>
          <button
            class="history-title-toggle"
            type="button"
            :aria-expanded="!historyCollapsed"
            aria-controls="action-history-window"
            @click="historyCollapsed = !historyCollapsed"
          >
            Action history
          </button>
        </h2>
        <button
          class="history-toggle"
          type="button"
          :aria-expanded="!historyCollapsed"
          aria-controls="action-history-window"
          :aria-label="historyCollapsed ? 'Expand action history' : 'Collapse action history'"
          @click="historyCollapsed = !historyCollapsed"
        >
          <span
            class="history-toggle-icon"
            :class="{ 'history-toggle-icon--collapsed': historyCollapsed }"
            aria-hidden="true"
          ></span>
        </button>
      </div>
      <div
        v-show="!historyCollapsed"
        id="action-history-window"
        ref="historyWindow"
        class="history-window"
        role="log"
        aria-label="Action history"
        aria-live="polite"
        @scroll.passive="updateHistoryFollowState"
      >
        <Transition
          name="history-content"
          mode="out-in"
          @after-enter="finishHistoryContentTransition"
        >
          <!-- Refreshes keep an empty history stable instead of flashing the skeleton again. -->
          <ol v-if="loading && !actions.length" key="loading" class="history" aria-hidden="true">
            <li v-for="index in 3" :key="`loading-${index}`" class="history-skeleton">
              <BaseSkeleton width="45%" height="0.85rem" />
              <BaseSkeleton width="85%" height="0.85rem" />
            </li>
          </ol>
          <ol v-else key="entries" class="history">
            <li
              v-for="(action, index) in actions"
              :key="`${action.createdAt}-${index}`"
              class="history-entry"
            >
              <div class="history-entry-heading">
                <strong class="history-action">{{ actionTitle(action.actionType) }}</strong>
                <span class="history-status" :class="statusClass(action.status)">
                  {{ statusTitle(action.status) }}
                </span>
              </div>
              <span v-if="actionTarget(action) !== undefined" class="history-target">
                "{{ actionTarget(action) }}"
              </span>
              <span class="history-result">
                <template v-if="action.turn !== undefined">Turn {{ action.turn }} · </template>
                {{ actionResult(action) }}
              </span>
            </li>
            <li v-if="!actions.length" class="muted">Your actions will appear here.</li>
          </ol>
        </Transition>
      </div>
    </BasePanel>
  </aside>
</template>

<style scoped>
.history-panel {
  position: fixed;
  z-index: 20;
  right: 2.25rem;
  bottom: 0;
  width: min(26rem, calc(100vw - 3rem));
  height: 16rem;
  min-height: 10rem;
  max-height: calc(100vh - 2rem);
  border: 1px solid #343a43;
  border-bottom: 0;
  border-radius: 0.8rem 0.8rem 0 0;
  overflow: hidden;
  box-shadow: 0 0.6rem 2rem rgb(0 0 0 / 45%);
}

.history-surface {
  position: relative;
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  border: 0;
  border-radius: inherit;
  padding: 0;
  background: #171c24;
  box-shadow: none;
}

.history-panel--collapsed {
  height: var(--action-history-collapsed-height);
  min-height: var(--action-history-collapsed-height);
  resize: none;
}

.history-panel--collapsed .history-heading {
  height: 100%;
  box-sizing: border-box;
  border-bottom: 0;
  padding-block: 0;
}

.history-resize-handle {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 50%;
  display: flex;
  width: 6rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0 0 0.5rem 0.5rem;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: ns-resize;
  transform: translateX(-50%);
  touch-action: none;
}

.history-resize-handle span {
  width: 2.75rem;
  height: 0.2rem;
  border-radius: 999px;
  background: #67707c;
  opacity: 0.5;
  transform: translateY(-0.2rem);
}

.history-resize-handle:hover span,
.history-resize-handle:focus-visible span {
  background: #d6a95f;
  opacity: 1;
}

.history-resize-handle:focus-visible {
  outline: 2px solid #d6a95f;
  outline-offset: 2px;
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid #454d58;
  padding: 0.65rem 1.25rem;
  background: #1a2029;
}

.history-heading h2 {
  margin: 0;
  font: inherit;
  font-size: 1.2rem;
  font-weight: 750;
  letter-spacing: 0.01em;
}

.history-title-toggle {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.history-title-toggle:focus-visible {
  border-radius: 0.2rem;
  outline: 2px solid #d6a95f;
  outline-offset: 3px;
}

.history-toggle {
  display: grid;
  width: 2.5rem;
  height: 1.75rem;
  place-items: center;
  border: 0;
  border-radius: 0.4rem;
  padding: 0;
  background: transparent;
  color: #d9dce1;
  font: inherit;
  cursor: pointer;
}

.history-toggle-icon {
  width: 0;
  height: 0;
  border-top: 0.38rem solid currentColor;
  border-right: 0.25rem solid transparent;
  border-left: 0.25rem solid transparent;
  transition: transform 160ms ease;
}

.history-toggle-icon--collapsed {
  transform: rotate(180deg);
}

.history-toggle:focus-visible {
  outline: 2px solid #d6a95f;
  outline-offset: 1px;
}

.history-window {
  min-height: 0;
  flex: 1;
  overflow: auto;
  margin: 0;
  padding: 0.7rem 1.25rem;
  background: #171c24;
  scrollbar-color: #5b626c transparent;
}

.history {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-content-enter-active,
.history-content-leave-active {
  transition: opacity 160ms ease;
}

.history-content-enter-from,
.history-content-leave-to {
  opacity: 0;
}

.history-entry,
.history-skeleton {
  display: grid;
  gap: 0.25rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid #353b44;
  font-size: 0.84rem;
}

.history-entry span {
  color: #aeb4bb;
}

.history-entry-heading {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.history-action {
  color: #d9ac65;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.history-status {
  padding: 0.06rem 0.38rem;
  border-radius: 999px;
  background: #2a3038;
  color: #c1c6cd !important;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.45;
}

.history-status--completed {
  background: #26352b;
  color: #a9c8ae !important;
}

.history-status--failed {
  background: #3b2728;
  color: #e4a09a !important;
}

.history-status--uncertain {
  background: #3a3224;
  color: #dec18f !important;
}

.history-target {
  color: #e6e0d3 !important;
  font-size: 0.84rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.history-result {
  color: #9ca4ae !important;
  font-size: 0.74rem;
  line-height: 1.35;
}

.history-entry:last-child,
.history-skeleton:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.muted {
  color: #9ba3ad;
}

@media (max-width: 760px) {
  .history-resize-handle span {
    width: 3.25rem;
    height: 0.25rem;
  }

  .history-panel {
    right: auto;
    bottom: 0;
    left: 50%;
    width: calc(100vw - 1.25rem);
    transform: translateX(-50%);
  }

  .history-heading h2 {
    font-size: 0.95rem;
  }
}
</style>
