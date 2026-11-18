import type { Static, TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import { UpstreamError } from './errors.js';
import type { UpstreamClientOptions, UpstreamEnvelope } from './types.js';

export type UpstreamRequest = <T extends TSchema>(
  path: string,
  method: 'GET' | 'POST',
  schema: T,
) => Promise<UpstreamEnvelope<Static<T>>>;

export function createUpstreamRequest(options: UpstreamClientOptions): UpstreamRequest {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetcher = options.fetcher ?? fetch;

  return async function request<T extends TSchema>(
    path: string,
    method: 'GET' | 'POST',
    schema: T,
  ): Promise<UpstreamEnvelope<Static<T>>> {
    const url = new URL(`${baseUrl}/${path.replace(/^\/+/, '')}`);
    let response: Response;
    try {
      response = await fetcher(url, {
        method,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json' },
      });
    } catch (error: unknown) {
      throw new UpstreamError(
        'Upstream request failed before a response was received',
        undefined,
        undefined,
        { cause: error, request: { method, url: url.toString() } },
      );
    }

    let body: string;
    try {
      body = await response.text();
    } catch (error: unknown) {
      throw new UpstreamError(
        'Upstream response body could not be read',
        response.status,
        undefined,
        {
          cause: error,
          request: { method, url: url.toString(), statusText: response.statusText },
        },
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(body) as unknown;
    } catch (error: unknown) {
      // A proxy or upstream error page may be HTML. Keep bounded evidence for diagnosis.
      const limit = 64 * 1024;

      throw new UpstreamError(
        'Upstream returned invalid JSON',
        response.status,
        {
          contentType: response.headers.get('content-type'),
          body: body.slice(0, limit),
          truncated: body.length > limit,
        },
        {
          cause: error,
          request: { method, url: url.toString(), statusText: response.statusText },
        },
      );
    }

    if (!response.ok) {
      throw new UpstreamError(`Upstream returned HTTP ${response.status}`, response.status, raw, {
        request: { method, url: url.toString(), statusText: response.statusText },
      });
    }

    if (!Value.Check(schema, raw)) {
      throw new UpstreamError(
        'Upstream response did not match the expected shape',
        response.status,
        raw,
        { request: { method, url: url.toString(), statusText: response.statusText } },
      );
    }

    return { value: raw, raw };
  };
}
