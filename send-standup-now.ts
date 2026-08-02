/**
 * One-off: post today's standup prompt right now (skips waiting for the 10am cron).
 * No-ops if today's standup was already posted.
 *   npx ts-node send-standup-now.ts
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './src/config';
import { postDailyStandup } from './src/standup/scheduler';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
});

client.once('clientReady', async () => {
  try {
    await postDailyStandup(client);
    console.log('Done!');
  } catch (err) {
    console.error(err);
  } finally {
    client.destroy();
  }
});

client.login(config.token);
