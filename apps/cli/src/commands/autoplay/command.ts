import { Command, InvalidArgumentError } from 'commander';

import { runAutoplayGames } from './run-autoplay.js';

function parseGameCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 100)
    throw new InvalidArgumentError('Expected an integer from 1 to 100');

  return count;
}

export const autoplayCommand = new Command('autoplay')
  .description('Play one or more games automatically')
  .option('-g, --games <count>', 'number of independent games to run (1–100)', parseGameCount, 1)
  .action(async (options: { readonly games: number }) => runAutoplayGames(options.games));
