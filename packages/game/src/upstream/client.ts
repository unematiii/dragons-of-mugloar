import type { TSchema } from '@sinclair/typebox';

import { UpstreamError, UpstreamGameNotFoundError } from './errors.js';
import { createUpstreamRequest } from './request.js';
import {
  GameStateSchema,
  PartialActionSchema,
  ReputationSchema,
  ShopListSchema,
  TaskListSchema,
} from './schemas.js';
import type { UpstreamClient, UpstreamClientOptions } from './types.js';
import { normalizeMessages, normalizeShopItems } from './utils.js';

export function createUpstreamClient(options: UpstreamClientOptions): UpstreamClient {
  const request = createUpstreamRequest(options);

  async function requestGameOperation<T extends TSchema>(
    path: string,
    method: 'GET' | 'POST',
    schema: T,
  ) {
    try {
      return await request(path, method, schema);
    } catch (error: unknown) {
      if (error instanceof UpstreamError && error.statusCode === 404)
        throw new UpstreamGameNotFoundError(error);

      throw error;
    }
  }

  const startGame = () => request('game/start', 'POST', GameStateSchema);

  const getMessages: UpstreamClient['getMessages'] = async (gameId) => {
    const response = await requestGameOperation(
      `${encodeURIComponent(gameId)}/messages`,
      'GET',
      TaskListSchema,
    );

    return { raw: response.raw, value: normalizeMessages(response.value, response.raw) };
  };

  const getShop: UpstreamClient['getShop'] = async (gameId) => {
    const response = await requestGameOperation(
      `${encodeURIComponent(gameId)}/shop`,
      'GET',
      ShopListSchema,
    );

    return { raw: response.raw, value: normalizeShopItems(response.value) };
  };

  const solve: UpstreamClient['solve'] = (gameId, adId) =>
    requestGameOperation(
      `${encodeURIComponent(gameId)}/solve/${encodeURIComponent(adId)}`,
      'POST',
      PartialActionSchema,
    );

  const buy: UpstreamClient['buy'] = (gameId, itemId) =>
    requestGameOperation(
      `${encodeURIComponent(gameId)}/shop/buy/${encodeURIComponent(itemId)}`,
      'POST',
      PartialActionSchema,
    );

  const investigateReputation: UpstreamClient['investigateReputation'] = (gameId) =>
    requestGameOperation(
      `${encodeURIComponent(gameId)}/investigate/reputation`,
      'POST',
      ReputationSchema,
    );

  return { startGame, getMessages, getShop, solve, buy, investigateReputation };
}
