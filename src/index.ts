import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { handleReady } from './events/ready';
import { handleMessageReactionAdd } from './events/messageReactionAdd';
import { handleMessageCreate } from './events/messageCreate';
import { handleInteractionCreate } from './events/interactionCreate';
import { startVotingCommand } from './commands/startvoting';
import { endVotingCommand } from './commands/endvoting';

// ─── Client ───────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    // Required to receive reactions on older/uncached messages
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
  ],
});

// ─── Commands ─────────────────────────────────────────────────────────────────

const commands = new Collection<string, any>();
commands.set(startVotingCommand.data.name, startVotingCommand);
commands.set(endVotingCommand.data.name, endVotingCommand);

// ─── Events ───────────────────────────────────────────────────────────────────

client.once('clientReady', () => handleReady(client));

client.on('messageReactionAdd', handleMessageReactionAdd);

client.on('messageCreate', handleMessageCreate);

client.on('interactionCreate', (interaction) =>
  handleInteractionCreate(interaction, commands),
);

// Raw gateway debug — remove once reactions are confirmed working
client.on('raw', (packet: any) => {
  if (packet.t === 'MESSAGE_REACTION_ADD') {
    console.log('[RAW REACTION]', JSON.stringify(packet.d));
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

client.login(config.token);
