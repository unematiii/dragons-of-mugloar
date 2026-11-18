import { Command } from 'commander';

import { autoplayCommand, manualPlayCommand } from './commands/index.js';

const program = new Command();
program.name('mugloar').description('Play Dragons of Mugloar games');

program.addCommand(autoplayCommand);
program.addCommand(manualPlayCommand);

try {
  await program.parseAsync(process.argv);
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
