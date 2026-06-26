import {
  Interaction,
  Collection,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { hasVoted, addVote, removeVote, getVoteCount, getActiveVotingSession } from '../db';

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
      const payload = { content: '❌ Something went wrong. Please try again.', ephemeral: true };
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
  if (!interaction.customId.startsWith('vote_')) return;

  const submissionId = parseInt(interaction.customId.slice('vote_'.length), 10);
  if (isNaN(submissionId)) return;

  // Reject votes outside an active session
  const session = getActiveVotingSession();
  if (!session) {
    await interaction.reply({
      content: '❌ Voting is not currently open.',
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const alreadyVoted = hasVoted(userId, submissionId);

  if (alreadyVoted) {
    removeVote(userId, submissionId);
  } else {
    addVote(userId, submissionId);
  }

  const newCount = getVoteCount(submissionId);
  const nowVoted = !alreadyVoted;

  // Update the button label + style to reflect the new state
  const updatedButton = new ButtonBuilder()
    .setCustomId(`vote_${submissionId}`)
    .setLabel(`⭐ Vote (${newCount})`)
    .setStyle(nowVoted ? ButtonStyle.Success : ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(updatedButton);

  // Update the message in place — no separate reply needed
  await interaction.update({ components: [row] });
}
