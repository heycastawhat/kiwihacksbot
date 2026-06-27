import { Client } from 'discord.js';

export function handleReady(client: Client): void {
  console.log(`Logged in as ${client.user?.tag}`);
  console.log(`    Watching channel : ${process.env.SUBMISSION_CHANNEL_ID ?? '(hardcoded)'}`);
}
