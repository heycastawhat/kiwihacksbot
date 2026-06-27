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

    // Guard: only one active session at a time
    const existingSession = await getActiveVotingSession();
    if (existingSession) {
      await interaction.editReply({
        content:
          'Error: There is already an active voting session. Run `/endvoting` first.',
      });
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const submissions = await getActiveSubmissions(month, year);
    if (submissions.length === 0) {
      await interaction.editReply({
        content: 'Error: No active submissions found for this month.',
      });
      return;
    }

    const sessionId = await createVotingSession(month, year);

    let channel: TextChannel;
    try {
      channel = (await interaction.client.channels.fetch(
        config.submissionChannelId,
      )) as TextChannel;
    } catch {
      channel = interaction.channel as TextChannel;
    }
    
    if (!channel) {
      await interaction.editReply('Error: Could not find the submission channel.');
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
          .setTitle(`${MONTH_NAMES[month - 1]} ${year} - Voting is Open!`)
          .setDescription(
            `Time to vote for your favourite projects this month!\n\n` +
            `Hit the **Vote** button on any project to cast your vote. ` +
            `You can vote for as many projects as you like - **one vote per project**.\n\n` +
            `**${submissions.length} project${submissions.length !== 1 ? 's' : ''}** up for voting:`,
          )
          .setTimestamp(),
      ],
    });

    // ── One embed + button per project ────────────────────────────────────────
    for (const sub of submissions) {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(sub.project_name || 'Untitled')
        .setDescription(sub.description || 'No description provided.')
        .setAuthor({ name: sub.username });

      const button = new ButtonBuilder()
        .setCustomId(`vote_${sub.id}`)
        .setLabel('Vote')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      const msg = await channel.send({ embeds: [embed], components: [row] });
      await createVotingMessage(sub.id, msg.id, sessionId);
    }

    await interaction.editReply(
      `Success: Voting started! ${submissions.length} project${submissions.length !== 1 ? 's' : ''} posted to <#${channel.id}>.`,
    );
  },
};
