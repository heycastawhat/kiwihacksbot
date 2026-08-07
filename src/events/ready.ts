import { Client } from 'discord.js';
import { config } from '../config';

export function handleReady(client: Client): void {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log(`    Watching #ship   : ${config.submissionChannelId}`);
}
