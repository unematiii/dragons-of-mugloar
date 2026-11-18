import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createUpstreamClient, UpstreamError } from '../src/index.js';

// Synthetic contract fixture; it is not live game evidence.
const messagesFixture: unknown = JSON.parse(
  await readFile(new URL('./fixtures/messages.json', import.meta.url), 'utf8'),
);

void test('normalizes plain and mode-1 messages while preserving raw values', async () => {
  const client = createUpstreamClient({
    baseUrl: 'https://dragonsofmugloar.com/api/v2',
    fetcher: () => Promise.resolve(new Response(JSON.stringify(messagesFixture), { status: 200 })),
  });

  const response = await client.getMessages('game/id');

  assert.equal(response.value.length, 2);
  assert.deepEqual(response.value[0], {
    adId: '0123',
    rawAdId: 'MDEyMw==',
    decodedAdId: '0123',
    message: 'Hello',
    rawMessage: 'SGVsbG8=',
    reward: 100,
    expiresIn: 3,
    probability: 'Sure thing',
    rawProbability: 'U3VyZSB0aGluZw==',
    encrypted: 1,
    encoding: 'base64-mode-1',
    decoding: 'decoded',
    raw: {
      adId: 'MDEyMw==',
      message: 'SGVsbG8=',
      reward: '100',
      expiresIn: 3,
      probability: 'U3VyZSB0aGluZw==',
      encrypted: 1,
    },
  });
  assert.equal(response.value[1]?.message, 'A plain task');
  assert.equal(response.value[1]?.encoding, 'plain');
  assert.deepEqual(response.raw, messagesFixture);
});

void test('decodes ROT13 tasks marked as encrypted mode 2 and preserves raw fields', async () => {
  const payload = {
    messages: [
      {
        adId: 'pHkHgB5o',
        message:
          'Xvyy Tvagneė Fgnvagubecr jvgu cna naq znxr Yroeba Ehttyrf sebz pnfgyr va Fgebatsver gb gnxr gur oynzr',
        reward: 148,
        expiresIn: 1,
        probability: 'Cynlvat jvgu sver',
        encrypted: 2,
      },
    ],
  };
  const sourceTask = payload.messages[0];
  assert.ok(sourceTask);

  const client = createUpstreamClient({
    baseUrl: 'https://dragonsofmugloar.com/api/v2',
    fetcher: () => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })),
  });

  const response = await client.getMessages('game-1');
  const task = response.value[0];

  assert.ok(task);
  assert.equal(task.encoding, 'rot13-mode-2');
  assert.equal(task.decoding, 'decoded');
  assert.equal(task.adId, 'cUxUtO5b');
  assert.equal(task.decodedAdId, 'cUxUtO5b');
  assert.equal(
    task.message,
    'Kill Gintarė Stainthorpe with pan and make Lebron Ruggles from castle in Strongfire to take the blame',
  );
  assert.equal(task.probability, 'Playing with fire');
  assert.equal(task.rawMessage, sourceTask.message);
  assert.equal(task.rawProbability, sourceTask.probability);
});

void test('keeps encrypted tasks unsupported when no candidate passes text validation', async () => {
  const payload = {
    messages: [
      {
        adId: 'not-base64!',
        message: 'xqzv jklp qwrty',
        reward: 10,
        expiresIn: 2,
        probability: 'qzxv kplm',
        encrypted: 1,
      },
    ],
  };
  const sourceTask = payload.messages[0];
  assert.ok(sourceTask);

  const client = createUpstreamClient({
    baseUrl: 'https://dragonsofmugloar.com/api/v2',
    fetcher: () => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })),
  });

  const response = await client.getMessages('game-1');
  const task = response.value[0];

  assert.ok(task);
  assert.equal(task.encoding, 'unsupported');
  assert.equal(task.decoding, 'failed');
  assert.equal(task.message, sourceTask.message);
  assert.equal(task.probability, sourceTask.probability);
});

void test('retains invalid response bodies in contract errors', async () => {
  const payload: unknown = { gameId: 'game-1', lives: 'three' };
  const client = createUpstreamClient({
    baseUrl: 'https://dragonsofmugloar.com/api/v2',
    fetcher: () => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })),
  });

  await assert.rejects(client.startGame(), (error: unknown) => {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.statusCode, 200);
    assert.deepEqual(error.raw, payload);

    return true;
  });
});

void test('retains non-JSON upstream response evidence', async () => {
  const body = '<!DOCTYPE html><title>Bad gateway</title>';
  const client = createUpstreamClient({
    baseUrl: 'https://dragonsofmugloar.com/api/v2',
    fetcher: () =>
      Promise.resolve(
        new Response(body, {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
      ),
  });

  await assert.rejects(client.solve('game-1', 'ad-1'), (error: unknown) => {
    assert.ok(error instanceof UpstreamError);
    assert.equal(error.statusCode, 502);
    assert.deepEqual(error.raw, { contentType: 'text/html', body, truncated: false });

    return true;
  });
});
