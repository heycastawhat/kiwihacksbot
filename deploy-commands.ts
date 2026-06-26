/**
 * Run this once to register slash commands with Discord.
 *   npm run deploy
 *
 * Commands are registered to both the submission guild and the ops guild
 * so admins in either server can run /startvoting and /endvoting.
 */

import { REST, Routes } from 'discord.js';
import { config } from './src/config';
import { startVotingCommand } from './src/commands/startvoting';
import { endVotingCommand } from './src/commands/endvoting';

const commandBodies = [
  startVotingCommand.data.toJSON(),
  endVotingCommand.data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('Registering slash commands…');

    for (const guildId of [config.submissionGuildId, config.opsGuildId]) {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, guildId),
        { body: commandBodies },
      );
      console.log(`  ✅ Registered to guild ${guildId}`);
    }

    console.log('Done!');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
