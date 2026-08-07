import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { getStandupDay, endStandupDay } from '../db';
import { todayInTz } from '../standup/scheduler';

export const standupEndCommand = {
  data: new SlashCommandBuilder()
    .setName('standup-end')
    .setDescription("Stop today's standup reminders/escalations (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.editReply('Error: Administrator permission required.');
      return;
    }

    const day = await getStandupDay(todayInTz());
    if (!day) {
      await interaction.editReply('Error: No standup has been posted today.');
      return;
    }
    if (day.ended_at) {
      await interaction.editReply("Today's standup reminders were already stopped.");
      return;
    }

    await endStandupDay(day.id);
    await interaction.editReply('Success: Stopped hourly reminders and escalations for today.');
  },
};
