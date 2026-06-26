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

  // Only the ⭐ emoji matters
  if (reaction.emoji.name !== config.submissionEmoji) return;

  const message = reaction.message;

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
  const existing = getSubmissionByUserAndMonth(user.id, month, year);
  if (existing) {
    try {
      const dm = await user.createDM();
      await dm.send({
        embeds: [
          {
            color: 0xed4245,
            title: '❌ Already submitted this month',
            description:
              "You can only submit **one project per month**. Your existing submission is locked in — good luck with voting! 🤞",
          },
        ],
      });
    } catch { /* user has DMs closed */ }
    return;
  }

  // Don't create a second pending row if one already exists (edge case)
  const alreadyPending = getPendingSubmission(user.id);
  if (alreadyPending) return;

  // ── Create pending submission & start DM flow ─────────────────────────────
  const submissionId = createSubmission(
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
          title: '🚀 Project Submission',
          description:
            "Let's get your project listed on the board!\n\n**What's your project called?**",
          footer: { text: "Type your project name — you've got 5 minutes ⏳" },
        },
      ],
    });

    const timeoutHandle = startDMFlowTimeout(user.id, submissionId);
    pendingDMFlows.set(user.id, { submissionId, step: 'name', timeoutHandle });
  } catch {
    // User has DMs closed — cancel the pending record
    const { cancelPendingSubmission } = await import('../db');
    cancelPendingSubmission(submissionId);

    try {
      const channel = fullMessage.channel as TextChannel;
      // Best effort: we can't reliably reply here without pinging, so just log
      console.warn(`[submission] Could not DM user ${user.id} — DMs may be closed.`);
    } catch { /* ignore */ }
  }
}
