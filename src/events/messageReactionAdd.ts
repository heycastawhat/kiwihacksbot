import {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
  TextChannel,
} from 'discord.js';
import { config } from '../config';
import {
  getSubmissionByUserAndMonth,
  getPendingSubmission,
  createSubmission,
  getSubmissionByMessageId,
  hasVoted,
  addVote,
} from '../db';
import { pendingDMFlows, startDMFlowTimeout } from './messageCreate';

export async function handleMessageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  console.log(`[reaction] emoji=${reaction.emoji.name} user=${user.id} channel=${reaction.message.channelId} partial=${reaction.partial}`);

  // Resolve partials (reactions/messages on older messages may be partial)
  if (reaction.partial) {
    try { await reaction.fetch(); }
    catch (e) { console.log('[reaction] fetch failed:', e); return; }
  }
  if (user.partial) {
    try { await user.fetch(); }
    catch (e) { console.log('[reaction] user fetch failed:', e); return; }
  }

  // Ignore bots
  if (user.bot) return;

  // ── Anytime Voting Logic ──────────────────────────────────────────────────
  const message = reaction.message;

  if (reaction.emoji.name === 'upvote') {
    const sub = await getSubmissionByMessageId(message.id);
    if (!sub || sub.status !== 'active') return;

    // Blind voting: immediately remove the reaction
    try {
      await reaction.users.remove(user.id);
    } catch (e) {
      console.log('[reaction] failed to remove upvote reaction:', e);
    }

    if (sub.user_id === user.id) {
      try {
        const dm = await user.createDM();
        await dm.send('You cannot vote for your own project!');
      } catch (e) {}
      return;
    }

    const voted = await hasVoted(user.id, sub.id);
    try {
      const dm = await user.createDM();
      if (voted) {
        await dm.send(`You've already voted for **${sub.project_name || 'Untitled'}**!`);
      } else {
        await addVote(user.id, sub.id);
        await dm.send(`Your vote for **${sub.project_name || 'Untitled'}** has been secretly recorded!`);
      }
    } catch (e) {}

    return;
  }

  // Only the ⭐ emoji matters for submissions
  if (reaction.emoji.name !== config.submissionEmoji) return;

  // Must be in one of the valid submission channels
  if (!config.validSubmissionChannels.includes(message.channelId)) return;

  // Fetch the full message if partial so we can read the author
  const fullMessage = message.partial ? await message.fetch() : message;

  // Only fire when the user reacts to their OWN message
  if (fullMessage.author?.id !== user.id) return;

  // If we're already mid-flow for this user, ignore duplicate triggers
  if (pendingDMFlows.has(user.id)) return;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // ── 1-per-month guard ─────────────────────────────────────────────────────
  const existing = await getSubmissionByUserAndMonth(user.id, month, year);
  if (existing) {
    try {
      const dm = await user.createDM();
      await dm.send({
        embeds: [
          {
            color: 0xed4245,
            title: 'Error: Already submitted this month',
            description:
              "You can only submit **one project per month**. Your existing submission is locked in - good luck with voting!",
          },
        ],
      });
    } catch { /* user has DMs closed */ }
    return;
  }

  // Don't create a second pending row if one already exists (edge case)
  const alreadyPending = await getPendingSubmission(user.id);
  if (alreadyPending) return;

  // ── Create pending submission & start DM flow ─────────────────────────────
  const submissionId = await createSubmission(
    user.id,
    (user as User).username,
    fullMessage.id,
    fullMessage.channelId,
    month,
    year,
  );

  try {
    const dm = await user.createDM();
    await dm.send({
      embeds: [
        {
          color: 0x5865f2,
          title: 'Project Submission Started!',
          description:
            `You reacted to your message in <#${message.channelId}>.\n\n` +
            `**First, please provide a short name for your project.**\n*(Max 100 characters)*`,
        },
      ],
    });

    // ── Create a thread for discussion ────────────────────────────────────────
    try {
      await fullMessage.startThread({
        name: `${(user as User).username}'s Project`,
        autoArchiveDuration: 1440,
      });
    } catch (e) {
      console.log('[reaction] failed to create thread:', e);
    }

    // ── Extract description and github link ───────────────────────────────────
    const description = fullMessage.content || 'No description provided';
    const githubMatch = description.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/i);
    const githubLink = githubMatch ? githubMatch[0] : '';

    pendingDMFlows.set(user.id, {
      submissionId: submissionId,
      step: 'name',
      description: description,
      githubLink: githubLink,
      timeoutHandle: startDMFlowTimeout(user.id, submissionId),
    });
  } catch (e) {
    // User has DMs closed — cancel the pending record
    const { cancelPendingSubmission } = await import('../db');
    await cancelPendingSubmission(submissionId);

    try {
      const channel = fullMessage.channel as TextChannel;
      // Best effort: we can't reliably reply here without pinging, so just log
      console.warn(`[submission] Could not DM user ${user.id} — DMs may be closed.`);
    } catch { /* ignore */ }
  }
}
