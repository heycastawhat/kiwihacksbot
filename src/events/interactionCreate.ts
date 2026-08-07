import {
  Interaction,
  Collection,
  ButtonInteraction,
  TextChannel,
  MessageFlags,
} from 'discord.js';
import { getSubmissionByMessageId, createSubmission } from '../db';
import { config } from '../config';
import { missingRequirements, displayNameOf } from '../submissionRules';

export async function handleInteractionCreate(
  interaction: Interaction,
  commands: Collection<string, any>,
): Promise<void> {
  // ── Slash commands ───────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[command:${interaction.commandName}]`, err);
      const payload = { content: 'Error: Something went wrong. Please try again.', flags: MessageFlags.Ephemeral } as const;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
    return;
  }

  // ── Ship confirmation buttons ────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('shipconfirm_')) {
    await handleShipConfirm(interaction);
  }
}

async function handleShipConfirm(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const isYes = interaction.customId.startsWith('shipconfirm_yes_');
  const messageId = interaction.customId.replace(isYes ? 'shipconfirm_yes_' : 'shipconfirm_no_', '');

  let original;
  try {
    const parentChannel = (interaction.channel as any)?.parent as TextChannel;
    original = await parentChannel.messages.fetch(messageId);
  } catch {
    await interaction.editReply({ content: 'Error: Could not find the original post.', components: [] });
    return;
  }

  if (interaction.user.id !== original.author.id) {
    await interaction.followUp({ content: 'Only the original poster can confirm this.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (!isYes) {
    await interaction.editReply({ content: "No worries — this post won't be entered for voting.", components: [] });
    return;
  }

  // Leave the buttons in place so they can edit the post and hit Yes again
  const missing = missingRequirements(original);
  if (missing.length > 0) {
    await interaction.followUp({
      content: `Your post needs ${missing.join(' and ')} before it can be entered. Add it to the post, then hit Yes again.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = await getSubmissionByMessageId(messageId);
  if (existing) {
    await interaction.editReply({ content: 'This post is already confirmed for voting!', components: [] });
    return;
  }

  const now = new Date();
  const description = original.content || 'No description provided';

  await createSubmission(
    original.author.id,
    displayNameOf(original),
    original.id,
    original.channelId,
    description,
    now.getMonth() + 1,
    now.getFullYear(),
  );

  try {
    await original.react(config.voteEmoji);
  } catch (e) {
    console.log('[shipconfirm] failed to seed vote reaction:', e);
  }

  try {
    // submission is the join key back to submissions.message_id — unique per ship post, so a
    // second project from the same person stays distinguishable. discord_id is for fulfilment.
    const filloutUrl =
      `${config.filloutFormUrl}?submission=${original.id}` +
      `&discord_id=${original.author.id}` +
      `&discord=${encodeURIComponent(displayNameOf(original))}`;
    await original.author.send(
      `Nice ship! Fill out this form with your project details and we might mail you a free KiwiHacks sticker too: ${filloutUrl}`,
    );
  } catch (e) {
    console.log('[shipconfirm] failed to DM fillout link:', e);
  }

  await interaction.editReply({
    content: `Submission confirmed! React with ${config.voteEmoji} on the original post to vote.`,
    components: [],
  });
}
