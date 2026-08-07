import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config';
import { addStandupResponse } from '../db';
import { missingRequirements, displayNameOf } from '../submissionRules';

const MAX_PREVIEW = 1500;

// A deleted message is unrecoverable, so hand the text back before removing it. Attachments
// can't be returned this way — the CDN links die with the message.
async function returnAndDelete(message: Message, missing: string[]): Promise<void> {
  const text = message.content.trim();
  const preview = text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}…` : text;

  try {
    await message.author.send(
      `Your post in <#${message.channelId}> was removed — ship posts need ${missing.join(' and ')}.\n` +
        `Post it again with both and it'll go through.` +
        (preview ? `\n\nYour text, so you don't lose it:\n>>> ${preview}` : ''),
    );
  } catch (e) {
    console.log('[messageCreate] failed to DM removal notice:', e);
  }

  try {
    await message.delete();
  } catch (e) {
    console.log('[messageCreate] failed to delete non-conforming post:', e);
  }
}

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot) return;

  if (message.channel.isThread() && message.channel.parentId === config.standupChannelId) {
    await addStandupResponse(message.channelId, message.author.id);
    return;
  }

  // Ops channel included so the flow can be demoed without posting in #ship
  if (![config.submissionChannelId, config.opsChannelId].includes(message.channelId)) return;

  // Enforced in #ship only — the ops channel is a demo/chatter space and must never be pruned
  if (message.channelId === config.submissionChannelId) {
    const missing = missingRequirements(message);
    if (missing.length > 0) {
      await returnAndDelete(message, missing);
      return;
    }
  }

  let thread;
  try {
    thread = await message.startThread({
      name: `${displayNameOf(message)}'s Project`,
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
    content:
      'Do you want to make this a submission post for voting?\n' +
      'Entries need an image or screenshot attached, plus at least one link.',
    components: [row],
  });
}
