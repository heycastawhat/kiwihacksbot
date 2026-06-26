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
  getActiveSubmissions,
  getActiveVotingSession,
  createVotingSession,
  createVotingMessage,
  getVoteCount,
} from '../db';

export const startVotingCommand = {
  data: new SlashCommandBuilder()
    .setName('startvoting')
    .setDescription('Open the monthly voting phase (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Ops guild only
    if (interaction.guildId !== config.opsGuildId) {
      await interaction.reply({
        content: '❌ This command can only be used in the ops server.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ Administrator permission required.',
        ephemeral: true,
      });
      return;
    }

    // Guard: only one active session at a time
    const existingSession = getActiveVotingSession();
    if (existingSession) {
      await interaction.reply({
        content:
          '❌ There is already an active voting session. Run `/endvoting` first.',
        ephemeral: true,
      });
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const submissions = getActiveSubmissions(month, year);
    if (submissions.length === 0) {
      await interaction.reply({
        content: '❌ No active submissions found for this month.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const sessionId = createVotingSession(month, year);

    const channel = interaction.client.channels.cache.get(
      config.submissionChannelId,
    ) as TextChannel | undefined;

    if (!channel) {
      await interaction.editReply('❌ Could not find the submission channel.');
      return;
    }

    const MONTH_NAMES = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ];

    // ── Header ────────────────────────────────────────────────────────────────
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🗳️ ${MONTH_NAMES[month - 1]} ${year} — Voting is Open!`)
          .setDescription(
            `Time to vote for your favourite projects this month!\n\n` +
            `Hit the **⭐ Vote** button on any project to cast your vote. ` +
            `You can vote for as many projects as you like — **one vote per project**.\n\n` +
            `**${submissions.length} project${submissions.length !== 1 ? 's' : ''}** up for voting:`,
          )
          .setTimestamp(),
      ],
    });

    // ── One embed + button per project ────────────────────────────────────────
    for (const sub of submissions) {
      const voteCount = getVoteCount(sub.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: `Submitted by @${sub.username}` })
        .setTitle(sub.project_name!)
        .setDescription(sub.description!)
        .setFooter({ text: `Project #${sub.id}` });

      const button = new ButtonBuilder()
        .setCustomId(`vote_${sub.id}`)
        .setLabel(`⭐ Vote (${voteCount})`)
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      const msg = await channel.send({ embeds: [embed], components: [row] });
      createVotingMessage(sub.id, msg.id, sessionId);
    }

    await interaction.editReply(
      `✅ Voting started! ${submissions.length} project${submissions.length !== 1 ? 's' : ''} posted to <#${config.submissionChannelId}>.`,
    );
  },
};
