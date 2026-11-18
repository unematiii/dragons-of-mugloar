import type { Static } from '@sinclair/typebox';

import { UpstreamError } from './errors.js';
import type { ShopListSchema, TaskListSchema } from './schemas.js';
import type { NormalizedShopItem, UpstreamMessage } from './types.js';

export function decodeBase64Utf8(value: string): string | undefined {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    return undefined;
  }

  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function decodeRot13(value: string): string {
  return value.replace(/[a-z]/gi, (character) => {
    const code = character.charCodeAt(0);
    const offset = code >= 97 ? 97 : 65;

    return String.fromCharCode(((code - offset + 13) % 26) + offset);
  });
}

export function normalizeMessages(
  tasks: Static<typeof TaskListSchema>,
  raw: unknown,
): readonly UpstreamMessage[] {
  const taskList = Array.isArray(tasks) ? tasks : tasks.messages;

  return taskList.map((task) => {
    const reward = Number(task.reward);
    if (!Number.isFinite(reward)) {
      throw new UpstreamError('Upstream task reward could not be normalized', undefined, raw);
    }

    const rawAdId = task.adId;
    const rawMessage = task.message;
    const rawProbability = task.probability;
    if (task.encrypted === 1 || task.encrypted === 2) {
      const decodeField = task.encrypted === 1 ? decodeBase64Utf8 : decodeRot13;
      const decodedAdId = decodeField(rawAdId);
      const decodedMessage = decodeField(rawMessage);
      const decodedProbability = decodeField(rawProbability);
      const decodingFailed =
        decodedAdId === undefined ||
        decodedMessage === undefined ||
        decodedProbability === undefined;
      const encoding = task.encrypted === 1 ? 'base64-mode-1' : 'rot13-mode-2';

      return {
        adId: decodedAdId ?? rawAdId,
        rawAdId,
        ...(decodedAdId === undefined ? {} : { decodedAdId }),
        message: decodedMessage ?? rawMessage,
        rawMessage,
        reward,
        expiresIn: task.expiresIn,
        probability: decodedProbability ?? rawProbability,
        rawProbability,
        encrypted: task.encrypted,
        encoding: decodingFailed ? 'unsupported' : encoding,
        decoding: decodingFailed ? 'failed' : 'decoded',
        ...(decodingFailed ? { decodeIssue: 'adId, message, probability' } : {}),
        raw: task,
      };
    }

    const isPlain = task.encrypted === null || task.encrypted === undefined;

    return {
      adId: rawAdId,
      rawAdId,
      message: rawMessage,
      rawMessage,
      reward,
      expiresIn: task.expiresIn,
      probability: rawProbability,
      rawProbability,
      encrypted: task.encrypted,
      encoding: isPlain ? 'plain' : 'unsupported',
      decoding: 'not-needed',
      raw: task,
    };
  });
}

export function normalizeShopItems(
  items: Static<typeof ShopListSchema>,
): readonly NormalizedShopItem[] {
  const itemList = Array.isArray(items) ? items : items.items;

  return itemList.map((item) => ({ ...item, raw: item }));
}
