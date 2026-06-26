import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config';
import {
  getActiveVotingSession,
  closeVotingSession,
  getTopSubmissions,
} from '../db';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
const PLACE_COLORS = [0xffd700, 0xc0c0c0, 0xcd7f32]; // gold, silver, bronze

export const endVotingCommand = {
  data: new SlashCommandBuilder()
    .setName('endvoting')
    .setDescription('Close voting and post results to the ops server (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ Administrator permission required.',
        ephemeral: true,
      });
      return;
    }

    const session = getActiveVotingSession();
    if (!session) {
      await interaction.reply({
        content: '❌ No active voting session found. Run `/startvoting` first.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const top = getTopSubmissions(session.month, session.year, 10);
    if (top.length === 0) {
      await interaction.editReply('❌ No submissions found for this session.');
      return;
    }

    // Close the session before posting so late votes don't slip through
    closeVotingSession(session.id);

    // ── Fetch the ops channel ─────────────────────────────────────────────────
    let opsChannel: TextChannel;
    try {
      const opsGuild = await interaction.client.guilds.fetch(config.opsGuildId);
      opsChannel = (await opsGuild.channels.fetch(config.opsChannelId)) as TextChannel;
    } catch {
      await interaction.editReply('❌ Could not reach the ops server / channel.');
      return;
    }

    const monthName = MONTH_NAMES[session.month - 1];
    const year = session.year;
    const count = Math.min(top.length, 10);

    // ── Header ────────────────────────────────────────────────────────────────
    await opsChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle(`🏆 ${monthName} ${year} — Top ${count} Projects`)
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

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${medal} ${sub.project_name}`)
        .setDescription(sub.description!)
        .addFields(
          { name: '👤 Submitted by', value: `@${sub.username}`, inline: true },
          { name: '🆔 Discord ID',   value: sub.user_id,          inline: true },
          { name: '⭐ Votes',         value: String(sub.vote_count), inline: true },
        )
        .setFooter({ text: `Submission ID: ${sub.id}` });

      await opsChannel.send({ embeds: [embed] });
    }

    await interaction.editReply(
      `✅ Voting closed. Top ${count} results posted to the ops server.`,
    );
  },
};
