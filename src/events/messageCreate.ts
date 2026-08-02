import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config';
import { addStandupResponse } from '../db';

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;

  if (message.channel.isThread() && message.channel.parentId === config.standupChannelId) {
    await addStandupResponse(message.channelId, message.author.id);
    return;
  }

  // Ops channel included so the flow can be demoed without posting in #ship
  if (![config.submissionChannelId, config.opsChannelId].includes(message.channelId)) return;

  let thread;
  try {
    thread = await message.startThread({
      name: `${message.author.username}'s Project`,
      autoArchiveDuration: 1440,
    });
  } catch (e) {
    console.log('[messageCreate] failed to create thread:', e);
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`shipconfirm_yes_${message.id}`)
      .setLabel('Yes')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`shipconfirm_no_${message.id}`)
      .setLabel('No')
      .setStyle(ButtonStyle.Secondary),
  );

  await thread.send({
    content: 'Do you want to make this a submission post for voting?',
    components: [row],
  });
}
