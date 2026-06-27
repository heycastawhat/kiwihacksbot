import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config';
import {
  getTopSubmissions,
  closeAllActiveSubmissions,
} from '../db';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MEDALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
const PLACE_COLORS = [0xffd700, 0xc0c0c0, 0xcd7f32]; // gold, silver, bronze

export const endVotingCommand = {
  data: new SlashCommandBuilder()
    .setName('endvoting')
    .setDescription('Close voting and post results to the ops server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // Ops guild only
    if (interaction.guildId !== config.opsGuildId) {
      await interaction.editReply({
        content: 'Error: This command can only be used in the ops server.',
      });
      return;
    }

    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.editReply({
        content: 'Error: Administrator permission required.',
      });
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const top = await getTopSubmissions(month, year, 10);
    if (top.length === 0) {
      await interaction.editReply('Error: No submissions found for this session.');
      return;
    }

    // ── Fetch the ops channel ─────────────────────────────────────────────────
    let opsChannel: TextChannel;
    try {
      const opsGuild = await interaction.client.guilds.fetch(config.opsGuildId);
      opsChannel = (await opsGuild.channels.fetch(config.opsChannelId)) as TextChannel;
    } catch {
      await interaction.editReply('Error: Could not reach the ops server / channel.');
      return;
    }

    const monthName = MONTH_NAMES[month - 1];
    const count = Math.min(top.length, 10);

    // ── Header ────────────────────────────────────────────────────────────────
    await opsChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle(`${monthName} ${year} - Top ${count} Projects`)
          .setDescription(
            `Voting has closed! Here are the top **${count}** projects for ${monthName} ${year}.\n` +
            `Total votes cast across all projects: **${top.reduce((a, s) => a + s.vote_count, 0)}**`,
          )
          .setTimestamp(),
      ],
    });

    // ── One embed per winner ──────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const sub = top[i];
      const medal = MEDALS[i] ?? `${i + 1}.`;
      const color = PLACE_COLORS[i] ?? 0x5865f2;

      let imageUrl = null;
      try {
        const submitChannel = await interaction.client.channels.fetch(sub.channel_id) as any;
        const originalMsg = await submitChannel.messages.fetch(sub.message_id);
        const attachment = originalMsg.attachments.first();
        if (attachment && attachment.contentType?.startsWith('image/')) {
          imageUrl = attachment.url;
        }
      } catch (e) {
        // Message deleted or inaccessible
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${medal} ${sub.project_name}`)
        .setDescription(sub.description!);
      
      if (imageUrl) embed.setImage(imageUrl);
      
      embed.addFields(
          { name: 'Submitted by', value: `<@${sub.user_id}>`, inline: true },
          { name: 'Discord ID',   value: sub.user_id,          inline: true },
          { name: 'Votes',        value: String(sub.vote_count), inline: true },
          { name: 'GitHub',       value: sub.github_link || 'Not provided', inline: false },
          { name: 'Address',      value: sub.address || 'No address provided', inline: false }
        )
        .setFooter({ text: `Submission ID: ${sub.id}` });

      await opsChannel.send({ embeds: [embed] });
    }

    await closeAllActiveSubmissions(month, year);

    await interaction.editReply(
      `Success: Voting closed. Top ${count} results posted to the ops server.`,
    );
  },
};
