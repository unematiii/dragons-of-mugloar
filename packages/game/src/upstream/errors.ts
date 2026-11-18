export interface UpstreamRequestContext {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly statusText?: string;
}

export interface UpstreamErrorOptions extends ErrorOptions {
  readonly request?: UpstreamRequestContext;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | undefined,
    readonly raw: unknown,
    options?: UpstreamErrorOptions,
  ) {
    super(message, options);
    this.name = 'UpstreamError';
    this.request = options?.request;
  }

  readonly request: UpstreamRequestContext | undefined;
}

export class UpstreamGameNotFoundError extends UpstreamError {
  constructor(error: UpstreamError) {
    super(error.message, error.statusCode, error.raw, {
      cause: error,
      ...(error.request === undefined ? {} : { request: error.request }),
    });
    this.name = 'UpstreamGameNotFoundError';
  }
}
