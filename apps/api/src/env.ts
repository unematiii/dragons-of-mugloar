import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const EnvironmentSchema = Type.Object({
  API_PORT: Type.Optional(Type.String({ pattern: '^[0-9]{1,5}$' })),
  DATABASE_URL: Type.String({ minLength: 1 }),
  NODE_ENV: Type.Optional(
    Type.Union([Type.Literal('development'), Type.Literal('test'), Type.Literal('production')]),
  ),
  SESSION_COOKIE_SECURE: Type.Optional(Type.Union([Type.Literal('true'), Type.Literal('false')])),
  UPSTREAM_BASE_URL: Type.String({ minLength: 1 }),
});

export type Environment = Static<typeof EnvironmentSchema>;

export function loadEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const candidate = {
    API_PORT: input['API_PORT'],
    DATABASE_URL: input['DATABASE_URL'],
    NODE_ENV: input['NODE_ENV'],
    SESSION_COOKIE_SECURE: input['SESSION_COOKIE_SECURE'],
    UPSTREAM_BASE_URL: input['UPSTREAM_BASE_URL'],
  };

  if (!Value.Check(EnvironmentSchema, candidate)) {
    throw new Error('Invalid runtime environment configuration');
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(candidate.UPSTREAM_BASE_URL);
  } catch {
    throw new Error('UPSTREAM_BASE_URL must be an absolute HTTP URL');
  }

  if (upstreamUrl.protocol !== 'http:' && upstreamUrl.protocol !== 'https:') {
    throw new Error('UPSTREAM_BASE_URL must use HTTP or HTTPS');
  }

  return candidate;
}
