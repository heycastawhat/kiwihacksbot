import {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';
import { config } from '../config';
import { getSubmissionByMessageId, hasVoted, addVote } from '../db';

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

  if (reaction.emoji.name !== config.voteEmoji) return;

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
}
