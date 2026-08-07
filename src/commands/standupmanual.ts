import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { postDailyStandup } from '../standup/scheduler';

export const standupManualCommand = {
  data: new SlashCommandBuilder()
    .setName('standup-manual')
    .setDescription("Post today's standup prompt now (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.editReply('Error: Administrator permission required.');
      return;
    }

    const threadId = await postDailyStandup(interaction.client);
    if (threadId) {
      await interaction.editReply(`Success: Standup posted. Thread: <#${threadId}>`);
    } else {
      await interaction.editReply("Today's standup has already been posted.");
    }
  },
};
