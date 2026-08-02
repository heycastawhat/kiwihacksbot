import cron from 'node-cron';
import { Client, TextChannel, ThreadChannel, PermissionsBitField } from 'discord.js';
import { config } from '../config';
import { getStandupDay, createStandupDay, getStandupResponders } from '../db';

export function todayInTz(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.standupTimezone }).format(new Date());
}

function currentHourInTz(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: config.standupTimezone, hour: 'numeric', hour12: false }).format(new Date()),
  );
}

async function getRequiredMemberIds(channel: TextChannel): Promise<string[]> {
  const members = await channel.guild.members.fetch();
  return members
    .filter(
      (m) =>
        !m.user.bot &&
        !config.standupExcludedUserIds.includes(m.id) &&
        channel.permissionsFor(m)?.has(PermissionsBitField.Flags.ViewChannel),
    )
    .map((m) => m.id);
}

export async function postDailyStandup(client: Client): Promise<string | null> {
  const date = todayInTz();
  if (await getStandupDay(date)) return null; // already posted today

  const channel = (await client.channels.fetch(config.standupChannelId)) as TextChannel;
  if (!channel) return null;

  const required = await getRequiredMemberIds(channel);
  const mentions = required.map((id) => `<@${id}>`).join(' ');

  const message = await channel.send(
    `Gooooooooood morning ${mentions}!\n\n` +
      `Stand ups!\n` +
      `- What did you get done yesterday\n` +
      `- What you want to get done today\n\n` +
      `Bullet points will suffice.\n\n` +
      `*If you didn't do anything yesterday and/or won't get anything done today that's fine! ` +
      `Please just say so & why you won't get anything done instead of not replying.*`,
  );

  const thread = await message.startThread({
    name: `Standup - ${date}`,
    autoArchiveDuration: 1440,
  });

  await createStandupDay(date, channel.id, thread.id);
  return thread.id;
}

// Resolves the active thread and the still-outstanding member ids, or null if there's nothing to chase.
async function getOutstanding(client: Client): Promise<{ thread: ThreadChannel; remaining: string[] } | null> {
  const day = await getStandupDay(todayInTz());
  if (!day || day.ended_at) return null; // no standup today, or ended manually

  const channel = (await client.channels.fetch(config.standupChannelId)) as TextChannel;
  if (!channel) return null;

  const thread = (await client.channels.fetch(day.thread_id).catch(() => null)) as ThreadChannel | null;
  if (!thread) return null;

  const required = await getRequiredMemberIds(channel);
  const responded = new Set(await getStandupResponders(thread.id));
  const remaining = required.filter((id) => !responded.has(id));
  if (remaining.length === 0) return null;

  return { thread, remaining };
}

async function bumpStandup(client: Client): Promise<void> {
  const outstanding = await getOutstanding(client);
  if (!outstanding) return;

  const mentions = outstanding.remaining.map((id) => `<@${id}>`).join(' ');
  await outstanding.thread.send(
    `${mentions} - still need your standup update. *Keep in mind saying why you're not able to do stuff if you are busy is an update!*`,
  );
}

export function startStandupScheduler(client: Client): void {
  cron.schedule(`0 ${config.standupHour} * * *`, () => postDailyStandup(client).catch(console.error), {
    timezone: config.standupTimezone,
  });

  cron.schedule(
    '0 */2 * * *',
    () => {
      if (currentHourInTz() === config.standupHour) return; // skip the hour the daily prompt itself goes out
      bumpStandup(client).catch(console.error);
    },
    { timezone: config.standupTimezone },
  );
}
