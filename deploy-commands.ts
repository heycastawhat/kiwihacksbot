/**
 * Run this once to register slash commands with Discord.
 *   npm run deploy
 *
 * Voting commands register to the ops guild. Standup commands register to the
 * guild that owns the standup channel (resolved at runtime), plus the ops guild.
 */

import { REST, Routes } from 'discord.js';
import { config } from './src/config';
import { endVotingCommand } from './src/commands/endvoting';
import { standupManualCommand } from './src/commands/standupmanual';
import { standupEndCommand } from './src/commands/standupend';

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('Registering slash commands…');

    // Which guild owns the standup channel?
    const channel = (await rest.get(Routes.channel(config.standupChannelId))) as { guild_id?: string };
    const standupGuildId = channel.guild_id;

    await rest.put(Routes.applicationGuildCommands(config.clientId, config.opsGuildId), {
      body: [
        endVotingCommand.data.toJSON(),
        standupManualCommand.data.toJSON(),
        standupEndCommand.data.toJSON(),
      ],
    });
    console.log(`  ✅ Registered to ops guild ${config.opsGuildId}`);

    if (standupGuildId && standupGuildId !== config.opsGuildId) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, standupGuildId), {
        body: [standupManualCommand.data.toJSON(), standupEndCommand.data.toJSON()],
      });
      console.log(`  ✅ Registered standup commands to guild ${standupGuildId}`);
    }

    console.log('Done!');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
