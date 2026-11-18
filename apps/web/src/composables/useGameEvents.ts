import { onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';

import type { GameApiClient } from '@/api/client.js';

interface AutoplayStopPayload {
  readonly autoplayStopReason: string;
  readonly message: string;
}

function isAutoplayStopPayload(value: unknown): value is AutoplayStopPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'autoplayStopReason' in value &&
    typeof value.autoplayStopReason === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

function getAutoplayStopMessage(event: Event): string | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return null;

  try {
    const payload: unknown = JSON.parse(event.data);

    return isAutoplayStopPayload(payload) ? payload.message : null;
  } catch {
    return null;
  }
}

interface GameEventsOptions {
  readonly api: GameApiClient;
  readonly selectedGameId: Readonly<Ref<string | null>>;
  readonly sessionReady: Readonly<Ref<boolean>>;
  readonly refreshGame: (gameId: string) => Promise<void>;
  readonly onAutoplayStop: (message: string) => void;
}

export function useGameEvents({
  api,
  selectedGameId,
  sessionReady,
  refreshGame,
  onAutoplayStop,
}: GameEventsOptions) {
  const connectionError = ref('');
  let eventStream: EventSource | null = null;

  watch([selectedGameId, sessionReady], ([gameId, isSessionReady]) => {
    eventStream?.close();
    connectionError.value = '';
    eventStream =
      !isSessionReady || gameId === null ? null : new EventSource(api.getEventsUrl(gameId));
    const invalidate = () => {
      if (gameId !== null) void refreshGame(gameId);
    };
    eventStream?.addEventListener('snapshot', invalidate);
    eventStream?.addEventListener('update', (event) => {
      invalidate();
      const message = getAutoplayStopMessage(event);
      if (gameId === selectedGameId.value && message !== null) onAutoplayStop(message);
    });
    eventStream?.addEventListener('error', () => {
      connectionError.value = 'Reconnecting to game updates…';
    });
    eventStream?.addEventListener('open', () => {
      connectionError.value = '';
    });
  });

  onBeforeUnmount(() => eventStream?.close());

  return { connectionError };
}
