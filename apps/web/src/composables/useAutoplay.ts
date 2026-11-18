import { computed } from 'vue';
import type { ComputedRef } from 'vue';

import type { Game } from '@/api/types.js';

interface AutoplayControl {
  readonly action: 'start' | 'pause';
  readonly disabled: boolean;
  readonly label: 'Start autoplay' | 'Resume autoplay' | 'Pause autoplay' | 'Pausing…';
}

interface UseAutoplayOptions {
  readonly game: ComputedRef<Game | null>;
  readonly busy: ComputedRef<boolean>;
  readonly start: () => Promise<void>;
  readonly pause: () => Promise<void>;
}

export function useAutoplay({ game, busy, start, pause }: UseAutoplayOptions) {
  const control = computed<AutoplayControl | null>(() => {
    const disabled = busy.value;

    switch (game.value?.status) {
      case 'ready':
        return { action: 'start', disabled, label: 'Start autoplay' };
      case 'paused':
        return { action: 'start', disabled, label: 'Resume autoplay' };
      case 'running':
        return { action: 'pause', disabled: false, label: 'Pause autoplay' };
      case 'pausing':
        return { action: 'pause', disabled: true, label: 'Pausing…' };
      case 'error':
      case 'finished':
      case 'needs-review':
      case 'upstream-missing':
      case undefined:
        return null;
    }
  });
  const autoplayActive = computed(() => control.value?.action === 'pause');

  function handleClick() {
    const currentControl = control.value;
    if (currentControl === null || currentControl.disabled) return;

    if (currentControl.action === 'pause') void pause();
    else void start();
  }

  return { control, autoplayActive, handleClick };
}
