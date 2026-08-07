import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { handleReady } from './events/ready';
import {
  handleMessageReactionAdd,
  handleMessageReactionRemove,
  handleReactionsCleared,
  reconcileVotes,
} from './events/messageReaction';
import { handleMessageCreate } from './events/messageCreate';
import { handleInteractionCreate } from './events/interactionCreate';
import { endVotingCommand } from './commands/endvoting';
import { standupManualCommand } from './commands/standupmanual';
import { standupEndCommand } from './commands/standupend';
import { startStandupScheduler } from './standup/scheduler';

// ─── Client ───────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
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
    Partials.User,
  ],
});

// ─── Commands ─────────────────────────────────────────────────────────────────

const commands = new Collection<string, any>();
commands.set(endVotingCommand.data.name, endVotingCommand);
commands.set(standupManualCommand.data.name, standupManualCommand);
commands.set(standupEndCommand.data.name, standupEndCommand);

// ─── Events ───────────────────────────────────────────────────────────────────

client.once('clientReady', () => {
  handleReady(client);
  startStandupScheduler(client);
  reconcileVotes(client).catch((e) => console.error('[reconcile] failed:', e));
});

client.on('messageReactionAdd', handleMessageReactionAdd);

client.on('messageReactionRemove', handleMessageReactionRemove);

client.on('messageReactionRemoveAll', (message) =>
  handleReactionsCleared(message).catch((e) => console.error('[reaction] clear-all failed:', e)),
);

client.on('messageReactionRemoveEmoji', (reaction) => {
  if (reaction.emoji.name !== config.voteEmoji) return;
  handleReactionsCleared(reaction.message).catch((e) =>
    console.error('[reaction] clear-emoji failed:', e),
  );
});

client.on('messageCreate', handleMessageCreate);

client.on('interactionCreate', (interaction) =>
  handleInteractionCreate(interaction, commands),
);

client.on('error', (e) => console.error('[client]', e));

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

// ─── Boot ─────────────────────────────────────────────────────────────────────

client.login(config.token);
