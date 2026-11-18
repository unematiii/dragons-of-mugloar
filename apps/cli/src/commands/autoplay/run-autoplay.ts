import { createDatabase, createPlayer } from '@mugloar/db';

import { runAutoplayGame } from './game-runner.js';

export async function runAutoplayGames(gameCount: number): Promise<void> {
  const baseUrl = process.env['UPSTREAM_BASE_URL'];
  if (baseUrl === undefined || baseUrl.length === 0)
    throw new Error('Set UPSTREAM_BASE_URL before running autoplay');

  const databaseUrl = process.env['DATABASE_URL'];
  if (databaseUrl === undefined || databaseUrl.length === 0)
    throw new Error('Set DATABASE_URL; CLI games are always saved to PostgreSQL');

  const { db, pool } = createDatabase(databaseUrl);

  try {
    const player = await createPlayer(db);
    // Sequential games avoid starting multiple upstream games at once.
    for (let index = 0; index < gameCount; index += 1)
      await runAutoplayGame(baseUrl, db, player.id);
  } finally {
    await pool.end();
  }
}
