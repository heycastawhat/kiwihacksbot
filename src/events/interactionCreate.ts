import {
  Interaction,
  Collection,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
  TextChannel,
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

  // ── Modals ───────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('addrmodal_')) {
      const opsChannelId = interaction.customId.replace('addrmodal_', '');
      const address = interaction.fields.getTextInputValue('addressInput');
      
      try {
        const opsChannel = await interaction.client.channels.fetch(opsChannelId) as TextChannel;
        await opsChannel.send({
          content: `Address received from <@${interaction.user.id}>:\n\`\`\`\n${address}\n\`\`\``
        });
        await interaction.reply({ content: 'Thank you! Your address has been sent.', ephemeral: true });
      } catch {
        await interaction.reply({ content: 'Error: Could not deliver address to the ops channel.', ephemeral: true });
      }
    }
  }
}

async function handleVoteButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId.startsWith('reqaddr_') || interaction.customId.startsWith('address_')) {
    const prefix = interaction.customId.startsWith('reqaddr_') ? 'reqaddr_' : 'address_';
    const userId = interaction.customId.replace(prefix, '');
    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) {
      await interaction.reply({ content: 'Error: Could not find that user.', ephemeral: true });
      return;
    }
    const dmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`provaddr_${interaction.channelId}`)
        .setLabel('Provide Address')
        .setStyle(ButtonStyle.Primary)
    );
    try {
      await user.send({
        content: 'Congratulations on winning! The ops team needs your shipping address.',
        components: [dmRow]
      });
      await interaction.reply({ content: 'Address request sent to user.', ephemeral: true });
    } catch {
      await interaction.reply({ content: 'Error: Could not DM the user (DMs might be closed).', ephemeral: true });
    }
    return;
  }

  if (interaction.customId.startsWith('provaddr_')) {
    const opsChannelId = interaction.customId.replace('provaddr_', '');
    const modal = new ModalBuilder()
      .setCustomId(`addrmodal_${opsChannelId}`)
      .setTitle('Shipping Address');
      
    const addressInput = new TextInputBuilder()
      .setCustomId('addressInput')
      .setLabel('Enter your full address')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);
      
    const actionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(addressInput);
    modal.addComponents(actionRow);
    
    await interaction.showModal(modal);
    return;
  }

  if (!interaction.customId.startsWith('vote_')) return;

  const submissionId = interaction.customId.slice('vote_'.length);
  if (!submissionId) return;

  // Reject votes outside an active session
  const session = await getActiveVotingSession();
  if (!session) {
    await interaction.reply({
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
  await interaction.update({ components: [row] });
}
