import { onBeforeUnmount, watch } from 'vue';
import type { Ref } from 'vue';

export function useScrollLock(isLocked: Readonly<Ref<boolean>>) {
  let previousBodyOverflow: string | null = null;

  function restoreBodyOverflow() {
    if (previousBodyOverflow === null || typeof document === 'undefined') return;

    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }

  watch(
    isLocked,
    (locked) => {
      if (typeof document === 'undefined') return;

      if (locked) {
        if (previousBodyOverflow !== null) return;

        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return;
      }

      restoreBodyOverflow();
    },
    { immediate: true },
  );

  onBeforeUnmount(restoreBodyOverflow);
}
