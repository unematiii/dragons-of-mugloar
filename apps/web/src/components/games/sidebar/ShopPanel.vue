<script setup lang="ts">
import { Dropdown as FloatingDropdown } from 'floating-vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';

import type { GameStatus, PurchaseAdvice, ShopItem } from '@/api/types.js';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseEyebrow from '@/components/base/BaseEyebrow.vue';
import BasePanel from '@/components/base/BasePanel.vue';
import BaseSkeleton from '@/components/base/BaseSkeleton.vue';
import GameNotice from '@/components/games/GameNotice.vue';
import { RecommendationFrame } from '@/components/games/recommendation';
import { useScrollLock } from '@/composables/useScrollLock.js';

const props = withDefaults(
  defineProps<{
    shop?: readonly ShopItem[];
    purchaseAdvice?: PurchaseAdvice | null;
    busy: boolean;
    buyingItemId?: string | null;
    gameStatus: GameStatus;
    loading?: boolean;
    open?: boolean;
  }>(),
  {
    shop: () => [],
    purchaseAdvice: null,
    buyingItemId: null,
    loading: false,
    open: false,
  },
);
const emit = defineEmits<{ buy: [item: ShopItem]; close: [] }>();
const closeButton = ref<HTMLButtonElement | null>(null);
useScrollLock(toRef(props, 'open'));
const canBuyItems = computed(
  () => !props.busy && (props.gameStatus === 'ready' || props.gameStatus === 'paused'),
);
const adviceByItemId = computed(
  () => new Map(props.purchaseAdvice?.alternatives.map((item) => [item.id, item]) ?? []),
);
function capitalizeAction(action: string) {
  return `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
}

type AdviceTrigger = 'click' | 'focus' | 'hover';

const touchInputQuery =
  typeof window === 'undefined' ? null : window.matchMedia('(hover: none), (pointer: coarse)');
const hasTouchInput = ref(touchInputQuery?.matches ?? false);
const adviceTriggers = computed<AdviceTrigger[]>(() =>
  hasTouchInput.value ? ['click'] : ['hover', 'focus'],
);
const advicePopperTriggers = computed<AdviceTrigger[]>(() =>
  hasTouchInput.value ? [] : ['hover'],
);

function updateTouchInput(event: MediaQueryListEvent) {
  hasTouchInput.value = event.matches;
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  emit('close');
}

onMounted(() => touchInputQuery?.addEventListener('change', updateTouchInput));

watch(
  () => props.open,
  async (open) => {
    if (open) {
      window.addEventListener('keydown', handleDialogKeydown);
      await nextTick();
      closeButton.value?.focus();
    } else {
      window.removeEventListener('keydown', handleDialogKeydown);
    }
  },
);

onBeforeUnmount(() => {
  touchInputQuery?.removeEventListener('change', updateTouchInput);
  window.removeEventListener('keydown', handleDialogKeydown);
});

// The saved shop observations all contain 11 items, so this reserves the panel while loading.
const skeletonRows = 11;
</script>

<template>
  <BasePanel
    as="aside"
    class="shop-panel"
    :class="{ 'shop-panel--open': open }"
    :role="open ? 'dialog' : 'complementary'"
    aria-labelledby="shop-title"
    :aria-modal="open ? 'true' : undefined"
  >
    <header class="shop-heading">
      <div>
        <BaseEyebrow>Guild supplies</BaseEyebrow>
        <h2 id="shop-title">Shop</h2>
      </div>
      <button
        v-if="open"
        ref="closeButton"
        class="shop-close"
        type="button"
        aria-label="Close shop"
        @click="emit('close')"
      >
        <span aria-hidden="true"></span>
      </button>
    </header>
    <GameNotice v-if="gameStatus === 'running'" class="shop-autoplay-note">
      Autoplay is running. Shop purchases are available when the game pauses.
    </GameNotice>
    <Transition name="soft-fade" mode="out-in">
      <!-- Background refreshes keep the loaded catalogue visible instead of replacing it. -->
      <div
        v-if="loading"
        key="loading"
        class="shop-skeletons"
        role="status"
        aria-label="Loading shop"
      >
        <div v-for="index in skeletonRows" :key="index" class="shop-item shop-skeleton">
          <div class="shop-item-main">
            <div class="purchase-copy">
              <BaseSkeleton width="7rem" height="1rem" />
              <BaseSkeleton width="9rem" height="1.2rem" />
              <BaseSkeleton width="4rem" height="1.2rem" />
            </div>
            <div class="shop-buy-action">
              <BaseSkeleton width="4rem" height="2.5rem" />
            </div>
          </div>
        </div>
      </div>
      <div v-else key="shop-content" class="shop-list">
        <RecommendationFrame
          v-for="(item, index) in shop"
          :key="item.id"
          :active="item.id === purchaseAdvice?.recommendedItemId"
          class="shop-item"
          :class="{
            'shop-item--recommended': item.id === purchaseAdvice?.recommendedItemId,
            'shop-item--before-recommended':
              shop[index + 1]?.id === purchaseAdvice?.recommendedItemId,
          }"
        >
          <div class="shop-item-main">
            <div class="purchase-copy">
              <h3 :title="item.name">{{ item.name }}</h3>
              <div class="purchase-advice">
                <div class="purchase-price-row">
                  <span>{{ item.cost }} gold</span>
                  <span
                    v-if="adviceByItemId.get(item.id)"
                    class="purchase-price-separator"
                    aria-hidden="true"
                    >·</span
                  >
                  <FloatingDropdown
                    v-if="adviceByItemId.get(item.id)"
                    :triggers="adviceTriggers"
                    :popper-triggers="advicePopperTriggers"
                    placement="bottom"
                    :distance="10"
                    :overflow-padding="12"
                    popper-class="shop-advice-popper"
                    :flip="true"
                    :shift="true"
                    :auto-boundary-max-size="true"
                    :auto-hide="true"
                    show-group="purchase-advice"
                    :delay="{ show: 100, hide: 80 }"
                  >
                    <button
                      class="shop-advice-trigger"
                      type="button"
                      :aria-label="`Show purchase advice for ${item.name}`"
                    >
                      <span class="shop-advice-icon" aria-hidden="true">i</span>
                    </button>
                    <template #popper>
                      <div class="shop-advice-popover">
                        {{ capitalizeAction(adviceByItemId.get(item.id)?.action ?? '') }} ·
                        {{ adviceByItemId.get(item.id)?.reason }}
                      </div>
                    </template>
                  </FloatingDropdown>
                </div>
              </div>
            </div>
            <div class="shop-buy-action">
              <BaseButton
                class="base-button--compact"
                :loading="buyingItemId === item.id"
                :disabled="!canBuyItems || !item.affordable"
                @click="emit('buy', item)"
              >
                Buy
              </BaseButton>
            </div>
          </div>
        </RecommendationFrame>
        <p v-if="!shop.length" class="muted">No supplies available.</p>
      </div>
    </Transition>
  </BasePanel>
</template>

<style scoped>
.shop-panel {
  position: sticky;
  top: calc(var(--game-stats-sticky-offset, 7.25rem) + 0.75rem);
  overflow: visible;
}

.shop-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.shop-heading h2 {
  margin: 0;
}

.shop-close {
  display: grid;
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #f3eddf;
  cursor: pointer;
}

.shop-close span,
.shop-close span::after {
  position: absolute;
  width: 1rem;
  height: 1.5px;
  border-radius: 999px;
  background: currentColor;
  content: '';
}

.shop-close span {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
}

.shop-close span::after {
  inset: 0;
  transform: rotate(90deg);
}

.shop-close:focus-visible {
  outline: 2px solid #d6a95f;
  outline-offset: 2px;
}

.shop-autoplay-note {
  margin: 1rem 0 0;
}

.shop-item {
  display: grid;
  gap: 0.45rem;
  padding: 0.7rem 0.75rem 0.7rem calc(0.75rem + 2px);
  --recommendation-accent: #b88a4c;
  --recommendation-radius: 0.65rem;
  border-left-width: 1px;
  background-color: transparent;
}

.shop-item--recommended:not(:first-child) {
  margin-top: 0.85rem;
}

.shop-item:hover,
.shop-item:focus-within {
  z-index: 1;
  background-color: #2a2b29;
}

.shop-item-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.shop-list,
.shop-skeletons {
  display: block;
  margin-top: 1rem;
}

.shop-item + .shop-item {
  margin-top: 0.7rem;
}

.purchase-copy {
  position: relative;
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.purchase-price-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.purchase-advice {
  position: relative;
  width: max-content;
  max-width: 100%;
}

.shop-item .purchase-price-separator {
  color: #777f8a;
}

.purchase-copy h3 {
  overflow: hidden;
  margin: 0;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-buy-action {
  flex: none;
}

.shop-item span {
  color: #aeb4bb;
  font-size: 0.85rem;
}

.shop-advice-trigger {
  position: relative;
  display: flex;
  width: 0.85rem;
  height: 0.85rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  padding: 0;
  background: transparent;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}

.shop-advice-trigger::before {
  position: absolute;
  inset: -0.325rem;
  content: '';
}

.shop-advice-trigger:focus-visible .shop-advice-icon {
  outline: 2px solid #d6a95f;
  outline-offset: 2px;
}

.shop-item .shop-advice-icon {
  display: grid;
  width: 0.85rem;
  height: 0.85rem;
  place-items: center;
  border: 1px solid #b88a4c;
  border-radius: 50%;
  color: #e0b86d;
  font-size: 0.65rem;
  font-weight: 750;
}

.muted {
  color: #9ba3ad;
}

@media (max-width: 760px) {
  .shop-panel:not(.shop-panel--open) {
    display: none;
  }

  .shop-panel--open {
    position: fixed;
    z-index: 40;
    inset: 0;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    overflow-x: hidden;
    overflow-y: auto;
    box-sizing: border-box;
    border: 0;
    border-radius: 0;
    padding: 0 1rem calc(1.5rem + env(safe-area-inset-bottom));
    background: #171c24;
  }

  .shop-panel--open .shop-heading {
    position: sticky;
    z-index: 5;
    top: 0;
    margin: 0;
    padding: calc(1.25rem + env(safe-area-inset-top)) 0 0.75rem;
    background: #171c24;
  }
}
</style>

<style>
.shop-advice-popper {
  z-index: 60;
  max-width: min(250px, calc(100vw - 2rem));
}

.shop-advice-popper.v-popper--theme-dropdown .v-popper__inner {
  box-sizing: border-box;
  max-width: min(250px, calc(100vw - 2rem));
  border: 1px solid #b88a4c;
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  background: #252a31;
  color: #d3c29d;
  font-size: 0.8rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  box-shadow: 0 0.5rem 1.25rem rgb(0 0 0 / 35%);
}

.shop-advice-popper.v-popper--theme-dropdown .v-popper__arrow-outer {
  border-color: #b88a4c;
}

.shop-advice-popper.v-popper--theme-dropdown .v-popper__arrow-inner {
  border-color: #252a31;
}

.shop-advice-popover {
  max-width: min(250px, calc(100vw - 2rem));
}
</style>
