import { v4 as uuidv4 } from 'uuid';

import type { ApiError } from './types.js';
import type { Game, GameAction, GameBoard, Reputation, ShopItem, Task } from './types.js';

interface CreatedGame {
  readonly id: string;
}

interface ShopResponse {
  readonly revision: number;
  readonly items: readonly ShopItem[];
}

export class GameApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GameApiError';
  }
}

export class GameApiClient {
  private csrfToken: string | null = null;

  async initializeSession(): Promise<void> {
    const { csrfToken } = await this.request<{ csrfToken: string }>('/v1/csrf');
    this.csrfToken = csrfToken;
    await this.request<{ playerId: string }>('/v1/sessions', {
      method: 'POST',
      body: '{}',
    });
  }

  async listGames(): Promise<readonly Game[]> {
    return this.request('/v1/games');
  }

  async createGame(): Promise<CreatedGame> {
    return this.request('/v1/games', { method: 'POST', body: '{}' });
  }

  async getGame(gameId: string): Promise<Game> {
    return this.request(`/v1/games/${encodeURIComponent(gameId)}`);
  }

  async getBoard(gameId: string): Promise<GameBoard> {
    return this.request(`/v1/games/${encodeURIComponent(gameId)}/board`);
  }

  async getShop(gameId: string): Promise<ShopResponse> {
    return this.request(`/v1/games/${encodeURIComponent(gameId)}/shop`);
  }

  async getActions(gameId: string): Promise<readonly GameAction[]> {
    return this.request(`/v1/games/${encodeURIComponent(gameId)}/actions`);
  }

  async getReputation(gameId: string): Promise<Reputation | null> {
    return this.request(`/v1/games/${encodeURIComponent(gameId)}/reputation`);
  }

  async investigateReputation(game: Game): Promise<Reputation> {
    return this.request(`/v1/games/${encodeURIComponent(game.id)}/reputation/investigate`, {
      method: 'POST',
      body: JSON.stringify({ commandId: uuidv4(), revision: game.revision }),
    });
  }

  async startAutoplay(gameId: string): Promise<void> {
    await this.request(`/v1/games/${encodeURIComponent(gameId)}/autoplay/start`, {
      method: 'POST',
      body: '{}',
    });
  }

  async pauseAutoplay(gameId: string): Promise<void> {
    await this.request(`/v1/games/${encodeURIComponent(gameId)}/autoplay/pause`, {
      method: 'POST',
      body: '{}',
    });
  }

  async solve(game: Game, task: Task): Promise<void> {
    await this.request(`/v1/games/${encodeURIComponent(game.id)}/solve`, {
      method: 'POST',
      body: JSON.stringify({
        commandId: uuidv4(),
        revision: game.revision,
        adId: task.adId,
      }),
    });
  }

  async buy(game: Game, item: ShopItem): Promise<void> {
    await this.request(`/v1/games/${encodeURIComponent(game.id)}/purchases`, {
      method: 'POST',
      body: JSON.stringify({
        commandId: uuidv4(),
        revision: game.revision,
        itemId: item.id,
      }),
    });
  }

  getEventsUrl(gameId: string): string {
    return `/api/v1/games/${encodeURIComponent(gameId)}/events`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.csrfToken !== null) headers.set('csrf-token', this.csrfToken);

    const response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const apiError = this.getApiError(body);

      throw new GameApiError(
        apiError?.code ?? 'HTTP_ERROR',
        response.status,
        apiError?.message ?? `Request failed (${response.status})`,
      );
    }

    return (await response.json()) as T;
  }

  private getApiError(body: unknown): ApiError | null {
    if (typeof body !== 'object' || body === null || !('code' in body) || !('message' in body))
      return null;

    const apiError = body as Partial<ApiError>;

    return typeof apiError.code === 'string' && typeof apiError.message === 'string'
      ? { code: apiError.code, message: apiError.message }
      : null;
  }
}
