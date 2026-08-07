import {
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';
import { config } from '../config';
import { Submission } from '../db';
import { getSubmissionByMessageId, addVote, removeVote } from '../db';

type Reaction = MessageReaction | PartialMessageReaction;
type ReactingUser = User | PartialUser;

// Resolves a reaction event to the active submission it votes on, or null if it isn't a vote.
async function resolveVote(reaction: Reaction, user: ReactingUser): Promise<Submission | null> {
  // Reactions on older/uncached messages arrive partial
  if (reaction.partial) {
    try { await reaction.fetch(); }
    catch (e) { console.log('[reaction] fetch failed:', e); return null; }
  }
  if (user.partial) {
    try { await user.fetch(); }
    catch (e) { console.log('[reaction] user fetch failed:', e); return null; }
  }

  if (user.bot) return null;
  if (reaction.emoji.name !== config.voteEmoji) return null;

  const sub = await getSubmissionByMessageId(reaction.message.id);
  if (!sub || sub.status !== 'active') return null;
  return sub;
}

export async function handleMessageReactionAdd(
  reaction: Reaction,
  user: ReactingUser,
): Promise<void> {
  const sub = await resolveVote(reaction, user);
  if (!sub) return;

  if (sub.user_id === user.id) {
    try {
      await reaction.users.remove(user.id);
    } catch (e) {
      console.log('[reaction] failed to remove self-vote:', e);
    }
    try {
      const dm = await user.createDM();
      await dm.send('You cannot vote for your own project!');
    } catch (e) {}
    return;
  }

  await addVote(user.id, sub.id);
}

export async function handleMessageReactionRemove(
  reaction: Reaction,
  user: ReactingUser,
): Promise<void> {
  const sub = await resolveVote(reaction, user);
  if (!sub) return;

  await removeVote(user.id, sub.id);
}
