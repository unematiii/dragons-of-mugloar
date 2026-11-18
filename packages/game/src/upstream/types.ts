import type { Static } from '@sinclair/typebox';

import type { PartialActionSchema, ReputationSchema } from './schemas.js';

export interface UpstreamEnvelope<T> {
  readonly value: T;
  readonly raw: unknown;
}

export interface UpstreamGameState {
  readonly gameId: string;
  readonly lives: number;
  readonly gold: number;
  readonly level: number;
  readonly score: number;
  readonly highScore: number;
  readonly turn: number;
}

export interface UpstreamMessage {
  /** Solve ID: decoded for known encoded modes, raw for plain or undecodable IDs. */
  readonly adId: string;
  readonly rawAdId: string;
  readonly decodedAdId?: string;
  readonly message: string;
  readonly rawMessage: string;
  readonly reward: number;
  readonly expiresIn: number;
  readonly probability: string;
  readonly rawProbability: string;
  readonly encrypted: unknown;
  readonly encoding: 'plain' | 'base64-mode-1' | 'rot13-mode-2' | 'unsupported';
  readonly decoding: 'not-needed' | 'decoded' | 'failed';
  readonly decodeIssue?: string;
  readonly raw: unknown;
}

export interface NormalizedShopItem {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly raw: unknown;
}

export type NormalizedAction = Static<typeof PartialActionSchema>;
export type UpstreamReputation = Static<typeof ReputationSchema>;

export interface UpstreamClient {
  startGame(): Promise<UpstreamEnvelope<UpstreamGameState>>;
  getMessages(gameId: string): Promise<UpstreamEnvelope<readonly UpstreamMessage[]>>;
  getShop(gameId: string): Promise<UpstreamEnvelope<readonly NormalizedShopItem[]>>;
  solve(gameId: string, adId: string): Promise<UpstreamEnvelope<NormalizedAction>>;
  buy(gameId: string, itemId: string): Promise<UpstreamEnvelope<NormalizedAction>>;
  investigateReputation(gameId: string): Promise<UpstreamEnvelope<UpstreamReputation>>;
}

export interface UpstreamClientOptions {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetcher?: typeof fetch;
}
