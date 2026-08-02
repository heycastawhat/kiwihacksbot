import {
  Interaction,
  Collection,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { hasVoted, addVote, removeVote, getVoteCount, getActiveVotingSession, getSubmissionByMessageId, createSubmission } from '../db';
import { config } from '../config';

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
      const payload = { content: 'Error: Something went wrong. Please try again.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
    return;
  }

  // ── Vote buttons ─────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    await handleVoteButton(interaction);
  }
}

async function handleVoteButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId.startsWith('shipconfirm_yes_') || interaction.customId.startsWith('shipconfirm_no_')) {
    await handleShipConfirm(interaction);
    return;
  }

  if (!interaction.customId.startsWith('vote_')) return;

  const submissionId = interaction.customId.slice('vote_'.length);
  if (!submissionId) return;

  await interaction.deferUpdate();

  // Reject votes outside an active session
  const session = await getActiveVotingSession();
  if (!session) {
    await interaction.followUp({
      content: 'Error: Voting is not currently open.',
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const alreadyVoted = await hasVoted(userId, submissionId);

  if (alreadyVoted) {
    await removeVote(userId, submissionId);
  } else {
    await addVote(userId, submissionId);
  }

  const nowVoted = !alreadyVoted;

  // Update the button label + style to reflect the new state
  const newButton = new ButtonBuilder()
    .setCustomId(`vote_${submissionId}`)
    .setLabel(nowVoted ? 'Voted' : 'Vote')
    .setStyle(nowVoted ? ButtonStyle.Success : ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(newButton);

  // Update the message in place — no separate reply needed
  await interaction.editReply({ components: [row] });
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
    await interaction.followUp({ content: 'Only the original poster can confirm this.', ephemeral: true });
    return;
  }

  if (!isYes) {
    await interaction.editReply({ content: "No worries — this post won't be entered for voting.", components: [] });
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
    original.author.username,
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
    const filloutUrl = `${config.filloutFormUrl}?discord=${encodeURIComponent(original.author.username)}`;
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
